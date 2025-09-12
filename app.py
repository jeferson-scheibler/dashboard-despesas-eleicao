# app.py
import pandas as pd
import basedosdados as bd
from flask import Flask, jsonify, send_from_directory

# --- CONFIGURAÇÃO ---
# COLOQUE O ID DO SEU PROJETO DO GOOGLE CLOUD AQUI
BILLING_PROJECT_ID = "analise-dados-tse" 
# --------------------

app = Flask(__name__, static_folder='static')

# Variável global para armazenar os dados em cache e não baixar toda hora
dados_rs = None

def carregar_dados_rs():
    """
    Busca e processa os dados de despesas para vereadores no RS em 2024.
    Isso executa apenas uma vez quando o servidor inicia.
    """
    global dados_rs
    if dados_rs is not None:
        return dados_rs

    print("Iniciando carga de dados do TSE para o RS em 2024...")
    
    # Query para pegar despesas e juntar com a tabela de municípios para obter os nomes
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
        df = bd.read_sql(query, billing_project_id=BILLING_PROJECT_ID)
        print("Dados carregados com sucesso!")
        dados_rs = df
        return df
    except Exception as e:
        print(f"ERRO AO CARREGAR DADOS: {e}")
        return None

# Carrega os dados na inicialização do servidor
df = carregar_dados_rs()

# --- ENDPOINTS DA API ---

@app.route('/api/ranking-cidades')
def ranking_cidades():
    if df is None:
        return jsonify({"error": "Dados não disponíveis"}), 500
    
    ranking = df.groupby('nome_municipio')['valor_despesa'].sum().nlargest(15).reset_index()
    return jsonify(ranking.to_dict(orient='records'))

@app.route('/api/ranking-partidos')
def ranking_partidos():
    if df is None:
        return jsonify({"error": "Dados não disponíveis"}), 500
    
    ranking = df.groupby('sigla_partido')['valor_despesa'].sum().nlargest(10).reset_index()
    return jsonify(ranking.to_dict(orient='records'))

@app.route('/api/mapa-calor')
def mapa_calor():
    if df is None:
        return jsonify({"error": "Dados não disponíveis"}), 500
    
    # Usamos id_municipio aqui, que é o código IBGE de 7 dígitos
    map_data = df.groupby('id_municipio')['valor_despesa'].sum().reset_index()
    return jsonify(map_data.to_dict(orient='records'))

# --- ROTAS PARA SERVIR O FRONTEND ---

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

if __name__ == '__main__':
    app.run(debug=True)