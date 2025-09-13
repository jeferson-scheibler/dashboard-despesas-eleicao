# app.py
import pandas as pd
from flask import Flask, jsonify, send_from_directory
from google.oauth2 import service_account

# --- CONFIGURAÇÃO ---
BILLING_PROJECT_ID = "analise-dados-tse"
CREDENTIALS_PATH = "/etc/secrets/gcp_credentials.json"
# --------------------

app = Flask(__name__, static_folder='static')

# Cache para os dataframes
df_gastos_geral = None
df_cruzado = None

def carregar_dados_gastos():
    """ Carrega e processa os dados de despesas para vereadores no RS em 2024. """
    global df_gastos_geral
    if df_gastos_geral is not None:
        return df_gastos_geral

    print("Iniciando carga de dados de DESPESAS do TSE para o RS em 2024...")
    query = """
    WITH despesas AS (
        SELECT id_municipio, sigla_partido, valor_despesa
        FROM `basedosdados.br_tse_eleicoes.despesas_candidato` 
        WHERE ano = 2024 AND cargo = 'vereador' AND sigla_uf = 'RS'
    )
    SELECT d.id_municipio, m.nome AS nome_municipio, d.sigla_partido, d.valor_despesa
    FROM despesas d
    JOIN `basedosdados.br_bd_diretorios_brasil.municipio` m ON d.id_municipio = m.id_municipio
    """
    try:
        credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
        df = pd.read_gbq(query, project_id=BILLING_PROJECT_ID, credentials=credentials)
        print("Dados de DESPESAS carregados com sucesso!")
        df_gastos_geral = df
        return df
    except Exception as e:
        print(f"ERRO AO CARREGAR DADOS DE DESPESAS: {e}")
        return None

def carregar_dados_cruzados():
    """ Carrega e cruza dados de despesas com dados de votação. """
    global df_cruzado
    if df_cruzado is not None:
        return df_cruzado

    print("Iniciando carga de dados CRUZADOS (despesas x votação)...")
    query = """
    WITH gastos_por_municipio AS (
      SELECT
        id_municipio,
        SUM(valor_despesa) as gasto_total
      FROM `basedosdados.br_tse_eleicoes.despesas_candidato`
      WHERE ano = 2024 AND cargo = 'vereador' AND sigla_uf = 'RS'
      GROUP BY id_municipio
    ),
    votacao_por_municipio AS (
      SELECT
        id_municipio,
        SUM(comparecimento) as comparecimento,
        SUM(abstencoes) as abstencoes
      FROM `basedosdados.br_tse_eleicoes.detalhes_votacao_municipio`
      WHERE ano = 2024 AND sigla_uf = 'RS'
      GROUP BY id_municipio
    )
    SELECT
      m.nome as nome_municipio,
      g.gasto_total,
      v.comparecimento,
      v.abstencoes,
      SAFE_DIVIDE(v.comparecimento, (v.comparecimento + v.abstencoes)) * 100 as taxa_comparecimento
    FROM gastos_por_municipio g
    JOIN votacao_por_municipio v ON g.id_municipio = v.id_municipio
    JOIN `basedosdados.br_bd_diretorios_brasil.municipio` m ON g.id_municipio = m.id_municipio
    """
    try:
        credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
        df = pd.read_gbq(query, project_id=BILLING_PROJECT_ID, credentials=credentials)
        print("Dados CRUZADOS carregados com sucesso!")
        df_cruzado = df
        return df
    except Exception as e:
        print(f"ERRO AO CARREGAR DADOS CRUZADOS: {e}")
        return None

# Carrega os dados na inicialização
df_gastos = carregar_dados_gastos()
df_cruzado_data = carregar_dados_cruzados()

# --- ENDPOINTS DA API ---

@app.route('/api/ranking-cidades')
def ranking_cidades():
    if df_gastos is None: return jsonify({"error": "Dados não disponíveis"}), 500
    ranking = df_gastos.groupby('nome_municipio')['valor_despesa'].sum().nlargest(15).reset_index()
    return jsonify(ranking.to_dict(orient='records'))

@app.route('/api/todas-cidades') # NOVO ENDPOINT PARA A TABELA
def todas_cidades():
    if df_gastos is None: return jsonify({"error": "Dados não disponíveis"}), 500
    ranking_completo = df_gastos.groupby('nome_municipio')['valor_despesa'].sum().reset_index()
    return jsonify(ranking_completo.to_dict(orient='records'))

@app.route('/api/ranking-partidos')
def ranking_partidos():
    if df_gastos is None: return jsonify({"error": "Dados não disponíveis"}), 500
    ranking = df_gastos.groupby('sigla_partido')['valor_despesa'].sum().nlargest(10).reset_index()
    return jsonify(ranking.to_dict(orient='records'))

@app.route('/api/mapa-calor')
def mapa_calor():
    if df_gastos is None: return jsonify({"error": "Dados não disponíveis"}), 500
    map_data = df_gastos.groupby('id_municipio')['valor_despesa'].sum().reset_index()
    return jsonify(map_data.to_dict(orient='records'))

@app.route('/api/correlacao-gasto-votacao') # NOVO ENDPOINT PARA O GRÁFICO DE DISPERSÃO
def correlacao_gasto_votacao():
    if df_cruzado_data is None: return jsonify({"error": "Dados cruzados não disponíveis"}), 500
    return jsonify(df_cruzado_data.to_dict(orient='records'))

# --- ROTAS PARA SERVIR O FRONTEND ---
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)