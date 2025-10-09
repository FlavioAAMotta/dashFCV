# Dashboard Oncológico FCV

## Descrição

Dashboard web profissional e elegante para análise e monitoramento de dados oncológicos do Hospital do Câncer FCV. Desenvolvido com HTML, CSS e JavaScript, seguindo a identidade visual da instituição.

## Características

### 🎨 Design
- Interface moderna e profissional
- Paleta de cores oficial da FCV
- Layout responsivo para desktop, tablet e mobile
- Animações suaves e micro-interações
- Tipografia Inter para melhor legibilidade

### 📊 Funcionalidades
- **Métricas Principais**: Total de pacientes, novos casos, distribuição por sexo, idade média
- **Evolução Temporal**: Gráfico de linha mostrando casos por ano (2010-2022)
- **Tipos de Tumor**: Top 10 tipos mais comuns em gráfico de barras
- **Análise Demográfica**: Distribuição por faixa etária
- **Fatores de Risco**: Análise de tabagismo, alcoolismo e histórico familiar
- **Análise Geográfica**: Distribuição por região e ranking de cidades
- **Indicadores Clínicos**: Estadiamento e status de tratamento

### 🔧 Tecnologias
- **HTML5**: Estrutura semântica
- **CSS3**: Estilos modernos com Grid e Flexbox
- **JavaScript ES6+**: Interatividade e manipulação de dados
- **Chart.js**: Gráficos interativos e responsivos
- **Dados**: JSON processado a partir do CSV original

## Estrutura do Projeto

```
dashboard-fcv/
├── index.html              # Página principal
├── css/
│   └── styles.css          # Estilos CSS
├── js/
│   └── dashboard.js        # JavaScript principal
├── assets/
│   ├── ÍCONENOVOAZULESCURO-8.png    # Logo FCV
│   ├── HOSPITALDOCÂNCER(2).png      # Logo texto
│   └── CORES-FCV.png               # Paleta de cores
├── data/
│   ├── dados.csv           # Dados originais
│   └── dashboard_data.json # Dados processados
├── process_data.py         # Script de processamento
├── teste_relatorio.md      # Relatório de testes
└── README.md              # Esta documentação
```

## Como Usar

### 1. Servidor Local
Para visualizar o dashboard, execute um servidor HTTP local:

```bash
# Navegue até a pasta do projeto
cd dashboard-fcv

# Inicie um servidor HTTP (Python)
python3 -m http.server 8080

# Ou usando Node.js
npx http-server -p 8080

# Acesse no navegador
http://localhost:8080
```

### 2. Filtros Disponíveis
- **Período**: Filtre por ano específico ou visualize todos os anos
- **Região**: Selecione uma região específica ou todas
- **Tipo de Tumor**: Foque em um tipo específico de tumor
- **Faixa Etária**: Analise uma faixa etária específica

### 3. Interatividade
- **Hover**: Passe o mouse sobre gráficos para ver detalhes
- **Tooltips**: Informações detalhadas em cada elemento
- **Responsividade**: Funciona em desktop, tablet e mobile

## Dados Analisados

### Período: 2010-2022
- **Total de Registros**: 40.738 pacientes
- **Distribuição por Sexo**: 53% masculino, 47% feminino
- **Idade Média**: 62,5 anos
- **Principais Tipos**: Pele (7.722), Próstata (6.029), Mama (5.066)

### Regiões Atendidas
1. Muriaé: 4.926 casos (29.1%)
2. Cataguases: 2.058 casos (12.2%)
3. Ubá: 1.783 casos (10.5%)
4. Manhuaçu: 1.517 casos (9.0%)
5. Leopoldina: 1.458 casos (8.6%)

## Métricas para Gestores

### 📈 Indicadores de Volume
- Total de pacientes atendidos
- Novos casos por período
- Crescimento anual
- Distribuição temporal

### 👥 Perfil Demográfico
- Distribuição por sexo
- Faixas etárias mais afetadas
- Origem geográfica dos pacientes

### 🏥 Indicadores Clínicos
- Tipos de tumor mais comuns
- Estadiamento dos casos
- Status de tratamento
- Fatores de risco prevalentes

### 🗺️ Análise Geográfica
- Regiões de maior demanda
- Cidades com mais casos
- Distribuição territorial

## Paleta de Cores FCV

- **Azul Escuro**: #1a3866 (Cor principal)
- **Azul Claro**: #0095da (Cor secundária)
- **Rosa**: #b4325b (Alertas e destaques)
- **Amarelo**: #efbc33 (Avisos e métricas)
- **Verde**: #2e8a87 (Sucessos e indicadores positivos)
- **Cinza**: #727272 (Textos secundários)

## Compatibilidade

### Navegadores Suportados
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Dispositivos
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (320px - 767px)

## Atualizações de Dados

Para atualizar os dados do dashboard:

1. Substitua o arquivo `data/dados.csv` pelos novos dados
2. Execute o script de processamento:
   ```bash
   python3 process_data.py
   ```
3. Recarregue o dashboard no navegador

## Melhorias Futuras

### Funcionalidades Planejadas
- [ ] Filtragem real dos dados em tempo real
- [ ] Exportação de relatórios (PDF/Excel)
- [ ] Atualização automática dos dados
- [ ] Sistema de alertas para métricas críticas
- [ ] Comparação entre períodos
- [ ] Drill-down nos gráficos
- [ ] Dashboard mobile dedicado

### Integrações Possíveis
- [ ] API para dados em tempo real
- [ ] Sistema de autenticação
- [ ] Notificações push
- [ ] Integração com sistemas hospitalares

## Suporte

Para dúvidas, sugestões ou problemas:
- Verifique o arquivo `teste_relatorio.md` para detalhes dos testes
- Consulte o console do navegador para mensagens de debug
- Certifique-se de que todos os arquivos estão na estrutura correta

## Licença

Este dashboard foi desenvolvido especificamente para o Hospital do Câncer FCV e segue suas diretrizes de identidade visual e requisitos funcionais.

---

**Desenvolvido para FCV Hospital do Câncer**  
*Dashboard Oncológico - Sistema de Análise e Monitoramento*

