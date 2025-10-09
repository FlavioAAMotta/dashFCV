import pandas as pd
import json
from datetime import datetime

# Carregar dados
df = pd.read_csv('data/RHC_2024_DATA.csv')

# Função para processar dados e gerar métricas
def process_dashboard_data():
    dashboard_data = {}

        # Formatação dos dados de Estadiamento
    df['ESTADIAM'] = df['ESTADIAM'].replace(['0A'], '0')
    df['ESTADIAM'] = df['ESTADIAM'].replace(['1'], 'I')
    df['ESTADIAM'] = df['ESTADIAM'].replace(['2'], 'II')
    df['ESTADIAM'] = df['ESTADIAM'].replace(['3'], 'III')
    df['ESTADIAM'] = df['ESTADIAM'].replace(['4'],'IV')

    
    df['OBITO_CA'] = df['OBITO_CA'].fillna('Sem Informação')
    df['OBITO_CA'] = df['OBITO_CA'].replace(['Sim'], 'Óbito por Câncer')
    df['OBITO_CA'] = df['OBITO_CA'].replace(['Não'], 'Óbito por Outras Causas')

    # Total de registros
    totalUnder18 = len(df)

    # Quantos têm idade < 18
    under18 = len(df[df['IDADE_DIAG'] < 18])
    
    # Métricas gerais
    dashboard_data['overview'] = {
        'total_patients': len(df),
        'total_male': len(df[df['SEXO'] == 'Masculino']),
        'total_female': len(df[df['SEXO'] == 'Feminino']),
        'male_percentage': round((len(df[df['SEXO'] == 'Masculino']) / len(df)) * 100, 1),
        'female_percentage': round((len(df[df['SEXO'] == 'Feminino']) / len(df)) * 100, 1),
        'mortality_rate': round((len(df[df['OBITO_CA'] == 'Óbito por Câncer']) / len(df['OBITO_CA'])) * 100, 1),
        'avg_inicial_states':round(len(df[(df['ESTADIAM'] == 'I') | (df['ESTADIAM'] == 'II')]) / len(df) * 100,1),
        'average_age': round(df['IDADE_DIAG'].mean(), 1),
        'period_start': int(df['ANODIAG'].min()),
        'period_end': int(df['ANODIAG'].max()),
        'Percentage_Under18':round((under18 / totalUnder18) * 100, 1),
        'current_year_cases': len(df[df['ANODIAG'] == df['ANODIAG'].max()])
    }
    
    # Evolução temporal
    temporal_data = df.groupby('ANODIAG').size().reset_index(name='cases')

    temporal_data['ANODIAG'] = temporal_data['ANODIAG'].astype(int)

    temporal_data = temporal_data.query("ANODIAG >= 2010 and ANODIAG < 2025 ")

    dashboard_data['temporal'] = {
        'years': temporal_data['ANODIAG'].tolist(),
        'cases': temporal_data['cases'].tolist()
    }
    
    # Tipos de tumor mais comuns (top 10)
    tumor_types = df['LocalTumorLegendado'].value_counts()
    top_10_tumors = tumor_types.head(9)
    other_tumors_count = tumor_types.iloc[9:].sum()

    # Criar labels e values
    labels = top_10_tumors.index.tolist()
    values = [int(v) for v in top_10_tumors.values.tolist()]  # força conversão para int

    # Adicionar categoria "Outros" se houver valores restantes
    if other_tumors_count > 0:
        labels.append('Outros')
        values.append(int(other_tumors_count))  # conversão aqui também

    dashboard_data['tumor_types'] = {
        'labels': labels,
        'values': values
    }


    # Tipos de tumor especifico para filtros
    tumor_types_filter_specific = df['LocalTumorLegendado'].value_counts().sort_index()
    dashboard_data['tumor_types_specific'] = {
        'labels': tumor_types_filter_specific.index.tolist(),
        'values': tumor_types_filter_specific.values.tolist()
    }
    # Tipos de tumor especifico para filtros
    tumor_types_filter_general = df['LocalTumorcompacto'].value_counts().sort_index()
    dashboard_data['tumor_types_general'] = {
        'labels': tumor_types_filter_general.index.tolist(),
        'values': tumor_types_filter_general.values.tolist()
    }

    # Porcentagem de obitos
    numberObits = df['OBITO_CA'].value_counts();
    dashboard_data['numberObits'] = {
        'labels':numberObits.index.tolist(),
        'values':numberObits.values.tolist()
    }

        # Supondo que df já exista
    levelEducation = df['INSTRUC'].value_counts()

    # Ordem desejada
    ordemEscolaridade = [
        'Analfabeto',
        'Fundamental Incompleto',
        'Fundamental Completo',
        'Nível Médio',
        'Nível Superior Incompleto',
        'Nível Superior Completo',
        'Sem Informação'
    ]

    # Criar um DataFrame temporário para facilitar a ordenação
    level_df = levelEducation.reset_index()
    level_df.columns = ['label', 'value']

    # Ordenar de acordo com a ordem definida
    level_df['order'] = level_df['label'].apply(lambda x: ordemEscolaridade.index(x))
    level_df = level_df.sort_values('order').drop(columns='order')

    # Montar o resultado final
    dashboard_data['level_education'] = {
        'labels': level_df['label'].tolist(),
        'values': level_df['value'].tolist()
    }

    family_history = df['HISTFAMC'].value_counts();
    dashboard_data['family_history'] = {
        'labels':family_history.index.to_list(),
        'values':family_history.values.tolist()
    }

    citys = df['CIDADE'].value_counts().sort_index();
    dashboard_data['citys'] = {
        'labels':citys.index.to_list(),
        'values':citys.values.tolist()
    }

    df['UF'] = df['UF'].replace(['99'], 'Sem Informação');
    df['UF'] = df['UF'].replace(['MG'], 'Minas Gerais');
    df['UF'] = df['UF'].replace(['RJ'], 'Rio de Janeiro');
    df['UF'] = df['UF'].replace(['ES'], 'Espírito Santo');
    df['UF'] = df['UF'].replace(['SP'], 'São Paulo');
    df['UF'] = df['UF'].replace(['PR'], 'Paraná');
    df['UF'] = df['UF'].replace(['BA'], 'Bahia');
    df['UF'] = df['UF'].replace(['MA'], 'Maranhão');
    df['UF'] = df['UF'].replace(['PA'], 'Pará');
    df['UF'] = df['UF'].replace(['DF'], 'Distrito Federal');
    df['UF'] = df['UF'].replace(['TO'], 'Tocantins');
    df['UF'] = df['UF'].replace(['AC'], 'Acre');
    df['UF'] = df['UF'].replace(['AM'], 'Amazonas');
    df['UF'] = df['UF'].replace(['RR'], 'Roraima');
    df['UF'] = df['UF'].replace(['AP'], 'Amapá');
    df['UF'] = df['UF'].replace(['RO'], 'Rondônia');
    df['UF'] = df['UF'].replace(['TO'], 'Tocantins');

    states = df['UF'].value_counts();
    dashboard_data['states'] = {
        'labels':states.index.tolist(),
        'values':states.values.tolist()
    }

    
    # Distribuição por faixa etária
    age_groups = df['Cortes_Idade'].value_counts().sort_index()
    dashboard_data['age_distribution'] = {
        'labels': age_groups.index.tolist(),
       'values': age_groups.values.tolist()
    }
    
    # Fatores de risco
    dashboard_data['risk_factors'] = {
        'smoking': df['TABAGISM'].value_counts().to_dict(),
        'alcohol': df['ALCOOLIS'].value_counts().to_dict(),
        'family_history': df['HISTFAMC'].value_counts().to_dict()
    }
    
    # Distribuição geográfica (top 10 cidades)
    cities = df['CIDADE'].value_counts().head(10)
    dashboard_data['geographic'] = {
        'cities': cities.index.tolist(),
        'cases': cities.values.tolist()
    }
    # Etinia
    race = df['RACACOR'].value_counts();
    dashboard_data['race'] = {
        'labels': race.index.tolist(),
        'values': race.values.tolist()
    }
    
    # Estado civil
    marital_status = df['ESTCONAT'].value_counts();
    dashboard_data['marital_status'] = {
        'labels': marital_status.index.tolist(),
        'values': marital_status.values.tolist()
    }
    
    # Regiões
    regions = df['PROCEDEN'].value_counts().sort_index()
    dashboard_data['regions'] = {
        'label': regions.index.tolist(),
        'value': regions.values.tolist()
    }
   
    
    stagingSolo = df['ESTADIAM'].value_counts()
    dashboard_data['stagingSolo'] = {
        'labels': stagingSolo.index.tolist(),
        'values': [int(value) for value in stagingSolo.values]  # Converter para int nativo
    }
    
    df['ANODIAG'] = df['ANODIAG'].dropna().astype(int);

    # NOVO: Estadiamento por ano - dados mais precisos
    # Filtrar apenas casos com estadiamento válido (excluir "Sem Informação" e "Não se Aplica")
    valid_stages = ['0', 'I', 'II', 'III', 'IV']
    df_valid_staging = df[df['ESTADIAM'].isin(valid_stages)].copy()
    
    #staging_by_year = df_valid_staging.groupby(['ANODIAG', 'ESTADIAM']).size().reset_index(name='count')
    
    years = sorted([int(year) for year in df_valid_staging['ANODIAG'].dropna().unique() if int(year) >= 2010 and int(year) < 2025 ])
    stages = valid_stages

    staging_by_year_data = {
        'years': years,  # Converter para int nativo
        'stages': stages,
        'percentages': {},
        'counts': {}
    }
    
    # Calcular porcentagens e contagens para cada ano
    for year in years:
        year_data = df_valid_staging[df_valid_staging['ANODIAG'] == year]
        total_year = len(year_data)
        
        staging_by_year_data['counts'][int(year)] = int(total_year)  # Converter para int nativo
        
        # Inicializar porcentagens para este ano
        staging_by_year_data['percentages'][int(year)] = {}
        
        for stage in stages:
            stage_count = len(year_data[year_data['ESTADIAM'] == stage])
            percentage = (stage_count / total_year * 100) if total_year > 0 else 0
             # Aqui criamos o objeto corretamente
            staging_by_year_data['percentages'][int(year)][stage] = {
                'numberEstadiam': stage_count,
                'percentage': round(percentage, 1)
            }
    dashboard_data['staging_by_year'] = staging_by_year_data
    

    age = df['IDADE'].value_counts().sort_index();
    dashboard_data['age'] = {
        'labels':age.index.tolist()
    }
    

    # Status de tratamento
    treatment_status = df['ESTDFIMT'].value_counts()
    dashboard_data['treatment_status'] = {
        'labels': treatment_status.index.tolist(),
        'values': treatment_status.values.tolist()
    }
    
    # Tipos histológicos
    histology = df['TIPOHIST'].value_counts()
    dashboard_data['histology'] = {
        'labels': histology.index.tolist(),
        'values': histology.values.tolist()
    }

    # Ocupações mais afetadas (top 10)
    occupations = df['OCUPACAO'].value_counts().head(10)
    dashboard_data['occupations'] = {
        'labels': occupations.index.tolist(),
        'values': occupations.values.tolist()
    }

    
    # Distribuição por sexo e tipo de tumor (top 5 tumores)
    top_tumors = df['LocalTumorLegendado'].value_counts().head(5).index
    gender_tumor_data = []
    for tumor in top_tumors:
        tumor_data = df[df['LocalTumorLegendado'] == tumor]
        gender_tumor_data.append({
            'tumor': tumor,
            'male': len(tumor_data[tumor_data['SEXO'] == 'Masculino']),
            'female': len(tumor_data[tumor_data['SEXO'] == 'Feminino'])
        })
    dashboard_data['gender_tumor'] = gender_tumor_data
    
    # Estatísticas por ano para análise de tendência
    yearly_stats = []
    for year in sorted(df['ANODIAG'].dropna().unique()):
        year_data = df[df['ANODIAG'] == year]
        yearly_stats.append({
            'year': year,
            'total_cases': len(year_data),
            'male_cases': len(year_data[year_data['SEXO'] == 'Masculino']),
            'female_cases': len(year_data[year_data['SEXO'] == 'Feminino']),
            'avg_age': round(year_data['IDADE_DIAG'].mean(), 1)
        })
    dashboard_data['yearly_stats'] = yearly_stats
    
    # Metadata
    dashboard_data['metadata'] = {
        'last_updated': datetime.now().strftime('%d/%m/%Y %H:%M'),
        'total_records': len(df),
        'data_period': f"{df['ANODIAG'].min()}-{df['ANODIAG'].max()}"
    }
    
    return dashboard_data

# Processar e salvar dados
print("Processando dados para o dashboard...")
data = process_dashboard_data()

# Salvar como JSON
with open('data/dashboard_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Dados processados e salvos em data/dashboard_data.json")
print(f"Total de registros processados: {data['overview']['total_patients']}")
print(f"Período dos dados: {data['overview']['period_start']}-{data['overview']['period_end']}")

