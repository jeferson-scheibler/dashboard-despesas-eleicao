# app.py
import pandas as pd
import basedosdados as bd
from flask import Flask, jsonify

# Inicializa o servidor Flask
app = Flask(__name__, static_folder='static')

# Função para carregar e processar os dados
def get_processed_data():
    print("Buscando dados na Base dos Dados... Isso pode levar um momento.")
    
    # Monta a query SQL para buscar os dados de vereadores em 2024
    # ATENÇÃO: Os dados de 2024 ainda são preliminares.
    # Para garantir que o código funcione, usaremos 2020 como exemplo.
    # Quando os dados de 2024 estiverem consolidados, basta trocar o ano.
    query = """
    SELECT tipo_despesa, valor_despesa, id_municipio_tse
    FROM `basedosdados.br_tse_eleicoes.despesas_candidato`
    WHERE ano = 2020 AND cargo = 'Vereador' AND sigla_uf = 'SP'
    """ 
    # Filtrei por 'SP' para a query ser mais rápida. Remova se quiser dados do Brasil todo.

    # Baixa os dados usando a biblioteca da Base dos Dados
    # Você precisará configurar um projeto no Google Cloud. 
    # Siga: https://basedosdados.github.io/mais/access_data_local/#primeiros-passos
    df = bd.read_sql(query, billing_project_id="basedosdados.br_tse_eleicoes.despesas_candidato")
    
    print("Dados baixados! Processando...")

    # --- Análise 1: Top 10 Tipos de Despesa ---
    top_10_despesas = df.groupby('tipo_despesa')['valor_despesa'].sum().nlargest(10)
    
    # --- Análise 2: Despesa Média por Município (Top 10 Cidades) ---
    despesa_media_municipio = df.groupby('id_municipio_tse')['valor_despesa'].mean().nlargest(10)

    # Formata os dados para o formato JSON que o Chart.js entende
    processed_data = {
        "top_despesas": {
            "labels": top_10_despesas.index.tolist(),
            "values": top_10_despesas.values.tolist()
        },
        "despesa_municipio": {
            "labels": [str(x) for x in despesa_media_municipio.index.tolist()], # Converte ID do município para string
            "values": despesa_media_municipio.values.tolist()
        }
    }
    
    return processed_data

# Cria um "endpoint" da API. O frontend vai chamar essa URL.
@app.route('/api/dados')
def dados_endpoint():
    data = get_processed_data()
    return jsonify(data)

# Rota para servir a página HTML principal
from flask import send_from_directory

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Permite rodar o servidor localmente para testes
if __name__ == '__main__':
    app.run(debug=True)