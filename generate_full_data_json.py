import pandas as pd

# Caminho para o arquivo
excel_file_path = 'data/RHC_2024.xlsx'

# Carregar dados
df = pd.read_excel(excel_file_path)

# Definir faixas etárias
bins = [0, 12, 17, 29, 39, 59, 69, 79, 150]  
labels = ['0-12', '13-17', '18-29', '30-39', '40-59', '60-69', '70-79', '80+']

# Criar nova coluna "Faixa Etária"
df['Cortes_Idade'] = pd.cut(df['IDADE'], bins=bins, labels=labels, right=True)

df['OCUPACAO'] = df['OCUPACAO'].replace(['888'],'Não se aplica')
df['OCUPACAO'] = df['OCUPACAO'].replace(['999'],'Trabalhadores que não podem ser classificados segundo a Ocupação (artifice na área  da saúde, operador de caldeira, industriario)')
df['OCUPACAO'] = df['OCUPACAO'].replace(['9999'],'Sem informação')


# Formatação dos dados de Estadiamento
df['ESTADIAM'] = df['ESTADIAM'].replace(['0A'], '0')
df['ESTADIAM'] = df['ESTADIAM'].replace(['1'], 'I')
df['ESTADIAM'] = df['ESTADIAM'].replace(['2'], 'II')
df['ESTADIAM'] = df['ESTADIAM'].replace(['3'], 'III')
df['ESTADIAM'] = df['ESTADIAM'].replace(['4'],'IV')



df['OBITO_CA'] = df['OBITO_CA'].fillna('Sem Informação')
df['OBITO_CA'] = df['OBITO_CA'].replace(['Sim'], 'Óbito por Câncer')
df['OBITO_CA'] = df['OBITO_CA'].replace(['Não'], 'Óbito por Outras Causas')

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


# Função auxiliar para checar se está certo
def faixa_errada(row):
    idade = row['IDADE']
    faixa = row['Cortes_Idade']
    
    if pd.isna(faixa):
        return True  # se não entrou em nenhuma faixa, já é erro

    if faixa == '0-12' and not (0 <= idade <= 12):
        return True
    if faixa == '13-17' and not (13 <= idade <= 17):
        return True
    if faixa == '18-29' and not (18 <= idade <= 29):
        return True
    if faixa == '30-39' and not (30 <= idade <= 39):
        return True
    if faixa == '40-59' and not (40 <= idade <= 59):
        return True
    if faixa == '60-69' and not (60 <= idade <= 69):
        return True
    if faixa == '70-79' and not (70 <= idade <= 79):
        return True
    if faixa == '80+' and not (idade >= 80):
        return True

    return False

# Criar coluna para marcar erros
df['Faixa_Errada'] = df.apply(faixa_errada, axis=1)

# Ver os casos com erro
erros = df[df['Faixa_Errada']]
print(erros[['IDADE', 'Cortes_Idade']])

# Deletar coluna antes de salvar
df = df.drop(columns=['Faixa_Errada'])

df = df.drop(columns=['NOMEMAE'])
df = df.drop(columns=['NUMDOC'])
df = df.drop(columns=['PRONTUAR'])
df = df.drop(columns=['CAUBAMOR'])
df = df.drop(columns=['IDTUMOR'])
df = df.drop(columns=['SEGUIMEN'])
df = df.drop(columns=['DTPREENC'])
df = df.drop(columns=['TNM'])
df = df.drop(columns=['PTNM'])
df = df.drop(columns=['LOCTUPRI'])
df = df.drop(columns=['DIAGANT'])
df = df.drop(columns=['LATERALI'])
df = df.drop(columns=['MAISUMTU'])
df = df.drop(columns=['ANALITIC'])
df = df.drop(columns=['ESTADIA2'])
df = df.drop(columns=['CUSTDIAG'])
df = df.drop(columns=['CUSTTRAT'])
df = df.drop(columns=['DATANASC'])
df = df.drop(columns=['DTDIAGNO'])
df = df.drop(columns=['GDGRUPO'])
df = df.drop(columns=['CODPAC'])


# Salvar de volta em CSV
df.to_csv("data/RHC_2024_DATA.csv", index=False, encoding="utf-8")

print("Arquivo gerado com sucesso!")
