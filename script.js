// static/script.js

// Função para buscar os dados da nossa API Python
async function fetchData() {
    try {
        const response = await fetch('/api/dados');
        if (!response.ok) {
            throw new Error('Falha ao buscar dados do servidor.');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Erro:', error);
        // Exibir mensagem de erro na tela
        document.body.innerHTML = '<h1>Erro ao carregar os dados. Verifique o console.</h1>';
    }
}

// Função para renderizar os gráficos
function renderCharts(data) {
    // Gráfico 1: Top 10 Tipos de Despesas
    const ctx1 = document.getElementById('topDespesasChart').getContext('2d');
    new Chart(ctx1, {
        type: 'bar', // Tipo do gráfico
        data: {
            labels: data.top_despesas.labels,
            datasets: [{
                label: 'Valor Total Gasto (R$)',
                data: data.top_despesas.values,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        }
    });

    // Gráfico 2: Despesa Média por Município
    const ctx2 = document.getElementById('despesaMunicipioChart').getContext('2d');
    new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: data.despesa_municipio.labels,
            datasets: [{
                label: 'Despesa Média (R$)',
                data: data.despesa_municipio.values,
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Deixa as barras na horizontal para melhor leitura
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'ID do Município (TSE)'
                    }
                }
            }
        }
    });
}

// Inicia o processo quando a página carrega
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Página carregada. Buscando dados...");
    const data = await fetchData();
    if (data) {
        console.log("Dados recebidos:", data);
        renderCharts(data);
    }
});