// static/script.js

// Função para formatar números como moeda (R$ 1.234,56)
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// Função para buscar dados de um endpoint específico
async function fetchData(endpoint) {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Falha ao buscar ${endpoint}`);
    return response.json();
}

// Função para definir a cor do mapa de calor
function getColor(value, max) {
    const scale = value / max;
    if (scale > 0.8) return '#800026';
    if (scale > 0.6) return '#BD0026';
    if (scale > 0.4) return '#E31A1C';
    if (scale > 0.2) return '#FC4E2A';
    if (scale > 0.1) return '#FD8D3C';
    if (scale > 0.05) return '#FEB24C';
    if (scale > 0) return '#FFEDA0';
    return '#FFFFFF'; // Cor para municípios sem dados
}

// Função principal que carrega e renderiza tudo
async function main() {
    try {
        const loadingEl = document.getElementById('loading-message');
        const dashboardEl = document.getElementById('dashboard-content');

        // Busca todos os dados em paralelo
        const [cidadesData, partidosData, mapaData, geojsonData] = await Promise.all([
            fetchData('/api/ranking-cidades'),
            fetchData('/api/ranking-partidos'),
            fetchData('/api/mapa-calor'),
            fetch('https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-43-mun.json') // GeoJSON do RS
                .then(res => res.json())
        ]);
        
        // Esconde a mensagem de carregamento e mostra o dashboard
        loadingEl.style.display = 'none';
        dashboardEl.style.display = 'grid';

        // 1. Renderiza o Ranking de Cidades
        new Chart(document.getElementById('cidadesChart'), {
            type: 'bar',
            data: {
                labels: cidadesData.map(c => c.nome_municipio),
                datasets: [{
                    label: 'Gasto Total',
                    data: cidadesData.map(c => c.valor_despesa),
                    backgroundColor: '#36A2EB'
                }]
            },
            options: { indexAxis: 'y', plugins: { tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } } } }
        });

        // 2. Renderiza o Ranking de Partidos
        new Chart(document.getElementById('partidosChart'), {
            type: 'doughnut',
            data: {
                labels: partidosData.map(p => p.sigla_partido),
                datasets: [{
                    label: 'Gasto Total',
                    data: partidosData.map(p => p.valor_despesa),
                }]
            },
            options: { plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` } } } }
        });

        // 3. Renderiza o Mapa de Calor
        const map = L.map('map').setView([-29.5, -53.0], 7);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(map);

        const gastosPorMunicipio = {};
        mapaData.forEach(item => {
            gastosPorMunicipio[item.id_municipio] = item.valor_despesa;
        });

        const maxGasto = Math.max(...Object.values(gastosPorMunicipio));

        L.geoJson(geojsonData, {
            style: function(feature) {
                const id = feature.properties.id; // O ID no GeoJSON é o código IBGE
                const gasto = gastosPorMunicipio[id] || 0;
                return {
                    fillColor: getColor(gasto, maxGasto),
                    weight: 1,
                    opacity: 1,
                    color: 'white',
                    fillOpacity: 0.7
                };
            },
            onEachFeature: function(feature, layer) {
                const id = feature.properties.id;
                const nome = feature.properties.name;
                const gasto = gastosPorMunicipio[id] || 0;
                layer.bindPopup(`<b>${nome}</b><br>Gasto Total: ${formatCurrency(gasto)}`);
            }
        }).addTo(map);

    } catch (error) {
        console.error("Erro ao montar o dashboard:", error);
        document.getElementById('loading-message').innerHTML = '<p style="color: red;">Ocorreu um erro ao carregar os dados. Verifique o console para mais detalhes.</p>';
    }
}

// Inicia a aplicação
main();