// Dashboard FCV - JavaScript Principal
class FCVDashboard {
    constructor() {
        this.data = null; // Dados processados do dashboard
        this.rawData = null; // Dados brutos do CSV
        this.filteredData = null; // Dados processados após a aplicação de filtros
        this.totalNewCases2024 = 0; // Total de casos de 2024 (fixo, não afetado por filtros)
        this.charts = {};
        this.filters = {
            period: [],
            region: [],
            tumorSpecific: [],
            tumorGeneral: [],
            age: 'all',
            ageMin: 'all',
            ageMax: 'all',
            smoking: 'all', // Novo filtro para tabagismo
            alcohol: 'all', // Novo filtro para alcoolismo
            stagingGrouped: 'all', // Novo filtro para estadiamento agrupado
            stagingByYear: 'all', // Novo filtro para estadiamento por ano
            sex: [],
            estadiam: [],
            education: 'all',
            obits: 'all',
            city: [],
            familyHistory: 'all',
            geografic: 'all',
            stateTratament: 'all',
            maritalStatus: 'all',
            race: 'all',
            occupations: 'all'
        };

        this.brasilGeoJSON = null; // Adicionar para armazenar os dados do GeoJSON
        this.filterTimeout = null; // Para debouncing dos filtros
        this.filteredDataCache = null; // Cache para dados filtrados

        this.colors = {
            primary: '#1a3866',
            secondary: '#0095da',
            accent: {
                pink: '#b4325b',
                yellow: '#efbc33',
                green: '#2e8a87',
                gray: '#727272'
            },
            gradients: {
                primary: ['#1a3866', '#0095da'],
                success: ['#2e8a87', '#4ecdc4'],
                warning: ['#efbc33', '#f6d55c'],
                danger: ['#b4325b', '#e74c3c']
            }
        };

        // Lógica de Paginação da Tabela de Histologia
        this.currentHistologyPage = 1;
        this.histologyRowsPerPage = 10; // Defina o número de linhas por página
        this.totalPages = 0;

        this.init();
    }


    async init() {
        const filter = document.getElementById('filters-section')
        filter.style.zIndex = '0'
        try {
            console.time('meu timer');
            await this.loadData();
            this.setupEventListeners();
            this.populateFilters();
            this.updateMetrics();
            this.createCharts();
            this.hideLoading();
        } catch (error) {
            console.error('Erro ao inicializar dashboard:', error);
            this.showError('Erro ao carregar os dados do dashboard');
        }
        console.timeEnd('meu timer');
        filters.style.zIndex = '2000'

        // Inicializa a paginação e renderiza a primeira página

        this.populateHistologyTable(); // Popula os dados que serão paginados
        this.setupHistologyPagination();
        this.renderHistologyPage(this.currentHistologyPage);
    }



    // Funções utilitárias para IndexedDB
    async saveToIndexedDB(key, data) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("DashboardDB", 2); // <- aumenta a versão para forçar upgrade

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("cache")) {
                    db.createObjectStore("cache");
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction("cache", "readwrite");
                const store = tx.objectStore("cache");
                store.put(data, key);
                tx.oncomplete = () => resolve(true);
            };

            request.onerror = (event) => reject(event.target.error);
        });
    }

    async loadFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("DashboardDB", 2); // mesma versão usada no save

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("cache")) {
                    db.createObjectStore("cache");
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction("cache", "readonly");
                const store = tx.objectStore("cache");
                const getReq = store.get(key);

                getReq.onsuccess = () => resolve(getReq.result || null);
                getReq.onerror = (event) => reject(event.target.error);
            };

            request.onerror = (event) => reject(event.target.error);
        });
    }

    async loadData() {
        this.showLoading();
        const csvUrl = new URL('data/RHC_2024_DATA.csv', document.baseURI).href;
        try {
            // Carregar dados do JSON principal
            const jsonResponse = await fetch('data/dashboard_data.json');
            if (!jsonResponse.ok) {
                throw new Error('Erro ao carregar dados do JSON');
            }
            this.data = await jsonResponse.json();


            // Carregar dados do CSV com cache via IndexedDB
            let cachedCsv = await this.loadFromIndexedDB("dadosCSV");

            if (cachedCsv) {
                this.rawData = cachedCsv;
            } else {
                this.rawData = await new Promise((resolve, reject) => {
                    Papa.parse(csvUrl, {
                        download: true,
                        header: true,
                        worker: true,
                        complete: async (results) => {
                            const processed = results.data

                            try {
                                await this.saveToIndexedDB("dadosCSV", processed);
                            } catch (e) {
                                console.warn("Não foi possível salvar CSV no IndexedDB", e);
                            }

                            resolve(processed);
                        },
                        error: (err) => reject(new Error('Erro ao carregar e processar CSV: ' + err.message))
                    });
                });
            }

            // Carregar GeoJSON do Brasil com cache localStorage
            let geoJsonData = null;
            const cachedGeoJson = localStorage.getItem('brasilGeoJSON');
            if (cachedGeoJson) {
                try {
                    geoJsonData = JSON.parse(cachedGeoJson);
                } catch (e) {
                    console.warn('Erro ao carregar GeoJSON do cache, buscando da API');
                }
            }

            if (!geoJsonData) {
                const geoJsonResponse = await fetch("https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson");
                if (!geoJsonResponse.ok) {
                    throw new Error('Erro ao carregar dados GeoJSON do Brasil');
                }
                geoJsonData = await geoJsonResponse.json();

                try {
                    localStorage.setItem('brasilGeoJSON', JSON.stringify(geoJsonData));
                } catch (e) {
                    console.warn('Não foi possível salvar GeoJSON no cache local');
                }
            }
            this.brasilGeoJSON = geoJsonData;

            // Calcular o total de casos de 2024 dos dados brutos (fixo, não afetado por filtros)
            const cases2024 = this.rawData.filter(d => {
                const ano = d.ANODIAG ? parseInt(d.ANODIAG) : 0;
                return ano === 2024;
            }).length;
            
            const cases2023 = this.rawData.filter(d => {
                const ano = d.ANODIAG ? parseInt(d.ANODIAG) : 0;
                return ano === 2023;
            }).length;
            
            this.totalNewCases2024 = cases2024 > 0 ? cases2024 : cases2023;
            console.log('Total de casos 2024 (fixo):', this.totalNewCases2024);

            this.hideLoading();
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showError('Erro ao carregar os dados do dashboard: ' + error.message);
            throw error;
        }
    }


    // Novo método para processar os dados brutos e gerar o objeto dashboardData
    processRawData(processedData) {

        const dashboardData = {};

        // 1. Métricas gerais (overview)
        const total_patients = processedData.length;
        const total_male = processedData.filter(d => d.SEXO === 'Masculino').length;
        const total_female = processedData.filter(d => d.SEXO === 'Feminino').length;
        const years = _.sortBy(_.uniq(_.map(processedData, 'ANODIAG')));// Usando Lodash


        const mortality_rate = parseFloat(
            (processedData.filter(d => d.OBITO_CA === 'Óbito por Câncer').length /
                processedData.length * 100).toFixed(1)
        );

        const Percentage_Under18 = parseFloat(
            (processedData.filter(d => d.IDADE_DIAG < 18).length /
                processedData.length * 100).toFixed(1)
        );

        const avg_inicial_states = parseFloat(
            (processedData.filter(d => d.ESTADIAM === 'I' || d.ESTADIAM === 'II').length /
                processedData.length * 100).toFixed(1)
        );

        const validAges = processedData
            .map(d => Number(d.IDADE_DIAG))
            .filter(age => !isNaN(age) && age > 0); // filtra apenas idades válidas

        const avg = validAges.length > 0
            ? validAges.reduce((sum, age) => sum + age, 0) / validAges.length
            : 0;

        const average_age = parseFloat(avg.toFixed(1))



        dashboardData.overview = {
            total_patients: total_patients,
            total_male: total_male,
            total_female: total_female,
            Percentage_Under18: Percentage_Under18,
            mortality_rate: mortality_rate,
            avg_inicial_states: avg_inicial_states,
            male_percentage: parseFloat(((total_male / total_patients) * 100).toFixed(1)),
            female_percentage: parseFloat(((total_female / total_patients) * 100).toFixed(1)),
            average_age: average_age,
            period_start: years[0],
            period_end: years[years.length - 1],
            // Calcula os casos de 2024 dos dados processados (afetado por filtros)
            current_year_cases: processedData.filter(d => {
                const ano = parseInt(d.ANODIAG);
                return ano === 2024;
            }).length || processedData.filter(d => {
                const ano = parseInt(d.ANODIAG);
                return ano === 2023;
            }).length
        };

        // 2. Evolução temporal
        const temporalCounts = _.countBy(processedData, 'ANODIAG'); // Usando Lodash
        const sortedYears = _.sortBy(Object.keys(temporalCounts), year => parseInt(year));

        const formatsortedYears = sortedYears.filter(s => s >= 2010 & s < 2025);
        // Usando Lodash - ordenar em ordem crescente (do mais antigo para o mais recente)
        const orderedYears = formatsortedYears.sort((a, b) => parseInt(a) - parseInt(b));
        dashboardData.temporal = {
            years: orderedYears.map(year => parseInt(year)),
            cases: orderedYears.map(year => temporalCounts[year])
        };

        const entries = Object.entries(
            processedData.reduce((acc, { LocalTumorLegendado }) => {
                acc[LocalTumorLegendado] = (acc[LocalTumorLegendado] || 0) + 1;
                return acc;
            }, {})
        ).sort((a, b) => b[1] - a[1]);

        if (!this.filters.tumorSpecific.includes('Outros')) {
            const labels = entries.slice(0, 9).map(([label]) => label);
            const values = entries.slice(0, 9).map(([, value]) => value);

            dashboardData.tumor_types = {
                labels: labels,
                values: values
            };
        } else {
            const other = entries.reduce((sum, [, v]) => sum + v, 0);
            dashboardData.tumor_types = {
                labels: ["Outros"],
                values: [other]
            };
        }

        // 4. Distribuição por faixa etária
        const tumor_types_specific = _.sortBy(_.toPairs(_.countBy(processedData, 'LocalTumorLegendado')), ([label, value]) => parseInt(label.split('-')[0])); // Usando Lodash
        dashboardData.tumor_types_specific = {
            labels: tumor_types_specific.map(item => item[0]),
            values: tumor_types_specific.map(item => item[1])
        };

        const specificFormat = dashboardData.tumor_types_specific.labels
            .map(lbl => ({ label: lbl, value: lbl }))
            .sort((a, b) => a.label.localeCompare(b.label, 'pt', { sensitivity: 'base' }));

        //Atualiza o select
        const tumorSelect = document.querySelector('#tumorFilterSpecific');
        const virtualSelectInstance = tumorSelect.virtualSelect;

        virtualSelectInstance.destroy()
        
        VirtualSelect.init({
            ele: '#tumorFilterSpecific',
            multiple: true,
            search: true,
            showSelectedOptionsFirst: true,
            placeholder: 'Todos os Tumores',
            additionalClasses: 'custom-wrapper',
            searchPlaceholderText: 'Pesquisar...',
            noSearchResultsText: 'Sem Resultados',
            optionsSelectedText: 'Opções Selecionadas',
            optionSelectedText: 'Opção Selecionada',
            disableSelectAll: true,
            options: specificFormat
        });

        // 4. Distribuição por faixa etária
        const ageGroups = _.sortBy(_.toPairs(_.countBy(processedData, 'Cortes_Idade')), ([label, value]) => parseInt(label.split('-')[0])); // Usando Lodash
        dashboardData.age_distribution = {
            labels: ageGroups.map(item => item[0]),
            values: ageGroups.map(item => item[1])
        };

        const marital_status = _.sortBy(_.toPairs(_.countBy(processedData, 'ESTCONAT')), ([label, value]) => parseInt(label.split('-')[0])); // Usando Lodash
        dashboardData.marital_status = {
            labels: marital_status.map(item => item[0]),
            values: marital_status.map(item => item[1])
        };

        const family_history = _.sortBy(_.toPairs(_.countBy(processedData, 'HISTFAMC')), ([label, value]) => parseInt(label.split('-')[0])); // Usando Lodash
        dashboardData.family_history = {
            labels: family_history.map(item => item[0]),
            values: family_history.map(item => item[1])
        };
        // 5. Fatores de risco
        dashboardData.risk_factors = {
            smoking: _.countBy(processedData, 'TABAGISM'), // Usando Lodash
            alcohol: _.countBy(processedData, 'ALCOOLIS'), // Usando Lodash
            family_history: _.countBy(processedData, 'HISTFAMC') // Usando Lodash
        };

        // 6. Distribuição geográfica (top 10 cidades)
        const cities = _.sortBy(_.toPairs(_.countBy(processedData, 'CIDADE')), ([key, value]) => -value).slice(0, 10); // Usando Lodash
        dashboardData.geographic = {
            cities: cities.map(item => item[0]),
            cases: cities.map(item => item[1])
        };


        const stagingSolo = _.sortBy(_.toPairs(_.countBy(processedData, 'ESTADIAM')), ([key, value]) => -value); // Usando Lodash
        dashboardData.stagingSolo = {
            labels: stagingSolo.map(item => item[0]),
            values: stagingSolo.map(item => item[1])
        };

        // 9. Estadiamento por ano - dados mais precisos
        const validStages = ['0', 'I', 'II', 'III', 'IV'];
        const dfValidStaging = processedData.filter(d => validStages.includes(d.ESTADIAM));

        const stagingByYearData = {
            years: [],
            stages: validStages,
            percentages: {},
            counts: {}
        };

        const uniqueYears = _.sortBy(_.uniq(_.map(dfValidStaging, 'ANODIAG'))); // Usando Lodash
        const formatUniqueYears = uniqueYears.filter(u => u >= 2010 & u < 2025);
        stagingByYearData.years = formatUniqueYears;

        for (const year of uniqueYears) {
            const yearData = dfValidStaging.filter(d => d.ANODIAG === year);
            const totalYear = yearData.length;
            stagingByYearData.counts[year] = totalYear;
            stagingByYearData.percentages[year] = {};

            for (const stage of validStages) {
                const stageCount = yearData.filter(d => d.ESTADIAM === stage).length;


                const percentage = totalYear > 0 ? parseFloat(((stageCount / totalYear) * 100).toFixed(1)) : 0;
                stagingByYearData.percentages[year][stage] = { percentage: percentage, numberEstadiam: stageCount };
            }
        }
        dashboardData.staging_by_year = stagingByYearData;



        let states = _.sortBy(_.toPairs(_.countBy(processedData, 'UF')), ([key, value]) => -value);// Usando Lodash

        dashboardData.states = {
            labels: states.map(item => item[0]),
            values: states.map(item => item[1])
        };

        // 11. Contagem de obitos
        let obitsGroup = _.sortBy(_.toPairs(_.countBy(processedData, 'OBITO_CA')), ([key, value]) => -value); // Usando Lodash

        dashboardData.numberObits = {
            labels: obitsGroup.map(item => item[0]),
            values: obitsGroup.map(item => item[1])
        };

        // 12. Nivel de escolaridade
        const level_education = _.sortBy(_.toPairs(_.countBy(processedData, 'INSTRUC')), ([key, value]) => -value); // Usando Lodash

        // Definir a ordem desejada
        const ordemEscolaridade = [
            'Analfabeto',
            'Fundamental Incompleto',
            'Fundamental Completo',
            'Nível Médio',
            'Nível Superior Incompleto',
            'Nível Superior Completo',
            'Sem Informação'
        ];

        level_education.sort((a, b) => ordemEscolaridade.indexOf(a[0]) - ordemEscolaridade.indexOf(b[0]))

        dashboardData.level_education = {
            labels: level_education.map(item => item[0]),
            values: level_education.map(item => item[1])
        }

        // Etinia
        const race = _.sortBy(_.toPairs(_.countBy(processedData, 'RACACOR')), ([key, value]) => -value); // Usando Lodash

        dashboardData.race = {
            labels: race.map(item => item[0]),
            values: race.map(item => item[1])
        }

        // 11. Status de tratamento
        const treatmentStatus = _.sortBy(_.toPairs(_.countBy(processedData, 'ESTDFIMT')), ([key, value]) => -value); // Usando Lodash
        dashboardData.treatment_status = {
            labels: treatmentStatus.map(item => item[0]),
            values: treatmentStatus.map(item => item[1])
        };

        // 12. Tipos histológicos mais comuns (top 10)
        const histology = _.sortBy(_.toPairs(_.countBy(processedData, 'TIPOHIST')), ([key, value]) => -value).slice(0, 10); // Usando Lodash
        dashboardData.histology = {
            labels: histology.map(item => item[0]),
            values: histology.map(item => item[1])
        };

        // 13. Ocupações mais afetadas (top 10)
        const occupations = _.sortBy(_.toPairs(_.countBy(processedData, 'OCUPACAO')), ([key, value]) => -value).slice(0, 10); // Usando Lodash
        dashboardData.occupations = {
            labels: occupations.map(item => item[0]),
            values: occupations.map(item => item[1])
        };

        // 14. Distribuição por sexo e tipo de tumor (top 5 tumores)
        const topTumors = _.map(_.sortBy(_.toPairs(_.countBy(processedData, 'LocalTumorLegendado')), ([key, value]) => -value).slice(0, 5), item => item[0]); // Usando Lodash
        const genderTumorData = [];
        for (const tumor of topTumors) {
            const tumorData = processedData.filter(d => d.LocalTumorLegendado === tumor);
            genderTumorData.push({
                tumor: tumor,
                male: tumorData.filter(d => d.SEXO === 'Masculino').length,
                female: tumorData.filter(d => d.SEXO === 'Feminino').length
            });
        }
        dashboardData.gender_tumor = genderTumorData;

        return dashboardData;
    }

    setupEventListeners() {
        // Filtros
        document.getElementById('periodFilter').addEventListener('change', (e) => {
            this.filters.period = e.target.value;
            this.applyFilters();
        });

        document.getElementById('regionFilter').addEventListener('change', (e) => {
            let value = e.target.value;
            this.filters.region = value;
            this.applyFilters();
        });

        document.getElementById('tumorFilterSpecific').addEventListener('change', (e) => {
            this.filters.tumorSpecific = e.target.value;
            this.applyFilters();
        });

        document.getElementById('sexFilter').addEventListener('change', (e) => {
            this.filters.sex = e.target.value;
            this.applyFilters();
        });

        document.getElementById('estadiamFilter').addEventListener('change', (e) => {
            this.filters.estadiam = e.target.value;
            this.applyFilters();
        });

        document.getElementById('cityFilter').addEventListener('change', (e) => {
            this.filters.city = e.target.value;
            this.applyFilters();
        });

        document.getElementById('tumorFilterGeneral').addEventListener('change', (e) => {
            this.filters.tumorGeneral = e.target.value;
            if (Array.isArray(e.target.value) && e.target.value.length === 0) {
                
                console.log('ssss')
                const specificFormat = this.data.tumor_types_specific.labels
                    .map(lbl => ({ label: lbl, value: lbl }))
                    .sort((a, b) => a.label.localeCompare(b.label, 'pt', { sensitivity: 'base' }));
            
                const tumorSelect = document.querySelector('#tumorFilterSpecific');
                const virtualSelectInstance = tumorSelect.virtualSelect;
            
                virtualSelectInstance.destroy();

                VirtualSelect.init({
                    ele: '#tumorFilterSpecific',
                    multiple: true,
                    search: true,
                    showSelectedOptionsFirst: true,
                    placeholder: 'Todos os Tumores',
                    additionalClasses: 'custom-wrapper',
                    searchPlaceholderText: 'Pesquisar...',
                    noSearchResultsText: 'Sem Resultados',
                    optionsSelectedText: 'Opções Selecionadas',
                    optionSelectedText: 'Opção Selecionada',
                    disableSelectAll: true,
                    options: specificFormat
                });

            }
            
            this.applyFilters();
        });

        document.getElementById('ageFilterMin').addEventListener('change', (e) => {
            this.filters.ageMin = e.target.value;
            this.applyFilters();
        });

        document.getElementById('ageFilterMax').addEventListener('change', (e) => {
            this.filters.ageMax = e.target.value;
            this.applyFilters();
        });

        // Toggle dos filtros
        const toggleBtn = document.getElementById('toggleFilters');
        const filtersContent = document.getElementById('filtersContent');
        const toggleIcon = document.getElementById('toggleIcon');
        
        if (toggleBtn && filtersContent && toggleIcon) {
            toggleBtn.addEventListener('click', () => {
                const isCollapsed = filtersContent.classList.contains('collapsed');
                
                if (isCollapsed) {
                    filtersContent.classList.remove('collapsed');
                    toggleIcon.style.transform = 'rotate(0deg)';
                } else {
                    filtersContent.classList.add('collapsed');
                    toggleIcon.style.transform = 'rotate(-90deg)';
                }
            });
        }
    }

    populateFilters() {
        // 🔹 Tumores específicos — ordem alfabética
        const specificFormat = this.data.tumor_types_specific.labels
            .map(lbl => ({ label: lbl, value: lbl }))
            .sort((a, b) => a.label.localeCompare(b.label, 'pt', { sensitivity: 'base' }));

        VirtualSelect.init({
            ele: '#tumorFilterSpecific',
            multiple: true,
            search: true,
            showSelectedOptionsFirst: true,
            placeholder: 'Todos os Tumores',
            additionalClasses: 'custom-wrapper',
            searchPlaceholderText: 'Pesquisar...',
            noSearchResultsText: 'Sem Resultados',
            optionsSelectedText: 'Opções Selecionadas',
            optionSelectedText: 'Opção Selecionada',
            disableSelectAll: true,
            options: specificFormat
        });

        // 🔹 Tumores gerais — ordem alfabética
        const generalFormat = this.data.tumor_types_general.labels
            .map(lbl => ({ label: lbl, value: lbl }))
            .sort((a, b) => a.label.localeCompare(b.label, 'pt', { sensitivity: 'base' }));

        VirtualSelect.init({
            ele: '#tumorFilterGeneral',
            multiple: true,
            search: true,
            showSelectedOptionsFirst: true,
            placeholder: 'Todos os Tumores',
            additionalClasses: 'custom-wrapper',
            searchPlaceholderText: 'Pesquisar...',
            noSearchResultsText: 'Sem Resultados',
            optionsSelectedText: 'Opções Selecionadas',
            optionSelectedText: 'Opção Selecionada',
            disableSelectAll: true,
            options: generalFormat
        });

        // 🔹 Regiões — ordem alfabética
        const regionFormat = this.data.regions.label
            .map(lbl => ({ label: lbl, value: lbl }))
            .sort((a, b) => a.label.localeCompare(b.label, 'pt', { sensitivity: 'base' }));

        VirtualSelect.init({
            ele: '#regionFilter',
            multiple: true,
            search: true,
            showSelectedOptionsFirst: true,
            placeholder: 'Todas as Regiões',
            additionalClasses: 'custom-wrapper',
            searchPlaceholderText: 'Pesquisar...',
            noSearchResultsText: 'Sem Resultados',
            optionsSelectedText: 'Opções Selecionadas',
            optionSelectedText: 'Opção Selecionada',
            disableSelectAll: true,
            options: regionFormat
        });

        // 🔹 Sexo — fixo
        VirtualSelect.init({
            ele: '#sexFilter',
            multiple: true,
            search: true,
            showSelectedOptionsFirst: true,
            placeholder: 'Todos os Sexos',
            additionalClasses: 'custom-wrapper',
            noSearchResultsText: 'Sem Resultados',
            optionsSelectedText: 'Opções Selecionadas',
            optionSelectedText: 'Opção Selecionada',
            disableSelectAll: true,
            searchPlaceholderText: 'Pesquisar...',
            options: [
                { label: 'Feminino', value: 'Feminino' },
                { label: 'Masculino', value: 'Masculino' }
            ]
        });

        // 🔹 Estadiamento — ordem lógica (já está)
        VirtualSelect.init({
            ele: '#estadiamFilter',
            search: true,
            multiple: true,
            showSelectedOptionsFirst: true,
            placeholder: 'Todos os Estadiamentos',
            additionalClasses: 'custom-wrapper',
            noSearchResultsText: 'Sem Resultados',
            optionsSelectedText: 'Opções Selecionadas',
            additionalDropboxClasses: 'custom-dropbox',
            additionalDropboxContainerClasses: 'custom-dropbox-container',
            optionSelectedText: 'Opção Selecionada',
            additionalToggleButtonClasses: 'custom-toggle-button',
            searchPlaceholderText: 'Pesquisar...',
            disableSelectAll: true,
            options: [
                { label: '0', value: '0' },
                { label: 'I', value: 'I' },
                { label: 'II', value: 'II' },
                { label: 'III', value: 'III' },
                { label: 'IV', value: 'IV' }
            ]
        });

        // 🔹 Faixa etária mínima — ordem crescente numérica
        const ageMinFormat = this.data.age.labels
            .map(lbl => ({ label: lbl, value: lbl }))
            .sort((a, b) => parseInt(a.label) - parseInt(b.label));

        VirtualSelect.init({
            ele: '#ageFilterMin',
            search: true,
            showSelectedOptionsFirst: true,
            placeholder: 'Todas as Idades (Min)',
            additionalClasses: 'custom-wrapper',
            optionsSelectedText: 'Opções Selecionadas',
            noSearchResultsText: 'Sem Resultados',
            optionSelectedText: 'Opção Selecionada',
            searchPlaceholderText: 'Pesquisar...',
            disableSelectAll: true,
            options: ageMinFormat
        });

        // 🔹 Faixa etária máxima — mesma ordenação
        const ageMaxFormat = this.data.age.labels
            .map(lbl => ({ label: lbl, value: lbl }))
            .sort((a, b) => parseInt(b.label) - parseInt(a.label));

        VirtualSelect.init({
            ele: '#ageFilterMax',
            search: true,
            showSelectedOptionsFirst: true,
            placeholder: 'Todas as Idades (Max)',
            optionsSelectedText: 'Opções Selecionadas',
            additionalClasses: 'custom-wrapper',
            noSearchResultsText: 'Sem Resultados',
            searchPlaceholderText: 'Pesquisar...',
            optionSelectedText: 'Opção Selecionada',
            disableSelectAll: true,
            options: ageMaxFormat
        });

        // 🔹 Cidades — ordem alfabética
        const dataCitysFormat = this.data.citys.labels
            .map(lbl => ({ label: lbl, value: lbl }))
            .sort((a, b) => a.label.localeCompare(b.label, 'pt', { sensitivity: 'base' }));

        VirtualSelect.init({
            ele: '#cityFilter',
            multiple: true,
            search: true,
            showSelectedOptionsFirst: true,
            placeholder: 'Todas as Cidades',
            searchPlaceholderText: 'Pesquisar...',
            optionsSelectedText: 'Opções Selecionadas',
            noSearchResultsText: 'Sem Resultados',
            optionSelectedText: 'Opção Selecionada',
            additionalClasses: 'custom-wrapper',
            disableSelectAll: true,
            options: dataCitysFormat
        });

        // 🔹 Períodos — ordem decrescente (anos)
        const periodFormat = this.data.temporal.years
            .sort((a, b) => b - a)
            .map(lbl => ({ label: lbl, value: lbl }));

        VirtualSelect.init({
            ele: '#periodFilter',
            multiple: true,
            search: true,
            showSelectedOptionsFirst: true,
            placeholder: 'Todos os Períodos',
            optionsSelectedText: 'Opções Selecionadas',
            searchPlaceholderText: 'Pesquisar...',
            noSearchResultsText: 'Sem Resultados',
            optionSelectedText: 'Opção Selecionada',
            additionalClasses: 'custom-wrapper',
            disableSelectAll: true,
            options: periodFormat
        });
    }


    updateMetrics() {
        const overview = this.filteredData ? this.filteredData.overview : this.data.overview;

        // Total de pacientes
        this.animateNumber('totalPatients', overview.total_patients);

        // Novos casos (usa os dados filtrados se houver filtros ativos, senão usa o valor fixo)
        const newCasesValue = this.filteredData ? overview.current_year_cases : this.totalNewCases2024;
        this.animateNumber('newCases', newCasesValue);

        this.animateNumber('avgInitialState', overview.avg_inicial_states);

        document.getElementById('avgUnder18').textContent = overview.Percentage_Under18;

        this.animateNumber('mortalityRate', overview.mortality_rate);

        this.animateNumber('mortalityRate', overview.mortality_rate);

        // Pacientes masculinos
        this.animateNumber('malePatients', overview.total_male);
        document.getElementById('malePercentage').textContent = `${overview.male_percentage}%`;
        // document.getElementById('maleProgress').style.width = `${overview.male_percentage}%`;

        // Pacientes femininos
        this.animateNumber('femalePatients', overview.total_female);
        document.getElementById('femalePercentage').textContent = `${overview.female_percentage}%`;
        // document.getElementById('femaleProgress').style.width = `${overview.female_percentage}%`;

        // Idade média
        this.animateNumber('averageAge', overview.average_age, 1);

    }

    animateNumber(elementId, targetValue, decimals = 0) {
        const element = document.getElementById(elementId);
        const startValue = 0;
        const duration = 2000;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = startValue + (targetValue - startValue) * easeOutQuart;

            element.textContent = new Intl.NumberFormat('pt-BR', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(currentValue);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    createCharts() {
        this.createTemporalChart();
        this.createTumorTypesChart();
        this.createAgeDistributionChart();
        this.createRiskFactorsChart();
        this.createOccupationsChart();
        this.createRiskFactorsAlcoholChart()
        this.createTreatmentChart();
        this.populateCitiesTable();
        this.createEstadiamChart();
        this.createObitsChart();
        this.createRaceChart();
        this.createEducationLevelChart();
        this.createMaritalStatusChart();
        this.createFamilyHistoryChart();
        this.createGeograficChart();
    }

    createTemporalChart() {
        const ctx = document.getElementById('temporalChart').getContext('2d');

        const exportBg = this.createBg();

        // Garantir que os anos estejam em ordem crescente (do mais antigo para o mais recente)
        const sortedData = this.data.temporal.years
            .map((year, index) => ({ year, cases: this.data.temporal.cases[index] }))
            .sort((a, b) => a.year - b.year);

        const sortedYears = sortedData.map(d => d.year);
        const sortedCases = sortedData.map(d => d.cases).reverse();

        const temporalChart = this.charts.temporal = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedYears,
                datasets: [{
                    label: 'Casos por Ano',
                    data: sortedCases,
                    borderColor: this.colors.secondary,
                    backgroundColor: this.createGradient(ctx, this.colors.gradients.primary),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: this.colors.primary,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            plugins: [exportBg],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: this.colors.secondary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (context) => `${context.parsed.y.toLocaleString('pt-BR')} casos`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: this.colors.accent.gray
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            callback: (value) => value.toLocaleString('pt-BR')
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
        // botão de download
        this.setupDownloadButton('downloadTemporal', temporalChart, 'gráfico-temporal.png');


        // Adicionar event listener de clique no gráfico de tipos de tumor
        ctx.canvas.addEventListener('click', (e) => {
            const activePoints = temporalChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
            if (activePoints.length > 0) {
                const clickedElementIndex = activePoints[0].index;
                const clickedYear = temporalChart.data.labels[clickedElementIndex];



                // Aplicar o filtro de tumor
                if (this.filters.period.includes(String(clickedYear))) {
                    // Se o mesmo tumor foi clicado novamente, limpar o filtro
                    this.filters.period = [];

                } else {
                    if (!this.filters.period.includes(String(clickedYear))) {
                        this.filters.period.push(String(clickedYear));
                    }
                }
                this.applyFilters();
            }

        })
    }

    createTumorTypesChart() {
        const ctx = document.getElementById('tumorTypesChart').getContext('2d');

        const exportBg = this.createBg();

        const tumorType = this.charts.tumorTypes = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.data.tumor_types.labels,
                datasets: [{
                    label: 'Número de Casos',
                    data: this.data.tumor_types.values,
                    backgroundColor: this.generateColorPalette(this.data.tumor_types.labels.length),
                    borderColor: this.colors.primary,
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            plugins: [exportBg],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: this.colors.secondary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (context) => `${context.parsed.x.toLocaleString('pt-BR')} casos`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            callback: (value) => value.toLocaleString('pt-BR')
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            maxTicksLimit: 10,
                            callback: function (value, index, ticks) {
                                const label = this.getLabelForValue(value);
                                // Se o nome tiver mais que 30 caracteres, corta e adiciona "..."
                                return label.length > 20 ? label.substring(0, 20) + "..." : label;
                            }
                        }
                    },
                    y1: { // eixo extra à direita (dinâmico)
                        position: 'right',
                        ticks: {
                            callback: function (_, index, ticks) {
                                const chart = this.chart;
                                const dataset = chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = dataset[index];
                                if (!value || total === 0) return '';
                                return ((value / total) * 100).toFixed(1) + '%';
                            },
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
        // botão de download
        this.setupDownloadButton('downloadTumorTypes', tumorType, 'gráfico-Tipos-de-Tumor.png');


        // Adicionar event listener de clique no gráfico de tipos de tumor
        ctx.canvas.addEventListener('click', (e) => {
            const activePoints = tumorType.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
            if (activePoints.length > 0) {
                const clickedElementIndex = activePoints[0].index;
                const clickedTumor = tumorType.data.labels[clickedElementIndex];

                // Aplicar o filtro de tumor
                if (this.filters.tumorSpecific.includes(String(clickedTumor))) {
                    // Se o mesmo tumor foi clicado novamente, limpar o filtro
                    this.filters.tumorSpecific = [];

                } else {
                    if (!this.filters.tumorSpecific.includes(String(clickedTumor))) {
                        this.filters.tumorSpecific.push(String(clickedTumor));
                    }
                }
                this.applyFilters();
            }

        })
    }

    createAgeDistributionChart() {
        const ctx = document.getElementById('ageDistributionChart').getContext('2d');

        const exportBg = this.createBg();

        const AgeDistribution = this.charts.ageDistribution = new Chart(ctx, {
            type: 'bar', // Mudança de 'doughnut' para 'bar'
            data: {
                labels: this.data.age_distribution.labels,
                datasets: [{
                    data: this.data.age_distribution.values,
                    backgroundColor: this.generateColorPalette(this.data.age_distribution.labels.length),
                    borderColor: this.generateColorPalette(this.data.age_distribution.labels.length),
                    borderWidth: 1,
                    borderRadius: 4, // Adiciona bordas arredondadas nas barras
                    hoverBackgroundColor: this.generateColorPalette(this.data.age_distribution.labels.length).map(color =>
                        color.replace('0.8', '1') // Torna as cores mais vibrantes no hover
                    )
                }]
            },
            plugins: [exportBg],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // Remove a legenda pois não é necessária em gráficos de barra
                    },

                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: this.colors.secondary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => `${context.parsed.y.toLocaleString('pt-BR')} casos`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false // Remove as linhas de grade do eixo X
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        beginAtZero: true, // Começa o eixo Y do zero
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: {
                                size: 12
                            },
                            callback: function (value) {
                                return value.toLocaleString('pt-BR'); // Formata os números no eixo Y
                            }
                        }
                    },
                    x1: { // eixo extra à direita (dinâmico)
                        position: 'top',
                        ticks: {
                            callback: function (_, index, ticks) {
                                const chart = this.chart;
                                const dataset = chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = dataset[index];
                                if (!value || total === 0) return '';
                                return ((value / total) * 100).toFixed(1) + '%';
                            },
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        },
                        grid: { drawOnChartArea: false }
                    }
                }
                // Remove cutout pois não é aplicável em gráficos de barra
            }
        });
        // botão de download
        this.setupDownloadButton('downloadAgeDistribution', AgeDistribution, 'gráfico-Distribuição-por-Faixa-Etária.png');

        this.filterDataByCharSelection(ctx, AgeDistribution, 'age');

    }

    createEducationLevelChart() {
        const ctx = document.getElementById('educationChart').getContext('2d');

        const exportBg = this.createBg();

        const educationLevel = this.charts.educationLevel = new Chart(ctx, {
            type: 'bar', // Mudança de 'doughnut' para 'bar'
            data: {
                labels: this.data.level_education.labels,
                datasets: [{
                    data: this.data.level_education.values,
                    backgroundColor: this.generateColorPalette(this.data.level_education.labels.length),
                    borderColor: this.generateColorPalette(this.data.level_education.labels.length),
                    borderWidth: 1,
                    borderRadius: 4, // Adiciona bordas arredondadas nas barras
                    hoverBackgroundColor: this.generateColorPalette(this.data.level_education.labels.length).map(color =>
                        color.replace('0.8', '1') // Torna as cores mais vibrantes no hover
                    )
                }]
            },
            plugins: [exportBg],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // Remove a legenda pois não é necessária em gráficos de barra
                    },

                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: this.colors.secondary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => `${context.parsed.y.toLocaleString('pt-BR')} casos`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false // Remove as linhas de grade do eixo X
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        beginAtZero: true, // Começa o eixo Y do zero
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: {
                                size: 12
                            },
                            callback: function (value) {
                                return value.toLocaleString('pt-BR'); // Formata os números no eixo Y
                            }
                        }
                    },
                    x1: { // eixo extra à direita (dinâmico)
                        position: 'top',
                        ticks: {
                            callback: function (_, index, ticks) {
                                const chart = this.chart;
                                const dataset = chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = dataset[index];
                                if (!value || total === 0) return '';
                                return ((value / total) * 100).toFixed(1) + '%';
                            },
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        },
                        grid: { drawOnChartArea: false }
                    }

                }
                // Remove cutout pois não é aplicável em gráficos de barra
            }
        });
        // botão de download
        this.setupDownloadButton('downloadEducationLevel', educationLevel, 'gráfico-Nivel-de-Educação.png');

        this.filterDataByCharSelection(ctx, educationLevel, 'education');
    }

    createFamilyHistoryChart() {
        const ctx = document.getElementById('familyHistoryChart').getContext('2d');

        const exportBg = this.createBg();

        const family = this.charts.familyHistory = new Chart(ctx, {
            type: 'bar', // Mudança de 'doughnut' para 'bar'
            data: {
                labels: this.data.family_history.labels,
                datasets: [{
                    data: this.data.family_history.values,
                    backgroundColor: this.generateColorPalette(this.data.family_history.labels.length),
                    borderColor: this.generateColorPalette(this.data.family_history.labels.length),
                    borderWidth: 1,
                    borderRadius: 4, // Adiciona bordas arredondadas nas barras
                    hoverBackgroundColor: this.generateColorPalette(this.data.family_history.labels.length).map(color =>
                        color.replace('0.8', '1') // Torna as cores mais vibrantes no hover
                    )
                }]
            },
            plugins: [exportBg],
            options: {
                indexAxis: 'x',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // Remove a legenda pois não é necessária em gráficos de barra
                    },

                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: this.colors.secondary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => `${context.parsed.y.toLocaleString('pt-BR')} casos`
                        }
                    }
                },
                scales: {

                    x: {
                        grid: {
                            display: false // Remove as linhas de grade do eixo X
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        beginAtZero: true, // Começa o eixo Y do zero
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: {
                                size: 12
                            },
                            callback: function (value) {
                                return value.toLocaleString('pt-BR'); // Formata os números no eixo Y
                            }
                        }
                    },
                    x1: { // eixo extra à direita (dinâmico)
                        position: 'top',
                        ticks: {
                            callback: function (_, index, ticks) {
                                const chart = this.chart;
                                const dataset = chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = dataset[index];
                                if (!value || total === 0) return '';
                                return ((value / total) * 100).toFixed(1) + '%';
                            },
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        },
                        grid: { drawOnChartArea: false }
                    }
                }
                // Remove cutout pois não é aplicável em gráficos de barra
            }
        });
        // botão de download
        this.setupDownloadButton('downloadFamilyHistory', family, 'gráfico-Histórico-familiar.png');

        this.filterDataByCharSelection(ctx, family, 'familyHistory');
    }

    createRaceChart() {
        const ctx = document.getElementById('raceChart').getContext('2d');

        const exportBg = this.createBg();

        const race = this.charts.race = new Chart(ctx, {
            type: 'bar', // Mudança de 'doughnut' para 'bar'
            data: {
                labels: this.data.race.labels,
                datasets: [{
                    data: this.data.race.values,
                    backgroundColor: this.generateColorPalette(this.data.race.labels.length),
                    borderColor: this.generateColorPalette(this.data.race.labels.length),
                    borderWidth: 1,
                    borderRadius: 4, // Adiciona bordas arredondadas nas barras
                    hoverBackgroundColor: this.generateColorPalette(this.data.race.labels.length).map(color =>
                        color.replace('0.8', '1') // Torna as cores mais vibrantes no hover
                    )
                }]
            },
            plugins: [exportBg],
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // Remove a legenda pois não é necessária em gráficos de barra
                    },

                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: this.colors.secondary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => `${context.parsed.x.toLocaleString('pt-BR')} casos`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true, // Começa o eixo Y do zero
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: {
                                size: 12
                            },
                            callback: function (value) {
                                return value.toLocaleString('pt-BR'); // Formata os números no eixo Y
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false // Remove as linhas de grade do eixo X
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: {
                                size: 12
                            }
                        }
                    },
                    y1: { // eixo extra à direita (dinâmico)
                        position: 'right',
                        ticks: {
                            callback: function (_, index, ticks) {
                                const chart = this.chart;
                                const dataset = chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = dataset[index];
                                if (!value || total === 0) return '';
                                return ((value / total) * 100).toFixed(1) + '%';
                            },
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        },
                        grid: { drawOnChartArea: false }
                    }
                }
                // Remove cutout pois não é aplicável em gráficos de barra
            }
        });
        // botão de download
        this.setupDownloadButton('downloadRace', race, 'gráfico-Etinia.png');

        this.filterDataByCharSelection(ctx, race, 'race');
    }

    createOccupationsChart() {
        const ctx = document.getElementById('occupationsChart').getContext('2d');

        const exportBg = this.createBg();

        const labels = this.data.occupations.labels;

        const occupations = this.charts.occupations = new Chart(ctx, {
            type: 'bar', // Mudança de 'doughnut' para 'bar'
            data: {
                labels: labels,
                datasets: [{
                    data: this.data.occupations.values,
                    backgroundColor: this.generateColorPalette(this.data.occupations.labels.length),
                    borderColor: this.generateColorPalette(this.data.occupations.labels.length),
                    borderWidth: 1,
                    borderRadius: 4, // Adiciona bordas arredondadas nas barras
                    hoverBackgroundColor: this.generateColorPalette(this.data.occupations.labels.length).map(color =>
                        color.replace('0.8', '1') // Torna as cores mais vibrantes no hover
                    )
                }]
            },
            plugins: [exportBg],
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // Remove a legenda pois não é necessária em gráficos de barra
                    },

                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: this.colors.secondary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => `${context.parsed.x.toLocaleString('pt-BR')} casos`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true, // Começa o eixo Y do zero
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: {
                                size: 12
                            },
                            callback: function (value) {
                                return value.toLocaleString('pt-BR'); // Formata os números no eixo Y
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false // Remove as linhas de grade do eixo X
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: {
                                size: 12
                            },
                            callback: function (value, index, ticks) {
                                const label = this.getLabelForValue(value);
                                // Se o nome tiver mais que 30 caracteres, corta e adiciona "..."
                                return label.length > 30 ? label.substring(0, 30) + "..." : label;
                            }
                        }
                    },
                    y1: { // eixo extra à direita (dinâmico)
                        position: 'right',
                        ticks: {
                            callback: function (_, index, ticks) {
                                const chart = this.chart;
                                const dataset = chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = dataset[index];
                                if (!value || total === 0) return '';
                                return ((value / total) * 100).toFixed(1) + '%';
                            },
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        },
                        grid: { drawOnChartArea: false }
                    }
                }
                // Remove cutout pois não é aplicável em gráficos de barra
            }
        });
        // botão de download
        this.setupDownloadButton('downloadOccupations', occupations, 'gráfico-Ocupação.png');

        this.filterDataByCharSelection(ctx, occupations, 'occupations');
    }

    createMaritalStatusChart() {
        const ctx = document.getElementById('maritalStatusChart').getContext('2d');
        const exportBg = this.createBg();

        const values = this.data.marital_status.values;
        const labels = this.data.marital_status.labels;

        const maritalStatus = this.charts.maritalStatus = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: this.generateColorPalette(labels.length),
                    borderColor: this.generateColorPalette(labels.length),
                    borderWidth: 1,
                    borderRadius: 4,
                    hoverBackgroundColor: this.generateColorPalette(this.data.family_history.labels.length).map(color =>
                        color.replace('0.8', '1')
                    )
                }]
            },
            plugins: [exportBg],
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: this.colors.secondary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                const dataset = context.chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = context.parsed.x;
                                const percent = ((value / total) * 100).toFixed(1);
                                return `${value.toLocaleString('pt-BR')} casos (${percent}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: { size: 12 },
                            callback: function (value) {
                                return value.toLocaleString('pt-BR');
                            }
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        }
                    },
                    y1: { // eixo extra à direita (dinâmico)
                        position: 'right',
                        ticks: {
                            callback: function (_, index, ticks) {
                                const chart = this.chart;
                                const dataset = chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = dataset[index];
                                if (!value || total === 0) return '';
                                return ((value / total) * 100).toFixed(1) + '%';
                            },
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });

        this.setupDownloadButton('downloadMaritalStatus', maritalStatus, 'gráfico-Estado-Civil.png');
        this.filterDataByCharSelection(ctx, maritalStatus, 'maritalStatus');
    }


    createGeograficChart() {
        // Verificar se o gráfico já foi criado para evitar recriação
        if (this.charts.geograficChart) {
            return;
        }

        const exportBg = this.createBg();

        const ctx = document.getElementById("geograficChart").getContext("2d");

        // Usar os dados do GeoJSON já carregados
        const brasil = this.brasilGeoJSON;

        // Pré-processar dados para evitar recálculos
        const preprocessedData = brasil.features.map((feature) => {
            const index = this.data.states.labels.indexOf(feature.properties.name);
            return {
                feature,
                value: index !== -1 ? this.data.states.values[index] : 0
            };
        });

        // Cache para cores para evitar recálculos
        const colorCache = new Map();
        const getColor = (value) => {
            if (colorCache.has(value)) {
                return colorCache.get(value);
            }
            let color;
            if (value > 10000) color = "#1a3866";
            else if (value > 500) color = "#0095da";
            else if (value >= 1) color = "#4ecdc4";
            else color = "#f0f0f0";
            colorCache.set(value, color);
            return color;
        };

        const getHoverColor = (value) => {
            if (value > 10000) return "#2a4a7a";
            if (value > 500) return "#00b4ff";
            if (value >= 1) return "#5edfd7";
            return "#e0e0e0";
        };

        const geograficChart = this.charts.geograficChart = new Chart(ctx, {
            type: "choropleth",
            plugins: [exportBg],
            data: {
                datasets: [{
                    label: "Casos por Região",
                    outline: brasil.features,
                    showOutline: true,
                    backgroundColor: (ctx) => {
                        const item = ctx.dataset.data[ctx.dataIndex];
                        const value = item ? item.value : 0;
                        return getColor(value);
                    },
                    hoverBackgroundColor: (ctx) => {
                        const item = ctx.dataset.data[ctx.dataIndex];
                        const value = item ? item.value : 0;
                        return getHoverColor(value);
                    },
                    data: preprocessedData
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0 // Desabilitar animações para melhor performance
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        align: "center",
                        formatter: (v) => v.feature.properties.name
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#0095da',
                        borderWidth: 2,
                        cornerRadius: 10,
                        displayColors: false,
                        padding: 12,
                        callbacks: {
                            title: (tooltipItems) => {
                                const item = tooltipItems[0];
                                return item.raw.feature.properties.name;
                            },
                            label: (tooltipItem) => {
                                const value = tooltipItem.raw.value;
                                return 'Casos: ' + value.toLocaleString('pt-BR');
                            }
                        }
                    }
                },
                scales: {
                    projection: {
                        axis: "x",
                        projection: "mercator"
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                }
            }
        });

        // Implementar debouncing para o event listener de hover
        let hoverTimeout;
        const canvas = document.getElementById("geograficChart");

        const debouncedHoverHandler = (event) => {
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => {
                const rect = canvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                // Verificar se o mouse está sobre um estado
                const elements = geograficChart.getElementsAtEventForMode(
                    { x, y },
                    'nearest',
                    { intersect: true },
                    false
                );

                if (elements.length > 0) {
                    canvas.style.cursor = 'pointer';
                } else {
                    canvas.style.cursor = 'default';
                }
            }, 16); // ~60fps
        };

        canvas.addEventListener('mousemove', debouncedHoverHandler, { passive: true });

        // botão de download
        this.setupDownloadButton('downloadGeografic', geograficChart, 'gráfico-Análise-de-Geográfico.png');

        // Adicionar event listener de clique no gráfico geográfico com debouncing
        let clickTimeout;
        ctx.canvas.addEventListener('click', (e) => {
            if (clickTimeout) return; // Prevenir múltiplos cliques

            clickTimeout = setTimeout(() => {
                const activePoints = geograficChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
                if (activePoints.length > 0) {
                    const clickedElementIndex = activePoints[0].index;
                    const clickedState = geograficChart.data.datasets[0].data[clickedElementIndex].feature.properties.name;


                    // Aplicar o filtro de estado
                    if (this.filters.geografic === clickedState) {
                        // Se o mesmo estado foi clicado novamente, limpar o filtro
                        this.filters.geografic = 'all';
                    } else {
                        this.filters.geografic = clickedState;
                    }
                    this.applyFilters();
                }
                clickTimeout = null;
            }, 100);
        });

        // Armazenar referências para cleanup posterior
        this.geograficChartEventListeners = {
            hover: debouncedHoverHandler,
            canvas: canvas
        };

        // Armazenar o observer para cleanup posterior
        //this.geograficChartObserver = observer;
    }

    createRiskFactorsChart() {
        const ctx = document.getElementById('riskFactorsChart').getContext('2d');

        const exportBg = this.createBg();
        // Preparar dados dos fatores de risco
        const smokingData = this.data.risk_factors.smoking;

        const categories = ['Nunca', 'Sim', 'Ex-fumante'];
        const smokingValues = [
            smokingData['Nunca'] || 0,
            smokingData['Sim'] || 0,
            (smokingData['Ex-fumante'] || 0) + (smokingData['Ex-consumidor'] || 0)
        ];


        const riskFactors = this.charts.riskFactors = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories,
                datasets: [
                    {
                        label: 'Tabagismo',
                        data: smokingValues,
                        backgroundColor: this.colors.accent.green,
                        borderColor: this.colors.accent.green,
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            plugins: [exportBg],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: this.colors.secondary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y.toLocaleString('pt-BR')} casos`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: this.colors.accent.gray
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            callback: (value) => value.toLocaleString('pt-BR')
                        }
                    },
                    x1: { // eixo extra à direita (dinâmico)
                        position: 'top',
                        ticks: {
                            callback: function (_, index, ticks) {
                                const chart = this.chart;
                                const dataset = chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = dataset[index];
                                if (!value || total === 0) return '';
                                return ((value / total) * 100).toFixed(1) + '%';
                            },
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
        // botão de download
        this.setupDownloadButton('downloadRiskFactors', riskFactors, 'gráfico-Análise-de-tabagismo.png');
        // Adicionar event listener de clique no gráfico de fatores de risco (Tabagismo)
        this.filterDataByCharSelection(ctx, riskFactors, 'smoking');

    }
    createRiskFactorsAlcoholChart() {
        const ctx = document.getElementById('riskFactorsAlcolChart').getContext('2d');

        const exportBg = this.createBg();

        // Preparar dados dos fatores de risco
        const alcoholData = this.data.risk_factors.alcohol;

        const categories = ['Nunca', 'Sim', 'Ex-consumidor'];

        const alcoholValues = [
            alcoholData['Nunca'] || 0,
            alcoholData['Sim'] || 0,
            alcoholData['Ex-consumidor'] || 0
        ];

        const Alcol = this.charts.riskFactorsAlcoholChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories,
                datasets: [
                    {
                        label: 'Alcoolismo',
                        data: alcoholValues,
                        backgroundColor: this.colors.accent.yellow,
                        borderColor: this.colors.accent.yellow,
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            plugins: [exportBg],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: this.colors.secondary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y.toLocaleString('pt-BR')} casos`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: this.colors.accent.gray
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            callback: (value) => value.toLocaleString('pt-BR')
                        }
                    },
                    x1: { // eixo extra à direita (dinâmico)
                        position: 'top',
                        ticks: {
                            callback: function (_, index, ticks) {
                                const chart = this.chart;
                                const dataset = chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = dataset[index];
                                if (!value || total === 0) return '';
                                return ((value / total) * 100).toFixed(1) + '%';
                            },
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        },
                        grid: { drawOnChartArea: false }
                    }
                }
            }

        });
        // botão de download
        this.setupDownloadButton('downloadAlcol', Alcol, 'gráfico-Análise-de-Alcoolismo.png');

        this.filterDataByCharSelection(ctx, Alcol, 'alcohol');

    }

    createEstadiamChart() {
        const ctx = document.getElementById('EstadiamChart').getContext('2d');

        // Plugin para exibir rótulos de porcentagem no centro de cada segmento
        const stackPercentageLabels = {
            id: 'stackPercentageLabels',
            afterDatasetsDraw(chart, args, pluginOptions) {
                const { ctx } = chart;
                ctx.save();
                const fontSize = 14; // Aumentei o tamanho da fonte para a porcentagem
                ctx.font = `${fontSize}px Inter, Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    meta.data.forEach((bar, index) => {
                        const value = Number(dataset.data[index] ?? 0);
                        if (!isFinite(value) || value <= 0) return;
                        const props = bar.getProps(['x', 'y', 'base'], true);
                        const x = props.x;
                        const y = props.y + (props.base - props.y) / 2;
                        ctx.fillStyle = '#ffffff';
                        const label = `${value.toFixed(1)}%`;
                        ctx.fillText(label, x, y);
                    });
                });
                ctx.restore();
            }
        };

        const exportBg = this.createBg();

        // Usar dados reais de estadiamento por ano (mais precisos)
        const stagingByYear = this.data.staging_by_year;
        if (stagingByYear && stagingByYear.percentages) {
            const datasets = stagingByYear.stages.map((stage, index) => {
                const dataByYear = stagingByYear.years.map(year => {
                    // agora cada item do ano tem percentage e numberEstadiam
                    const obj = stagingByYear.percentages[year][stage] || { percentage: 0, numberEstadiam: 0 };
                    return obj;
                });

                return {
                    label: `Estágio ${stage}`,
                    data: dataByYear.map(d => d.percentage), // Chart.js precisa só dos números
                    metaData: dataByYear, // guardamos os objetos completos para tooltip
                    backgroundColor: [
                        '#4A90E2', '#FF6F61', '#E94E4E', '#A62323', '#8B0000'
                    ][index],
                    borderColor: '#ffffff',
                    borderWidth: 1,
                    borderRadius: 2
                };
            });

            // Atualizar labels para usar anos dos dados de estadiamento
            const chartLabels = stagingByYear.years;

            // Chamar o novo método para atualizar as informações de estadiamento solo
            this.updateStagingSoloInfo(this.data.stagingSolo); // Usar dados originais para a criação

            const estadiamChart = this.charts.stagingByYear = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: datasets

                },
                plugins: [stackPercentageLabels, exportBg],
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: 1,
                    layout: {
                        padding: {
                            top: 10,
                            bottom: 10,
                            left: 10,
                            right: 10
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                padding: 20,
                                color: this.colors.accent.gray,
                                font: {
                                    size: 13
                                }
                            }
                        },
                        tooltip: {
                            mode: 'nearest',
                            intersect: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: this.colors.secondary,
                            borderWidth: 1,
                            cornerRadius: 8,
                            callbacks: {
                                label: (context) => {
                                    const stage = context.dataset.label;
                                    const dataPoint = context.dataset.metaData?.[context.dataIndex];
                                    const percentage = dataPoint?.percentage ?? 0;
                                    const cases = dataPoint?.numberEstadiam ?? 0;
                                    return `${stage}: ${percentage.toFixed(1)}% (${cases} casos)`;
                                },
                            },
                        },
                        stackPercentageLabels: {}
                    },
                    scales: {
                        x: {
                            stacked: true,
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: this.colors.accent.gray,
                                font: {
                                    size: 14 // Aumentei o tamanho da fonte para os anos
                                }
                            }
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            max: 100,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)',
                                drawBorder: false
                            },
                            ticks: {
                                color: this.colors.accent.gray,
                                font: {
                                    size: 14
                                },
                                callback: function (value) {
                                    return value + '%';
                                }
                            }
                        }
                    }
                }
            });

            // botão de download
            this.setupDownloadButton('downloadEstadiamG', estadiamChart, 'gráfico-Estadiamento.png');
        }
        // Adicionar event listener de clique no gráfico de estadiamento por ano
        if (this.charts.stagingByYear) { // Garantir que o gráfico foi criado antes de adicionar o listener
            ctx.canvas.addEventListener('click', (e) => {
                const activePoints = this.charts.stagingByYear.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
                if (activePoints.length > 0) {
                    const clickedElementIndex = activePoints[0].index;
                    const datasetIndex = activePoints[0].datasetIndex;
                    const clickedYear = this.charts.stagingByYear.data.labels[clickedElementIndex];
                    const clickedStage = this.charts.stagingByYear.data.datasets[datasetIndex].label.replace('Estágio ', '');

                    const currentYearFilter = this.filters.period;
                    const currentStageFilter = this.filters.stagingByYear;

                    // Elemento do select de período para atualização visual
                    const periodSelect = document.getElementById('periodFilter');

                    // Lógica para aplicar/limpar filtro combinado
                    if (currentYearFilter.includes(String(clickedYear)) && currentStageFilter.includes(clickedStage)) {
                        // Se o mesmo ano e estágio foram clicados novamente, limpar ambos os filtros
                        this.filters.period = [];
                        this.filters.stagingByYear = 'all';
                        periodSelect.value = 'all'; // Atualizar o select
                    } else {
                        if (!currentYearFilter.includes(String(clickedYear))) {
                            this.filters.period.push(String(clickedYear));
                        }
                        // Aplicar os novos filtros

                        this.filters.stagingByYear = clickedStage;
                        periodSelect.value = String(clickedYear); // Atualizar o select
                    }
                    this.applyFilters();
                }
            });
        }
    }

    createTreatmentChart() {
        const ctx = document.getElementById('treatmentChart').getContext('2d');

        const exportBg = this.createBg();

        const treatment = this.charts.treatment_status = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.data.treatment_status.labels,
                datasets: [
                    {
                        label: 'Tratamento Status',
                        data: this.data.treatment_status.values,
                        backgroundColor: this.generateColorPalette(this.data.treatment_status.labels.length),
                        borderColor: this.generateColorPalette(this.data.treatment_status.labels.length),
                        borderWidth: 1,
                        borderRadius: 4,
                        hoverBackgroundColor: this.generateColorPalette(this.data.treatment_status.labels.length).map(color =>
                            color.replace('0.8', '1')
                        )
                    }]
            },
            plugins: [exportBg],
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: this.colors.secondary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                const dataset = context.chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = context.parsed.x;
                                const percent = ((value / total) * 100).toFixed(1);
                                return `${value.toLocaleString('pt-BR')} casos (${percent}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            color: this.colors.accent.gray,
                            font: { size: 12 },
                            callback: function (value, index, ticks) {
                                const label = this.getLabelForValue(value);
                                // Se o nome tiver mais que 30 caracteres, corta e adiciona "..."
                                return label.length > 20 ? label.substring(0, 20) + "..." : label;
                            }
                        }
                    },
                    y1: { // eixo extra à direita (dinâmico)
                        position: 'right',
                        ticks: {
                            callback: function (_, index, ticks) {
                                const chart = this.chart;
                                const dataset = chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = dataset[index];
                                if (!value || total === 0) return '';
                                return ((value / total) * 100).toFixed(1) + '%';
                            },
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
        // botão de download
        this.setupDownloadButton('downloadTreatment', treatment, 'gráfico-Status-de-Tratamento.png');

        this.filterDataByCharSelection(ctx, treatment, 'stateTratament');

    }
    createObitsChart() {
        const ctx = document.getElementById('obitsChart').getContext('2d');

        const exportBg = this.createBg();

        // Mapear labels: "Sem Informação" vira "Vivo" visualmente
        const labelMap = {
            'Sem Informação': 'Vivo'
        };

        // Processar labels e valores para combinar "Vivo" com "Sem Informação"
        const processedData = {};
        this.data.numberObits.labels.forEach((label, index) => {
            const displayLabel = labelMap[label] || label;
            const value = this.data.numberObits.values[index];
            
            if (processedData[displayLabel]) {
                processedData[displayLabel] += value;
            } else {
                processedData[displayLabel] = value;
            }
        });

        const displayLabels = Object.keys(processedData);
        const displayValues = Object.values(processedData);

        // Cores específicas para óbitos
        const stagingColors = {
            'Vivo': '#88E788',
            'Óbito por Câncer': '#FF2C2C',
            'Óbito por Outras Causas': '#ffa500'
        };

        const colors = displayLabels.map(label => stagingColors[label] || this.colors.primary);

        const numberObits = this.charts.numberObits = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: displayLabels,
                datasets: [
                    {
                        label: 'Óbitos',
                        data: displayValues,
                        backgroundColor: colors,
                        borderColor: '#ffffff',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            plugins: [exportBg],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: this.colors.secondary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => `${context.label}: ${context.parsed.y.toLocaleString('pt-BR')} casos`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: this.colors.accent.gray
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: this.colors.accent.gray,
                            callback: (value) => value.toLocaleString('pt-BR')
                        }
                    },
                    x1: { // eixo extra à direita (dinâmico)
                        position: 'top',
                        ticks: {
                            callback: function (_, index, ticks) {
                                const chart = this.chart;
                                const dataset = chart.data.datasets[0].data;
                                const total = dataset.reduce((a, b) => a + b, 0);
                                const value = dataset[index];
                                if (!value || total === 0) return '';
                                return ((value / total) * 100).toFixed(1) + '%';
                            },
                            color: this.colors.accent.gray,
                            font: { size: 12 }
                        },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
        // botão de download
        this.setupDownloadButton('downloadNumberObts', numberObits, 'gráfico-porcentagem-de-óbitos.png');

        this.filterDataByCharSelection(ctx, numberObits, 'obits')
        // Adicionar event listener de clique no gráfico de estadiamento agrupado

    }

    populateCitiesTable() {
        const tbody = document.querySelector('#citiesTable tbody');
        const dataToUse = this.filteredData || this.data;

        // Se há filtros ativos, mostrar apenas as cidades da região filtrada
        let cities = dataToUse.geographic.cities;
        let cases = dataToUse.geographic.cases;

        const totalCases = cases.reduce((a, b) => a + b, 0);

        tbody.innerHTML = '';

        cities.forEach((city, index) => {
            const cityCases = cases[index];
            const percentage = totalCases > 0 ? ((cityCases / totalCases) * 100).toFixed(1) : '0.0';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="position">${index + 1}º</td>
                <td>${city}</td>
                <td>${cityCases.toLocaleString('pt-BR')}</td>
                <td class="percentage">${percentage}%</td>
            `;
            tbody.appendChild(row);
        });

    }

    populateHistologyTable() {
        // Esta função agora apenas garante que os dados de histologia estejam carregados e que a tabela seja limpa.
        // A renderização real das linhas é feita por renderHistologyPage.
        const tbody = document.querySelector('#histologyTable tbody');
        tbody.innerHTML = '';
    }

    renderHistologyPage(page) {
        const tbody = document.querySelector('#histologyTable tbody');
        const histologyData = this.data.histology;
        const totalPatients = this.data.overview.total_patients;

        tbody.innerHTML = ''; // Limpar a tabela antes de renderizar a nova página

        const startIndex = (page - 1) * this.histologyRowsPerPage;
        const endIndex = startIndex + this.histologyRowsPerPage;

        const paginatedLabels = histologyData.labels.slice(startIndex, endIndex);
        const paginatedValues = histologyData.values.slice(startIndex, endIndex);

        if (paginatedLabels.length === 0 && page > 1) {
            // Se a página atual não tiver dados e não for a primeira página, volte para a página anterior
            this.currentHistologyPage = page - 1;
            this.renderHistologyPage(this.currentHistologyPage);
            return;
        }

        paginatedLabels.forEach((histologyType, index) => {
            const originalIndex = startIndex + index; // Para manter a numeração original
            const cases = paginatedValues[index];
            const percentage = totalPatients > 0 ? ((cases / totalPatients) * 100).toFixed(2) : '0.00';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="position">${originalIndex + 1}º</td>
                <td class="histology-type">${histologyType}</td>
                <td class="cases">${cases.toLocaleString('pt-BR')}</td>
                <td class="percentage">${percentage}%</td>
            `;
            tbody.appendChild(row);
        });

        this.updateHistologyPaginationControls();
    }

    setupHistologyPagination() {
        const totalRows = this.data.histology.labels.length;
        this.totalPages = Math.ceil(totalRows / this.histologyRowsPerPage);

        const paginationContainer = document.querySelector('#histologyPagination');
        if (!paginationContainer) return;

        paginationContainer.innerHTML = ''; // Limpar controles existentes

        // Botão Anterior
        const prevButton = document.createElement('button');
        prevButton.classList.add('pagination-button', 'prev-button');
        prevButton.innerHTML = '&laquo; Anterior';
        prevButton.addEventListener('click', () => {
            if (this.currentHistologyPage > 1) {
                this.currentHistologyPage--;
                this.renderHistologyPage(this.currentHistologyPage);
            }
        });
        paginationContainer.appendChild(prevButton);

        // Números das páginas (Placeholder, atualizado por updateHistologyPaginationControls)
        const pageNumbersSpan = document.createElement('span');
        pageNumbersSpan.classList.add('page-numbers');
        paginationContainer.appendChild(pageNumbersSpan);

        // Botão Próximo
        const nextButton = document.createElement('button');
        nextButton.classList.add('pagination-button', 'next-button');
        nextButton.innerHTML = 'Próximo &raquo;';
        nextButton.addEventListener('click', () => {
            if (this.currentHistologyPage < this.totalPages) {
                this.currentHistologyPage++;
                this.renderHistologyPage(this.currentHistologyPage);
            }
        });
        paginationContainer.appendChild(nextButton);

        this.updateHistologyPaginationControls();
    }

    updateHistologyPaginationControls() {
        const prevButton = document.querySelector('#histologyPagination .prev-button');
        const nextButton = document.querySelector('#histologyPagination .next-button');
        const pageNumbersSpan = document.querySelector('#histologyPagination .page-numbers');

        if (prevButton) {
            prevButton.disabled = this.currentHistologyPage === 1;
        }
        if (nextButton) {
            nextButton.disabled = this.currentHistologyPage === this.totalPages;
        }
        if (pageNumbersSpan) {
            pageNumbersSpan.textContent = `Página ${this.currentHistologyPage} de ${this.totalPages}`;
        }
    }

    generateColorPalette(count) {
        const baseColors = [
            this.colors.primary,
            this.colors.secondary,
            this.colors.accent.green,
            this.colors.accent.yellow,
            this.colors.accent.pink,
            this.colors.accent.gray
        ];

        const colors = [];
        for (let i = 0; i < count; i++) {
            if (i < baseColors.length) {
                colors.push(baseColors[i]);
            } else {
                // Gerar cores variadas
                const hue = (i * 137.508) % 360; // Golden angle
                colors.push(`hsl(${hue}, 60%, 60%)`);
            }
        }

        return colors;
    }

    createGradient(ctx, colors) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, colors[0] + '40');
        gradient.addColorStop(1, colors[1] + '10');
        return gradient;
    }

    // Função utilitária para download de gráficos
    setupDownloadButton(buttonId, chart, filename) {
        const btn = document.getElementById(buttonId);
        if (btn) {
            btn.addEventListener('click', async () => {
                // Adicionar estado de loading
                btn.classList.add('loading');
                btn.innerHTML = '<span class="download-icon">⏳</span>Gerando Imagem...';

                try {
                    const a = document.createElement('a');
                    chart.resize(1600, 900);
                    a.href = chart.toBase64Image('image/png', 1);
                    chart.resize();
                    a.download = filename;
                    a.click();

                    // Feedback de sucesso
                    btn.innerHTML = '<span class="download-icon"></span>Download Concluído!';
                    setTimeout(() => {
                        btn.classList.remove('loading');
                        btn.innerHTML = '<span class="download-icon"></span>Baixar Gráfico';
                    }, 2000);
                } catch (error) {
                    console.error('Erro ao gerar download:', error);
                    btn.innerHTML = '<span class="download-icon">❌</span>Erro no Download';
                    setTimeout(() => {
                        btn.classList.remove('loading');
                        btn.innerHTML = '<span class="download-icon"></span>Baixar Gráfico';
                    }, 2000);
                }
            });
        }
    }

    createBg() {
        const exportBg = {
            id: 'exportBg',
            beforeDraw(chart, args, opts) {
                const { ctx, width, height } = chart;

                // Fundo
                ctx.save();
                ctx.globalCompositeOperation = 'destination-over';
                ctx.fillStyle = opts?.color || '#fff';
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            }
        };
        return exportBg;
    }


    filterDataByCharSelection(ctx, chart, filterType) {
        // Adicionar event listener de clique no gráfico de tipos de tumor
        ctx.canvas.addEventListener('click', (e) => {
            const activePoints = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
            if (activePoints.length > 0) {
                const clickedElementIndex = activePoints[0].index;
                const clickedElement = chart.data.labels[clickedElementIndex];

                // Aplicar o filtro de tumor
                if (this.filters[filterType] === clickedElement) {
                    // Se o mesmo tumor foi clicado novamente, limpar o filtro
                    this.filters[filterType] = 'all';

                } else {
                    this.filters[filterType] = clickedElement;

                }
                this.applyFilters();
            }
        });
    }

    async applyFilters() {
        // Implementar debouncing para evitar múltiplas execuções
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }

        this.filterTimeout = setTimeout(async () => {

            try {
                await this.updateFilteredData();
                this.updateMetrics();
                this.updateCharts();
            } catch (error) {
                console.error('Erro ao aplicar filtros:', error);
            }
        }, 150); // Debounce de 150ms
    }

    async updateFilteredData() {
        // Gerar chave de cache para os filtros atuais
        const filterKey = JSON.stringify(this.filters);

        // Verificar se já temos os dados filtrados em cache
        if (this.filteredDataCache && this.filteredDataCache.key === filterKey) {
            this.filteredData = this.filteredDataCache.data;
            return;
        }

        // Começar com os dados brutos originais
        let filteredRawData = [...this.rawData];

        filteredRawData = filteredRawData.map(raw => ({
            ...raw,
            ANODIAG: parseInt(raw.ANODIAG)
        }))

        // Contar quantos filtros estão ativos
        const activeFilters = Object.values(this.filters).filter(filter => filter !== 'all' && filter.length != 0).length;

        if (activeFilters === 0) {
            // Nenhum filtro ativo, usar dados originais (processados)
            this.filteredData = null; // Indica que não há filtros aplicados
            this.hideActiveFiltersIndicator();
            return;
        }

        if (this.filters.period.length !== 0) {
            // A. O seu filtro 'this.filters.period' já é um array de strings de anos (ex: ['2023', '2024'])

            filteredRawData = filteredRawData.filter(d => {

                // 1. Converte o valor de 'd.ANODIAG' (ex: 2023.0) para inteiro (ex: 2023)
                const anoDoDado = parseInt(d.ANODIAG);

                // 2. Converte o inteiro para string (ex: '2023') para corresponder ao formato do array de filtros
                const anoDoDadoString = anoDoDado.toString();

                // 3. Aplica o filtro: verifica se o ano está incluído no array de períodos
                return this.filters.period.includes(anoDoDadoString);
            });
        }

        if (this.filters.region.length !== 0) {
            filteredRawData = filteredRawData.filter(d => this.filters.region.includes(d.PROCEDEN));
        }

        if (this.filters.tumorSpecific.length !== 0 && !this.filters.tumorSpecific.includes('Outros')) {
            filteredRawData = filteredRawData.filter(d => this.filters.tumorSpecific.includes(d.LocalTumorLegendado));
        }

        if (this.filters.tumorSpecific.includes('Outros')) {
            const entries = Object.entries(
                filteredRawData.reduce((acc, { LocalTumorLegendado }) => {
                    acc[LocalTumorLegendado] = (acc[LocalTumorLegendado] || 0) + 1;
                    return acc;
                }, {})
            ).sort((a, b) => b[1] - a[1]);
            const outher = entries.slice(9).map(o => o[0]);

            filteredRawData = filteredRawData.filter(d => outher.includes(d.LocalTumorLegendado));
        }

        if (this.filters.tumorGeneral.length !== 0) {
            filteredRawData = filteredRawData.filter(d => this.filters.tumorGeneral.includes(d.LocalTumorcompacto));
        }

        if (this.filters.age !== 'all') {
            filteredRawData = filteredRawData.filter(d => d.Cortes_Idade === this.filters.age);
        }


        if (this.filters.smoking !== 'all') {
            filteredRawData = filteredRawData.filter(d => d.TABAGISM === this.filters.smoking);
        }

        if (this.filters.alcohol !== 'all') {
            filteredRawData = filteredRawData.filter(d => d.ALCOOLIS === this.filters.alcohol);
        }

        if (this.filters.occupations !== 'all') {
            filteredRawData = filteredRawData.filter(d => d.OCUPACAO === this.filters.occupations);
        }

        if (this.filters.ageMin !== 'all') {
            filteredRawData = filteredRawData.filter(d => parseInt(d.IDADE) > parseInt(this.filters.ageMin))
        }

        if (this.filters.ageMax !== 'all') {
            filteredRawData = filteredRawData.filter(d => parseInt(d.IDADE) <= parseInt(this.filters.ageMax))
        }

        if (this.filters.stagingByYear !== 'all') {
            filteredRawData = filteredRawData.filter(d => d.ESTADIAM === this.filters.stagingByYear);
        }

        if (this.filters.sex.length !== 0) {
            filteredRawData = filteredRawData.filter(d => this.filters.sex.includes(d.SEXO));
        }

        if (this.filters.estadiam.length !== 0) {
            filteredRawData = filteredRawData.filter(d => this.filters.estadiam.includes(d.ESTADIAM));
        }

        if (this.filters.obits !== 'all') {
            filteredRawData = filteredRawData.filter(d => d.OBITO_CA === this.filters.obits);
        }

        if (this.filters.maritalStatus !== 'all') {
            filteredRawData = filteredRawData.filter(d => d.ESTCONAT === this.filters.maritalStatus);
        }

        if (this.filters.education !== 'all') {
            filteredRawData = filteredRawData.filter(d => d.INSTRUC === this.filters.education);
        }

        if (this.filters.city.length !== 0) {
            filteredRawData = filteredRawData.filter(d => this.filters.city.includes(d.CIDADE));
        }

        if (this.filters.race !== 'all') {
            filteredRawData = filteredRawData.filter(d => d.RACACOR === this.filters.race);
        }

        if (this.filters.stateTratament !== 'all') {
            filteredRawData = filteredRawData.filter(d => d.ESTDFIMT === this.filters.stateTratament);
        }

        if (this.filters.familyHistory !== 'all') {
            filteredRawData = filteredRawData.filter(d => d.HISTFAMC === this.filters.familyHistory);
        }

        if (this.filters.geografic !== 'all') {
            const uf = this.filters.geografic;
            filteredRawData = filteredRawData.filter(d => d.UF === uf);
        }

        // Processar os dados brutos filtrados para gerar o objeto dashboardData filtrado
        this.filteredData = this.processRawData(filteredRawData);

        // Armazenar no cache
        this.filteredDataCache = {
            key: filterKey,
            data: this.filteredData
        };

        // Mostrar indicador de filtros ativos
        this.showActiveFiltersIndicator(activeFilters);
    }


    updateCharts() {
        // Atualizar todos os gráficos com dados filtrados
        const dataToUse = this.filteredData || this.data;

        // Atualizar gráfico temporal
        if (this.charts.temporal) {
            // Garantir que os anos estejam em ordem crescente
            const sortedData = dataToUse.temporal.years
                .map((year, index) => ({ year, cases: dataToUse.temporal.cases[index] }))
                .sort((a, b) => a.year - b.year);

            this.charts.temporal.data.labels = sortedData.map(d => d.year);
            this.charts.temporal.data.datasets[0].data = sortedData.map(d => d.cases).reverse();
            this.charts.temporal.update('none'); // Atualizar sem animação
        }

        // Atualizar gráfico de tipos de tumor
        if (this.charts.tumorTypes) {
            this.charts.tumorTypes.data.labels = dataToUse.tumor_types.labels;
            this.charts.tumorTypes.data.datasets[0].data = dataToUse.tumor_types.values;
            this.charts.tumorTypes.update('none');
        }

        // Atualizar gráfico de distribuição etária
        if (this.charts.ageDistribution) {
            this.charts.ageDistribution.data.labels = dataToUse.age_distribution.labels;
            this.charts.ageDistribution.data.datasets[0].data = dataToUse.age_distribution.values;
            this.charts.ageDistribution.update('none');
        }

        if (this.charts.educationLevel) {
            this.charts.educationLevel.data.labels = dataToUse.level_education.labels;
            this.charts.educationLevel.data.datasets[0].data = dataToUse.level_education.values;
            this.charts.educationLevel.update('none');
        }

        if (this.charts.race) {
            this.charts.race.data.labels = dataToUse.race.labels;
            this.charts.race.data.datasets[0].data = dataToUse.race.values;
            this.charts.race.update('none');
        }

        if (this.charts.familyHistory) {
            this.charts.familyHistory.data.labels = dataToUse.family_history.labels;
            this.charts.familyHistory.data.datasets[0].data = dataToUse.family_history.values;
            this.charts.familyHistory.update('none');
        }

        if (this.charts.occupations) {
            this.charts.occupations.data.labels = dataToUse.occupations.labels;
            this.charts.occupations.data.datasets[0].data = dataToUse.occupations.values;
            this.charts.occupations.update('none');
        }

        if (this.charts.maritalStatus) {
            this.charts.maritalStatus.data.labels = dataToUse.marital_status.labels;
            this.charts.maritalStatus.data.datasets[0].data = dataToUse.marital_status.values;
            this.charts.maritalStatus.update('none');
        }

        // Atualizar gráfico geográfico apenas se necessário
        if (this.charts.geograficChart && dataToUse && dataToUse.states) {
            const chart = this.charts.geograficChart;
            let needsUpdate = false;

            // Verificar se os dados realmente mudaram antes de atualizar
            const newData = chart.data.datasets[0].data.map(item => {
                const stateName = item.feature.properties.name;
                const stateIndex = dataToUse.states.labels.indexOf(stateName);
                const newValue = stateIndex !== -1 ? dataToUse.states.values[stateIndex] : 0;

                // Verificar se o valor mudou
                if (item.value !== newValue) {
                    needsUpdate = true;
                }

                return {
                    feature: item.feature,
                    value: newValue
                };
            });

            // Só atualizar se houver mudanças
            if (needsUpdate) {
                chart.data.datasets[0].data = newData;
                chart.update('none');
            }
        }

        // Atualizar gráfico de regiões
        if (this.charts.regions) {
            this.charts.regions.data.labels = dataToUse.regions.labels.slice(0, 8);
            this.charts.regions.data.datasets[0].data = dataToUse.regions.values.slice(0, 8);
            this.charts.regions.update('none');
        }

        // Atualizar gráfico de fatores de risco (Tabagismo)
        if (this.charts.riskFactors) {
            const smokingData = dataToUse.risk_factors.smoking;
            const smokingValues = [
                smokingData['Nunca'] || 0,
                smokingData['Sim'] || 0,
                (smokingData['Ex-fumante'] || 0) + (smokingData['Ex-consumidor'] || 0)
            ];
            this.charts.riskFactors.data.datasets[0].data = smokingValues;
            this.charts.riskFactors.update('none');
        }
        // Atualizar gráfico de fatores de risco (Alcoolismo)
        if (this.charts.riskFactorsAlcoholChart) { // Assumindo que você tem um chart para o alcoolismo
            const alcoholData = dataToUse.risk_factors.alcohol;
            const alcoholValues = [
                alcoholData['Nunca'] || 0,
                alcoholData['Sim'] || 0,
                alcoholData['Ex-consumidor'] || 0
            ];
            // Assumindo que o charts.riskFactorsAlcoholChart é o gráfico para o alcoolismo
            this.charts.riskFactorsAlcoholChart.data.datasets[0].data = alcoholValues;
            this.charts.riskFactorsAlcoholChart.update('none');
        }

        // Atualizar gráfico de estadiamento por ano
        if (this.charts.stagingByYear) {
            const stagingByYear = dataToUse.staging_by_year;
            if (stagingByYear && stagingByYear.percentages) {
                const datasets = stagingByYear.stages.map((stage, index) => {
                    const dataByYear = stagingByYear.years.map(year => {
                        // agora cada item do ano tem percentage e numberEstadiam
                        const obj = stagingByYear.percentages[year][stage] || { percentage: 0, numberEstadiam: 0 };
                        return obj;
                    });

                    return {
                        label: `Estágio ${stage}`,
                        data: dataByYear.map(d => d.percentage), // Chart.js precisa só dos números
                        metaData: dataByYear, // guardamos os objetos completos para tooltip
                        backgroundColor: [
                            '#4A90E2', '#FF6F61', '#E94E4E', '#A62323', '#8B0000'
                        ][index],
                        borderColor: '#ffffff',
                        borderWidth: 1,
                        borderRadius: 2
                    };
                });

                this.charts.stagingByYear.data.labels = stagingByYear.years;
                this.charts.stagingByYear.data.datasets = datasets;
                this.charts.stagingByYear.update('none');
            }
        }

        // Atualizar gráfico de estadiamento agrupado
        if (this.charts.stagingGrouped) {
            this.charts.stagingGrouped.data.labels = dataToUse.staging.labels;
            this.charts.stagingGrouped.data.datasets[0].data = dataToUse.staging.values;
            // Atualizar cores se necessário (se a paleta mudar dinamicamente)
            const stagingColors = {
                'Leve': this.colors.accent.green,
                'Grave': this.colors.accent.pink,
                'Não se Aplica': this.colors.accent.gray,
                'Sem Informação': '#e9ecef'
            };
            this.charts.stagingGrouped.data.datasets[0].backgroundColor = dataToUse.staging.labels.map(label => stagingColors[label] || this.colors.primary);
            this.charts.stagingGrouped.update('none');
        }

        if (this.charts.numberObits) {
            // Mapear labels: "Sem Informação" vira "Vivo" visualmente
            const labelMap = {
                'Sem Informação': 'Vivo'
            };

            // Processar labels e valores para combinar "Vivo" com "Sem Informação"
            const processedData = {};
            dataToUse.numberObits.labels.forEach((label, index) => {
                const displayLabel = labelMap[label] || label;
                const value = dataToUse.numberObits.values[index];
                
                if (processedData[displayLabel]) {
                    processedData[displayLabel] += value;
                } else {
                    processedData[displayLabel] = value;
                }
            });

            const displayLabels = Object.keys(processedData);
            const displayValues = Object.values(processedData);

            this.charts.numberObits.data.labels = displayLabels;
            this.charts.numberObits.data.datasets[0].data = displayValues;
            
            // Cores específicas para óbitos
            const stagingColors = {
                'Vivo': '#88E788',
                'Óbito por Câncer': '#FF2C2C',
                'Óbito por Outras Causas': '#ffa500'
            };
            this.charts.numberObits.data.datasets[0].backgroundColor = displayLabels.map(label => stagingColors[label] || this.colors.primary);
            this.charts.numberObits.update('none');
        }

        // Atualizar informações de estadiamento solo
        this.updateStagingSoloInfo(dataToUse.stagingSolo);

        // Atualizar gráfico de tratamento
        if (this.charts.treatment) {
            this.charts.treatment.data.labels = dataToUse.treatment_status.labels.slice(0, 6);
            this.charts.treatment.data.datasets[0].data = dataToUse.treatment_status.values.slice(0, 6);
            this.charts.treatment.data.datasets[0].backgroundColor = this.generateColorPalette(6);
            this.charts.treatment.data.datasets[0].borderColor = '#ffffff';
            this.charts.treatment.update('none');
        }

        // Atualizar tabela de cidades
        this.populateCitiesTable();


        if (this.filters.tumorGeneral.length != 0) {

            const tumorSelect = document.querySelector('#tumorFilterSpecific');
            const virtualSelectInstance = tumorSelect.virtualSelect;

            // recriar as novas opções
            const dataToUseSpecific = dataToUse.tumor_types_specific.labels.map((lbl, i) => ({
                label: lbl,
                value: lbl
            }));;

            if (virtualSelectInstance) {
                // agora executa as suas chamadas como antes
                virtualSelectInstance.setOptions([]);
                virtualSelectInstance.setOptions(dataToUseSpecific);
            }


        }

    }

    updateStagingSoloInfo(stagingSoloData) {
        // Calcular valores de "Não se Aplica" e "Sem Informação" do stagingSolo
        const naoSeAplicaIndex = stagingSoloData.labels.indexOf('Não se Aplica');
        const semInfoIndex = stagingSoloData.labels.indexOf('Sem Informação');
        const naoSeAplicaValue = stagingSoloData.values[naoSeAplicaIndex] || 0;
        const semInfoValue = stagingSoloData.values[semInfoIndex] || 0;

        // Criar ou atualizar elementos para mostrar valores fora do gráfico
        const chartContainer = document.getElementById('EstadiamChart').parentElement;
        let infoDiv = chartContainer.querySelector('.staging-info');
        if (!infoDiv) {
            infoDiv = document.createElement('div');
            infoDiv.className = 'staging-info';
            infoDiv.style.cssText = ' background: #f8f9fa; border-radius: 8px;font-size: 14px; color: #666;';
            chartContainer.insertBefore(infoDiv, chartContainer.firstChild);
        }

        infoDiv.innerHTML = `
            <div style="display: flex; padding:5px; gap:6px; justify-content: center; align-items: center;">
                <span><strong>Não se Aplica:</strong> ${naoSeAplicaValue.toLocaleString('pt-BR')} casos</span>
                <span><strong>Sem Informação:</strong> ${semInfoValue.toLocaleString('pt-BR')} casos</span>
            </div>
        `;
    }

    showLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.opacity = '1';
    }

    clearFilters() {
        // Resetar filtros
        this.filters = {
            period: [],
            region: [],
            tumorGeneral: [],
            tumorSpecific: [],
            age: 'all',
            smoking: 'all', // Novo filtro para tabagismo
            alcohol: 'all',
            sex: [],
            estadiam: [], // Novo filtro para alcoolismo
            stagingGrouped: 'all', // Novo filtro para estadiamento agrupado
            stagingByYear: 'all',
            obits: 'all', // Novo filtro para estadiamento por ano
            education: 'all',
            city: [],
            ageMin: 'all',
            ageMax: 'all',
            geografic: 'all',
            familyHistory: 'all',
            race: 'all',
            stateTratament: 'all',
            occupations: 'all',
            maritalStatus: 'all'
        };

        document.querySelector('#periodFilter').virtualSelect.reset();
        document.querySelector('#regionFilter').virtualSelect.reset();
        document.querySelector('#tumorFilterSpecific').virtualSelect.reset();
        document.querySelector('#tumorFilterGeneral').virtualSelect.reset();
        document.querySelector('#ageFilterMin').virtualSelect.reset();
        document.querySelector('#ageFilterMax').virtualSelect.reset();
        document.querySelector('#sexFilter').virtualSelect.reset();
        document.querySelector('#cityFilter').virtualSelect.reset();
        document.querySelector('#estadiamFilter').virtualSelect.reset();

        document.querySelector("#ageFilterMax").virtualSelect.setValue(['all']);
        document.querySelector("#ageFilterMin").virtualSelect.setValue(['all']);


        // Limpar dados filtrados e cache
        this.filteredData = null;
        this.filteredDataCache = null;

        // Atualizar dashboard
        this.updateMetrics();
        this.updateCharts();

        // Esconder indicador de filtros ativos
        this.hideActiveFiltersIndicator();
    }

    showActiveFiltersIndicator(count) {
        // Criar ou atualizar indicador de filtros ativos
        let indicator = document.getElementById('activeFiltersIndicator');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'activeFiltersIndicator';
            indicator.className = 'active-filters-indicator';
            document.querySelector('.filters-section .container').appendChild(indicator);
        }

        // Criar lista de filtros ativos
        const activeFiltersList = [];
        if (this.filters.period.length !== 0) activeFiltersList.push(`Período: ${this.filters.period}`);
        if (this.filters.region.length !== 0) activeFiltersList.push(`Região: ${this.filters.region}`);
        if (this.filters.tumorSpecific.length !== 0) activeFiltersList.push(`Tumor Específico: ${this.filters.tumorSpecific}`);
        if (this.filters.tumorGeneral.length !== 0) activeFiltersList.push(`Tumor Geral: ${this.filters.tumorGeneral}`);
        if (this.filters.ageMin !== 'all') activeFiltersList.push(`Range de Idade (Min): ${this.filters.ageMin}`);
        if (this.filters.ageMax !== 'all') activeFiltersList.push(`Range de Idade (Max): ${this.filters.ageMax}`);
        if (this.filters.age !== 'all') activeFiltersList.push(`Idade: ${this.filters.age}`);
        if (this.filters.geografic !== 'all') activeFiltersList.push(`Estado: ${this.filters.geografic}`);
        if (this.filters.city.length !== 0) activeFiltersList.push(`Cidade: ${this.filters.city}`);
        if (this.filters.alcohol !== 'all') activeFiltersList.push(`Alcoolismo: ${this.filters.alcohol}`);
        if (this.filters.smoking !== 'all') activeFiltersList.push(`Tabagismo: ${this.filters.smoking}`);
        if (this.filters.estadiam.length !== 0) activeFiltersList.push(`Estadiamento: ${this.filters.estadiam}`);
        if (this.filters.education !== 'all') activeFiltersList.push(`Educação: ${this.filters.education}`);
        if (this.filters.obits !== 'all') activeFiltersList.push(`Óbitos: ${this.filters.obits}`);
        if (this.filters.sex.length !== 0) activeFiltersList.push(`Sexo: ${this.filters.sex}`);
        if (this.filters.stagingGrouped !== 'all') activeFiltersList.push(`Estadiamento Agrupado: ${this.filters.stagingGrouped}`);
        if (this.filters.stagingByYear !== 'all') activeFiltersList.push(`Estadiamento por Ano: ${this.filters.stagingByYear}`);
        if (this.filters.maritalStatus !== 'all') activeFiltersList.push(`Estado Civil: ${this.filters.maritalStatus}`);
        if (this.filters.familyHistory !== 'all') activeFiltersList.push(`Histórico Familiar: ${this.filters.familyHistory}`);

        indicator.innerHTML = `
            <div id='indicator-con' class="indicator-content">
                <div class="indicator-header">
                    <div class="indicator-info">
                        <span class="indicator-icon">🔍</span>
                        <span class="indicator-text">${count} filtro${count > 1 ? 's' : ''} ativo${count > 1 ? 's' : ''}</span>
                    </div>
                    <button id="clearFiltersBtn" class="clear-filters-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Limpar Filtros
                    </button>
                </div>
                <div class="active-filters-list">
                    ${activeFiltersList.map(filter => `<span class="filter-tag">${filter}</span>`).join('')}
                </div>
            </div>
        `;
        
        // Adicionar evento ao botão de limpar filtros
        const clearBtn = document.getElementById('clearFiltersBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearFilters());
        }

        const checkboxFilterSelect = document.getElementById('checkbox-filter-select');

        checkboxFilterSelect.addEventListener('change', () => {
            if (checkboxFilterSelect.checked) {
                indicator.style.display = 'none';
                // aqui você coloca a lógica específica desse checkbox
            } else {
                indicator.style.display = 'block';
            }
        });


        if (checkboxFilterSelect && checkboxFilterSelect.checked) {
            indicator.style.display = 'none';
        } else {
            indicator.style.display = 'block';
        }
    }

    hideActiveFiltersIndicator() {
        const indicator = document.getElementById('activeFiltersIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 300);
    }

    showError(message) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.innerHTML = `
            <div class="loading-spinner">
                <div style="color: #b4325b; font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <p style="color: #b4325b; font-weight: 600;">${message}</p>
                <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #1a3866; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Tentar Novamente
                </button>
            </div>
        `;
    }
    fixVirtualSelectStyles(selector, customStyles = {}) {
        // Define os estilos padrão
        const defaultStyles = {
            height: 'none'
        };

        // Mescla com estilos personalizados (se quiser passar outros)
        const styles = { ...defaultStyles, ...customStyles };

        // Função auxiliar que aplica os estilos
        const applyToAllVSLists = () => {
            document.querySelectorAll('.vscomp-options-list').forEach(el => {
                Object.entries(styles).forEach(([prop, value]) => {
                    el.style.setProperty(prop, value, 'important');
                });
                
            });
        };

        // Aplica imediatamente nos existentes
        applyToAllVSLists();

        // Verifica se o seletor existe e patcha a instância
        const selectElement = document.querySelector(selector);
        if (!selectElement || !selectElement.virtualSelect) {
            console.warn(`[VS-FIX] Nenhuma instância Virtual Select encontrada para "${selector}".`);
            return;
        }

        const vsInstance = selectElement.virtualSelect;

        // Patch em setOptions para reaplicar sempre que atualizar
        if (!vsInstance.__patchedForStyles) {
            const origSetOptions = vsInstance.setOptions.bind(vsInstance);
            vsInstance.setOptions = function (...args) {
                const ret = origSetOptions(...args);
                setTimeout(applyToAllVSLists, 0);
                return ret;
            };
            vsInstance.__patchedForStyles = true;
        }

        // MutationObserver global (apenas 1 vez)
        if (!window.__vscomp_observer) {
            window.__vscomp_observer = new MutationObserver(mutations => {
                for (const m of mutations) {
                    if (m.type === 'childList') {
                        m.addedNodes.forEach(node => {
                            if (node.nodeType === 1) {
                                if (node.matches && node.matches('.vscomp-options-list')) applyToAllVSLists();
                                if (node.querySelectorAll) node.querySelectorAll('.vscomp-options-list').forEach(applyToAllVSLists);
                            }
                        });
                    } else if (m.type === 'attributes') {
                        const t = m.target;
                        if (t && t.matches && t.matches('.vscomp-options-list')) applyToAllVSLists();
                    }
                }
            });

            window.__vscomp_observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });

            
        }
    }

}

const button = document.getElementById('button-config');
const divConfig = document.getElementById('div-config');

const filters = document.getElementById('filters-section');
const checkboxFilter = document.getElementById('checkbox-filter');

button.addEventListener('click', () => {
    if (divConfig.classList.contains('config-div--open')) {
        divConfig.classList.remove('config-div--open')
    } else {
        divConfig.classList.add('config-div--open');
    }
})

checkboxFilter.addEventListener('change', () => {
    if (checkboxFilter.checked) {
        filters.style.position = 'static'
    } else {
        filters.style.position = 'sticky'

    }
})

// Configurações globais do Chart.js
Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#727272';

// Inicializar dashboard quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new FCVDashboard();
});

// Adicionar responsividade aos gráficos
window.addEventListener('resize', () => {
    Object.values(window.dashboard?.charts || {}).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
            chart.resize();
        }
    });
});

