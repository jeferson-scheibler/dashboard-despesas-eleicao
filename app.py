# app.py
import pandas as pd
from flask import Flask, jsonify, send_from_directory
from google.oauth2 import service_account # Importamos a biblioteca de autenticação

# --- CONFIGURAÇÃO ---
BILLING_PROJECT_ID = "analise-dados-tse"
# O caminho para o arquivo que configuramos no Render Secret Files
CREDENTIALS_PATH = "/etc/secrets/gcp_credentials.json"
# --------------------

app = Flask(__name__, static_folder='static')

dados_rs = None

def carregar_dados_rs():
    global dados_rs
    if dados_rs is not None:
        return dados_rs

    print("Iniciando carga de dados do TSE para o RS em 2024...")
    
    query = """
    WITH despesas AS (
        SELECT 
            id_municipio,
            sigla_partido,
            valor_despesa
        FROM `basedosdados.br_tse_eleicoes.despesas_candidato` 
        WHERE ano = 2024 AND cargo = 'vereador' AND sigla_uf = 'RS'
    )
    SELECT 
        d.id_municipio,
        m.nome AS nome_municipio,
        d.sigla_partido,
        d.valor_despesa
    FROM despesas d
    JOIN `basedosdados.br_bd_diretorios_brasil.municipio` m ON d.id_municipio = m.id_municipio
    """
    
    try:
        # ---- MUDANÇA PRINCIPAL AQUI ----
        # 1. Carregamos as credenciais explicitamente do arquivo.
        credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
        
        # 2. Usamos o pandas-gbq diretamente, passando as credenciais.
        #    Removemos a chamada à biblioteca 'basedosdados' daqui.
        df = pd.read_gbq(
            query,
            project_id=BILLING_PROJECT_ID,
            credentials=credentials
        )
        # ---------------------------------
        
        print("Dados carregados com sucesso!")
        dados_rs = df
        return df
    except Exception as e:
        print(f"ERRO AO CARREGAR DADOS: {e}")
        # Se o erro for de 'arquivo não encontrado', pode ser que você esteja rodando localmente.
        # Para testes locais, o método anterior (com gcloud auth) ainda funciona.
        # Este novo método é específico para o ambiente do Render.
        return None

# O resto do arquivo permanece igual...
df = carregar_dados_rs()

@app.route('/api/ranking-cidades')
def ranking_cidades():
    if df is None or df.empty:
        return jsonify({"error": "Dados não disponíveis ou vazios"}), 500
    ranking = df.groupby('nome_municipio')['valor_despesa'].sum().nlargest(15).reset_index()
    return jsonify(ranking.to_dict(orient='records'))

@app.route('/api/ranking-partidos')
def ranking_partidos():
    if df is None or df.empty:
        return jsonify({"error": "Dados não disponíveis ou vazios"}), 500
    ranking = df.groupby('sigla_partido')['valor_despesa'].sum().nlargest(10).reset_index()
    return jsonify(ranking.to_dict(orient='records'))

@app.route('/api/mapa-calor')
def mapa_calor():
    if df is None or df.empty:
        return jsonify({"error": "Dados não disponíveis ou vazios"}), 500
    map_data = df.groupby('id_municipio')['valor_despesa'].sum().reset_index()
    return jsonify(map_data.to_dict(orient='records'))

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)