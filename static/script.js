// static/script.js

// IIFE (Immediately Invoked Function Expression) para encapsular nosso código
(async function() {
    // --- ELEMENTOS DO DOM ---
    const loader = document.getElementById('loader-overlay');
    const dashboard = document.getElementById('dashboard-content');

    // --- FUNÇÕES UTILITÁRIAS ---
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const showLoader = () => loader.style.display = 'flex';
    const hideLoader = () => loader.style.opacity = '0';

    async function fetchData(endpoint) {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`Falha ao buscar ${endpoint}: ${response.statusText}`);
        return response.json();
    }
    
    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    
    function renderKPIs(cidadesData, partidosData) {
        const totalGasto = cidadesData.reduce((sum, cidade) => sum + cidade.valor_despesa, 0);
        document.getElementById('kpi-gasto-total').textContent = formatCurrency(totalGasto);
        document.getElementById('kpi-total-cidades').textContent = cidadesData.length;
        document.getElementById('kpi-partido-campeao').textContent = partidosData[0]?.sigla_partido || 'N/A';
    }

    function renderCidadesChart(cidadesData) {
        new Chart(document.getElementById('cidadesChart'), {
            type: 'bar',
            data: {
                labels: cidadesData.map(c => c.nome_municipio),
                datasets: [{
                    label: 'Gasto Total',
                    data: cidadesData.map(c => c.valor_despesa),
                    backgroundColor: '#36A2EB',
                    borderRadius: 4
                }]
            },
            options: { 
                indexAxis: 'y', 
                responsive: true,
                plugins: { 
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } } 
                } 
            }
        });
    }

    function renderPartidosChart(partidosData) {
        new Chart(document.getElementById('partidosChart'), {
            type: 'doughnut',
            data: {
                labels: partidosData.map(p => p.sigla_partido),
                datasets: [{
                    data: partidosData.map(p => p.valor_despesa),
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#E7E9ED', '#8D5B4C', '#58508d']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` } }
                }
            }
        });
    }

    function renderChoroplethMap(mapaData, geojsonData) {
        const map = L.map('map').setView([-29.5, -53.0], 7);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(map);

        const gastosPorMunicipio = mapaData.reduce((obj, item) => {
            obj[item.id_municipio] = item.valor_despesa;
            return obj;
        }, {});
        
        const maxGasto = Math.max(...Object.values(gastosPorMunicipio));

        const getColor = (value) => {
            const scale = value / maxGasto;
            if (scale > 0.8) return '#800026';
            if (scale > 0.6) return '#BD0026';
            if (scale > 0.4) return '#E31A1C';
            if (scale > 0.2) return '#FC4E2A';
            if (scale > 0.1) return '#FD8D3C';
            if (scale > 0.05) return '#FEB24C';
            if (scale > 0) return '#FFEDA0';
            return '#FFFFFF';
        };

        L.geoJson(geojsonData, {
            style: (feature) => ({
                fillColor: getColor(gastosPorMunicipio[feature.properties.id] || 0),
                weight: 1,
                opacity: 1,
                color: 'white',
                fillOpacity: 0.8
            }),
            onEachFeature: (feature, layer) => {
                const nome = feature.properties.name;
                const gasto = gastosPorMunicipio[feature.properties.id] || 0;
                layer.bindPopup(`<b>${nome}</b><br>Gasto Total: ${formatCurrency(gasto)}`);
            }
        }).addTo(map);
    }
    
    function setupTable(cidadesData) {
        const tableBody = document.getElementById('dataTableBody');
        const searchInput = document.getElementById('searchInput');
        
        const allRows = cidadesData
            .sort((a, b) => b.valor_despesa - a.valor_despesa)
            .map(cidade => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${cidade.nome_municipio}</td><td>${formatCurrency(cidade.valor_despesa)}</td>`;
                return row;
            });

        tableBody.append(...allRows);

        searchInput.addEventListener('keyup', () => {
            const searchTerm = searchInput.value.toLowerCase();
            allRows.forEach(row => {
                const cityName = row.cells[0].textContent.toLowerCase();
                row.style.display = cityName.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // --- FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO ---
    
    async function initializeDashboard() {
        try {
            showLoader();

            const [cidadesData, partidosData, mapaData, geojsonData] = await Promise.all([
                fetchData('/api/ranking-cidades'),
                fetchData('/api/ranking-partidos'),
                fetchData('/api/mapa-calor'),
                fetch('https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-43-mun.json').then(res => res.json())
            ]);

            renderKPIs(cidadesData, partidosData);
            renderCidadesChart(cidadesData);
            renderPartidosChart(partidosData);
            renderChoroplethMap(mapaData, geojsonData);
            setupTable(cidadesData); // Configura a tabela com todos os dados de cidades
            
            // Atraso para a animação de fade-out do loader ser visível
            setTimeout(() => {
                hideLoader();
                dashboard.style.display = 'block';
            }, 500);

        } catch (error) {
            console.error("Erro fatal ao inicializar o dashboard:", error);
            document.body.innerHTML = `<div class="error-message"><h1>Oops!</h1><p>Não foi possível carregar os dados do dashboard. Verifique o console para mais detalhes técnicos.</p></div>`;
        }
    }

    // Inicia a aplicação
    initializeDashboard();

})();