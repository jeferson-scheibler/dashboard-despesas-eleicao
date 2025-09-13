// static/script.js

(async function() {
    // --- ELEMENTOS DO DOM ---
    const loader = document.getElementById('loader-overlay');

    // --- FUNÇÕES UTILITÁRIAS ---
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const formatPercent = (value) => `${value.toFixed(2)}%`;
    const hideLoader = () => {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 300);
    };

    async function fetchData(endpoint) {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`Falha ao buscar ${endpoint}: ${response.statusText}`);
        return response.json();
    }
    
    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    
    function renderKPIs(todasCidadesData, partidosData) {
        const totalGasto = todasCidadesData.reduce((sum, cidade) => sum + cidade.valor_despesa, 0);
        document.getElementById('kpi-gasto-total').textContent = formatCurrency(totalGasto);
        document.getElementById('kpi-total-cidades').textContent = todasCidadesData.length;
        document.getElementById('kpi-partido-campeao').textContent = partidosData[0]?.sigla_partido || 'N/A';
    }

    function renderCidadesChart(cidadesData) {
        new Chart(document.getElementById('cidadesChart'), {
            type: 'bar',
            data: {
                labels: cidadesData.map(c => c.nome_municipio),
                datasets: [{ label: 'Gasto Total', data: cidadesData.map(c => c.valor_despesa), backgroundColor: '#36A2EB', borderRadius: 4 }]
            },
            options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } } } }
        });
    }

    function renderCorrelacaoChart(correlacaoData) {
        new Chart(document.getElementById('correlacaoChart'), {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Município',
                    data: correlacaoData.map(d => ({
                        x: d.gasto_total,
                        y: d.taxa_comparecimento,
                        label: d.nome_municipio // Dado extra para o tooltip
                    })),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        type: 'logarithmic', // Escala logarítmica é melhor para dados de gasto muito variados
                        title: { display: true, text: 'Gasto Total de Campanha (R$)' }
                    },
                    y: {
                        title: { display: true, text: 'Taxa de Comparecimento (%)' }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const dataPoint = ctx.raw;
                                return [
                                    `${dataPoint.label}`,
                                    `Gasto: ${formatCurrency(dataPoint.x)}`,
                                    `Comparecimento: ${formatPercent(dataPoint.y)}`
                                ];
                            }
                        }
                    }
                }
            }
        });
    }

    function renderChoroplethMap(mapaData, geojsonData) {
        const map = L.map('map').setView([-29.5, -53.0], 7);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>' }).addTo(map);

        const gastosPorMunicipio = mapaData.reduce((obj, item) => {
            obj[item.id_municipio] = item.valor_despesa;
            return obj;
        }, {});
        
        const maxGasto = Math.max(...Object.values(gastosPorMunicipio));
        const getColor = (v) => {
            const s=v/maxGasto; return s > 0.8 ? '#800026' : s > 0.6 ? '#BD0026' : s > 0.4 ? '#E31A1C' : s > 0.2 ? '#FC4E2A' : s > 0.1 ? '#FD8D3C' : s > 0.05 ? '#FEB24C' : s > 0 ? '#FFEDA0' : '#FFFFFF';
        };

        L.geoJson(geojsonData, {
            style: (f) => ({ fillColor: getColor(gastosPorMunicipio[f.properties.id] || 0), weight: 1, opacity: 1, color: 'white', fillOpacity: 0.8 }),
            onEachFeature: (f, l) => { l.bindPopup(`<b>${f.properties.name}</b><br>Gasto Total: ${formatCurrency(gastosPorMunicipio[f.properties.id] || 0)}`); }
        }).addTo(map);
    }
    
    function setupTable(todasCidadesData) {
        const tableBody = document.getElementById('dataTableBody');
        const searchInput = document.getElementById('searchInput');
        
        const allRows = todasCidadesData
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
                row.style.display = row.cells[0].textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // --- FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO ---
    
    async function initializeDashboard() {
        try {
            document.getElementById('loader-overlay').style.display = 'flex';

            // ATENÇÃO: Os endpoints foram reorganizados!
            const [
                cidadesRankingData, // Top 15 para o gráfico
                todasCidadesData,    // Lista completa para a tabela e KPIs
                partidosData,        // Para o KPI do partido campeão
                mapaData,
                correlacaoData,      // Novos dados para o scatter plot
                geojsonData
            ] = await Promise.all([
                fetchData('/api/ranking-cidades'),
                fetchData('/api/todas-cidades'),
                fetchData('/api/ranking-partidos'),
                fetchData('/api/mapa-calor'),
                fetchData('/api/correlacao-gasto-votacao'),
                fetch('https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-43-mun.json').then(res => res.json())
            ]);

            renderKPIs(todasCidadesData, partidosData);
            renderCidadesChart(cidadesRankingData);
            renderCorrelacaoChart(correlacaoData); // Nova função chamada
            renderChoroplethMap(mapaData, geojsonData);
            setupTable(todasCidadesData); // Agora usa a lista completa!
            
            setTimeout(() => {
                hideLoader();
            }, 500);

        } catch (error) {
            console.error("Erro fatal ao inicializar o dashboard:", error);
            document.body.innerHTML = `<div style="text-align: center; padding: 50px; color: red;"><h1>Oops!</h1><p>Não foi possível carregar os dados do dashboard. Verifique o console para mais detalhes.</p></div>`;
        }
    }

    // Inicia a aplicação
    initializeDashboard();
})();