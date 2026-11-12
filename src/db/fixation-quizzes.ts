export interface FixationQuestion {
  question: string;
  options: string[];
}

export interface FixationQuizData {
  disciplineId: string;
  disciplineCode: string;
  lessonId: string;
  lessonTitle: string;
  questions: FixationQuestion[];
  correctAnswers: number[]; // Índices de 0 a 2 para as 3 questões
  explanation: string;
}

export const ALL_FIXATION_QUIZZES: Record<string, FixationQuizData> = {
  // ==============================================================
  // MÓDULO I: FUNDAMENTOS DE COMPUTAÇÃO E MATEMÁTICA PARA IA (disc-01 a disc-06)
  // ==============================================================
  'disc-01': {
    disciplineId: 'disc-01',
    disciplineCode: 'INF-101',
    lessonId: 'disc-01-aula-1',
    lessonTitle: 'Aula 01: Introdução à Arquitetura de Computadores e Sistemas Operacionais',
    questions: [
      {
        question: '1. No contexto de Fundamentos de Sistemas Operacionais, qual a principal vantagem do ecossistema Linux e do terminal CLI no fluxo de desenvolvimento em IA?',
        options: [
          'Eliminar a necessidade de compilação de código.',
          'Permitir automação via scripts Bash, manipulação de processos em tempo real e orquestração de GPU.',
          'Impedir o uso de múltiplos usuários no mesmo computador.',
        ],
      },
      {
        question: '2. Em arquitetura de hardware para IA, por que os Tensor Cores superam processadores de uso geral (CPUs) em tarefas de aprendizado profundo?',
        options: [
          'Porque utilizam menor tensão elétrica apenas.',
          'Porque funcionam sem barramentos PCIe.',
          'Devido à aceleração de operações matriciais densas (GEMM) em precisão mista (FP16/BF16/INT8).',
        ],
      },
      {
        question: '3. Qual é a boa prática recomendada para versionamento com Git em projetos com datasets e pesos de modelos volumosos?',
        options: [
          'Ignorar dados e pesos no Git via .gitignore e rastreá-los com ferramentas específicas como DVC e MLflow.',
          'Armazenar arquivos binários pesados de gigabytes diretamente no repositório Git.',
          'Desativar o histórico de commits para não consumir espaço.',
        ],
      },
    ],
    correctAnswers: [1, 2, 0],
    explanation: 'No Linux e em SOs modernos para IA, a CLI viabiliza automação reprodutível, os Tensor Cores aceleram multiplicação de matrizes em precisão mista e arquivos binários pesados devem ser desacoplados do repositório Git via ferramentas especializadas de versionamento de dados.',
  },

  'disc-02': {
    disciplineId: 'disc-02',
    disciplineCode: 'LOG-102',
    lessonId: 'disc-02-aula-1',
    lessonTitle: 'Aula 01: Fundamentos de Raciocínio Algorítmico e Pseudocódigo',
    questions: [
      {
        question: '1. Na disciplina de Lógica de Programação e Algoritmos, qual é a finalidade principal da análise de complexidade assintótica (Notação Big-O)?',
        options: [
          'Calcular o número exato de linhas de código digitadas no programa.',
          'Mensurar o crescimento do tempo de execução e consumo de memória conforme o volume de entrada de dados aumenta.',
          'Substituir a necessidade de escrever laços de repetição.',
        ],
      },
      {
        question: '2. Ao desenvolver algoritmos estruturados, por que a modularização em funções puras e com escopo delimitado é fortemente recomendada?',
        options: [
          'Para forçar o uso exclusivo de variáveis globais em todas as partes.',
          'Para garantir testabilidade, ausência de efeitos colaterais indesejados e facilidade de manutenção.',
          'Porque funções puras não podem retornar valores numéricos.',
        ],
      },
      {
        question: '3. Como vetores e matrizes fundamentam a manipulação de dados em problemas de inteligência artificial?',
        options: [
          'Representam tensores unidimensionais e bidimensionais que modelam dados tabulares, sinais e pixels de imagens.',
          'Servem unicamente para formatar a paleta de cores de páginas web.',
          'Substituem os compiladores de código-fonte de linguagens compiladas.',
        ],
      },
    ],
    correctAnswers: [1, 1, 0],
    explanation: 'A notação Big-O avalia a escalabilidade do algoritmo sob grandes volumes, a modularização em funções puras isola efeitos colaterais garantindo reprodutibilidade, e vetores/matrizes são a base tensorial sobre a qual operam todos os dados em IA.',
  },

  'disc-03': {
    disciplineId: 'disc-03',
    disciplineCode: 'PYT-103',
    lessonId: 'disc-03-aula-1',
    lessonTitle: 'Aula 01: Sintaxe Python Moderna, Variáveis e Tipagem Dinâmica',
    questions: [
      {
        question: '1. Por que bibliotecas como NumPy e Pandas são indispensáveis no ecossistema Python para manipulação de dados em IA?',
        options: [
          'Porque listas nativas de Python não aceitam strings.',
          'NumPy oferece arrays contíguos em C com vetorização SIMD de alta velocidade e Pandas organiza DataFrames analíticos indexados.',
          'Porque essas bibliotecas convertem automaticamente código Python para HTML.',
        ],
      },
      {
        question: '2. Qual é o papel fundamental do tratamento robusto de exceções (try/except/finally) em pipelines de dados e IA?',
        options: [
          'Capturar falhas de I/O, formatos de arquivo inesperados e liberar conexões sem abortar rotinas de treino demoradas.',
          'Ocultar avisos do sistema operacional para acelerar a execução do código.',
          'Impedir que variáveis sejam reatribuídas na memória RAM.',
        ],
      },
      {
        question: '3. Como o paradigma de Programação Orientada a Objetos (POO) é aplicado na modelagem de estimadores em bibliotecas como Scikit-Learn?',
        options: [
          'Encapsulando hiperparâmetros e estado interno em classes com métodos padronizados como fit, transform e predict.',
          'Tornando todos os atributos públicos e desprotegidos contra modificações acidentais.',
          'Eliminando a necessidade de funções e métodos auxiliares em pipelines de dados.',
        ],
      },
    ],
    correctAnswers: [1, 0, 0],
    explanation: 'NumPy provê estruturas contíguas vetorizadas de alta performance, o tratamento de exceções impede que jobs longos de IA travem por dados malformados, e a POO padroniza a interface uniforme dos estimadores (fit/transform/predict).',
  },

  'disc-04': {
    disciplineId: 'disc-04',
    disciplineCode: 'BD-104',
    lessonId: 'disc-04-aula-1',
    lessonTitle: 'Aula 01: Modelagem Relacional, Normalização e Bancos SQL/NoSQL',
    questions: [
      {
        question: '1. Em bancos de dados relacionais (como PostgreSQL), qual é o papel essencial das propriedades ACID nas transações de dados?',
        options: [
          'Garantir Atomicidade, Consistência, Isolamento e Durabilidade nas operações de gravação e atualização de dados.',
          'Comprimir arquivos de áudio e vídeo antes de salvá-los no disco.',
          'Desativar índices de busca para acelerar comandos SELECT de relatórios.',
        ],
      },
      {
        question: '2. Qual cláusula SQL é utilizada para combinar registros de duas tabelas com base em uma chave estrangeira relacionada?',
        options: [
          'GROUP BY com agregação simples.',
          'JOIN (como INNER JOIN ou LEFT JOIN).',
          'ORDER BY com ordenação decrescente.',
        ],
      },
      {
        question: '3. Em que cenário arquitetural de IA o uso de bancos NoSQL ou de chave-valor/documentos é preferível em relação a bancos relacionais puros?',
        options: [
          'Quando se requer esquemas dinâmicos, dados semiestruturados (como JSON) ou ingestão em altíssima velocidade e partição horizontal distribuída.',
          'Apenas quando os dados não contêm números nem caracteres alfanuméricos.',
          'Quando se proíbe o uso de autenticação e criptografia no banco de dados.',
        ],
      },
    ],
    correctAnswers: [0, 1, 0],
    explanation: 'ACID assegura a confiabilidade transacional da base de dados, cláusulas JOIN correlacionam tabelas relacionais por integridade referencial, e bancos NoSQL se destacam para cargas semiestruturadas com esquemas dinâmicos e escala horizontal.',
  },

  'disc-05': {
    disciplineId: 'disc-05',
    disciplineCode: 'MAT-105',
    lessonId: 'disc-05-aula-1',
    lessonTitle: 'Aula 01: Álgebra Linear, Cálculo Diferencial e Estatística Descritiva',
    questions: [
      {
        question: '1. Em Álgebra Linear aplicada a IA, o que o produto escalar (dot product) entre dois vetores normalizados expressa geometricamente?',
        options: [
          'A distância máxima em quilômetros entre dois servidores de dados.',
          'O cosseno do ângulo entre os vetores, medindo o grau de similaridade direcional entre eles.',
          'A multiplicação dos determinantes de duas matrizes singulares.',
        ],
      },
      {
        question: '2. No contexto do treinamento de modelos, qual é a função do gradiente de uma função de perda (loss function)?',
        options: [
          'Indicar a direção de maior crescimento da perda, cujo sentido oposto orienta a atualização dos pesos para minimizar o erro (Gradiente Descendente).',
          'Interromper imediatamente a execução do modelo assim que o erro for detectado.',
          'Substituir a necessidade de separar dados em conjuntos de treino e teste.',
        ],
      },
      {
        question: '3. Qual métrica estatística é mais resistente (robusta) à influência de valores atípicos extremos (outliers) em um conjunto de dados?',
        options: [
          'A Média Aritmética simples.',
          'A Mediana.',
          'A Variância Amostral não ponderada.',
        ],
      },
    ],
    correctAnswers: [1, 0, 1],
    explanation: 'O produto escalar entre vetores unitários mede a similaridade de cosseno (essencial em embeddings e RAG), o vetor gradiente aponta o caminho de maior subida da perda (guiando o gradiente descendente), e a mediana é a medida de tendência central robusta a outliers.',
  },

  'disc-06': {
    disciplineId: 'disc-06',
    disciplineCode: 'FIA-106',
    lessonId: 'disc-06-aula-1',
    lessonTitle: 'Aula 01: Taxonomia da IA e Paradigmas de Aprendizado de Máquina',
    questions: [
      {
        question: '1. Qual é a principal característica que diferencia o Aprendizado Supervisionado do Aprendizado Não-Supervisionado?',
        options: [
          'O Aprendizado Supervisionado utiliza dados de treino acompanhados de rótulos (labels/alvos conhecidos), enquanto o Não-Supervisionado descobre padrões intrínsecos sem rótulos.',
          'O Aprendizado Não-Supervisionado não utiliza computadores nem matrizes numéricas.',
          'O Aprendizado Supervisionado só funciona em arquivos de texto plano.',
        ],
      },
      {
        question: '2. Quando um modelo de Machine Learning apresenta excelente desempenho nos dados de treino, mas falha gravemente nos dados de teste nunca vistos, ocorreu:',
        options: [
          'Underfitting (subajuste por falta de capacidade do modelo).',
          'Overfitting (sobreajuste, memorização de ruídos do conjunto de treino e perda de capacidade de generalização).',
          'Convergência ideal e ótima do algoritmo preditivo.',
        ],
      },
      {
        question: '3. Para um problema com classes desbalanceadas (ex: detecção de fraudes onde 99% dos casos são legítimos), por que a métrica de Acurácia é insuficiente?',
        options: [
          'Porque um modelo trivial que preveja sempre "não fraude" terá 99% de acurácia, mas falhará em detectar todas as fraudes reais, sendo indispensável avaliar Precisão, Recall e F1-Score.',
          'Porque a acurácia é uma métrica reservada exclusivamente para tarefas de regressão linear.',
          'Porque o cálculo da acurácia não é suportado pelo Python.',
        ],
      },
    ],
    correctAnswers: [0, 1, 0],
    explanation: 'O paradigma supervisionado requer alvos explícitos para cálculo do erro, overfitting é a perda da capacidade de generalizar além do treino, e em datasets desbalanceados a acurácia mascara falsos negativos, exigindo métricas como Recall e F1-Score.',
  },

  // ==============================================================
  // MÓDULO II: APRENDIZADO DE MÁQUINA, DEEP LEARNING E PLN (disc-07 a disc-12)
  // ==============================================================
  'disc-07': {
    disciplineId: 'disc-07',
    disciplineCode: 'CD-201',
    lessonId: 'disc-07-aula-1',
    lessonTitle: 'Aula 01: Manipulação de Dados com NumPy, Pandas e Visualização Técnica',
    questions: [
      {
        question: '1. Ao lidar com dados tabulares no Pandas, qual é a forma correta e recomendada de filtrar linhas onde a coluna "idade" seja maior que 25?',
        options: [
          'df.filter(idade > 25)',
          'df[df["idade"] > 25]',
          'df.remove_less(25)',
        ],
      },
      {
        question: '2. No pré-processamento de dados para modelos de IA, por que a etapa de tratamento de valores ausentes (NaN/Null) é mandatória?',
        options: [
          'Porque a maioria dos algoritmos matemáticos e bibliotecas como Scikit-Learn não aceitam valores indefinidos/NaN em operações matriciais.',
          'Porque valores ausentes duplicam automaticamente o uso de memória RAM.',
          'Porque o sistema operacional bloqueia arquivos CSV que contenham nulos.',
        ],
      },
      {
        question: '3. Na biblioteca NumPy, qual é o ganho técnico de utilizar arrays do tipo ndarray com operações vetorizadas em vez de loops "for" tradicionais de Python?',
        options: [
          'Os arrays ndarray são alocados em blocos contíguos de memória em C e executam instruções vetorizadas SIMD com velocidade ordens de magnitude superior.',
          'Arrays ndarray não ocupam espaço na memória do computador.',
          'NumPy impede que o usuário declare variáveis de texto.',
        ],
      },
    ],
    correctAnswers: [1, 0, 0],
    explanation: 'A indexação booleana df[df["col"] > val] é o padrão do Pandas, o tratamento de NaNs evita falhas em operações de álgebra linear dos estimadores, e a vetorização SIMD do NumPy executa cálculos contíguos em nível de C superando laços em Python puro.',
  },

  'disc-08': {
    disciplineId: 'disc-08',
    disciplineCode: 'MLA-202',
    lessonId: 'disc-08-aula-1',
    lessonTitle: 'Aula 01: Algoritmos Clássicos de Machine Learning e Validação de Modelos',
    questions: [
      {
        question: '1. Qual é a principal vantagem da Validação Cruzada K-Fold em comparação à simples divisão treino/teste (Holdout)?',
        options: [
          'Reduzir a dependência de uma divisão arbitrária dos dados, avaliando a estabilidade do modelo em múltiplos folds para uma estimativa mais confiável da generalização.',
          'Permitir que o modelo treine sem qualquer dado numérico.',
          'Eliminar a necessidade de definir hiperparâmetros.',
        ],
      },
      {
        question: '2. Qual algoritmo clássico de aprendizado supervisionado constrói múltiplas árvores de decisão e combina suas predições por votação ou média para reduzir variância?',
        options: [
          'K-Means Clustering.',
          'Random Forest (Florestas Aleatórias).',
          'Regressão Linear Simples.',
        ],
      },
      {
        question: '3. Na avaliação de classificadores binários, o que representa a métrica AUC (Área sob a Curva ROC)?',
        options: [
          'A capacidade do modelo de discriminar entre instâncias positivas e negativas através de múltiplos limiares de decisão, onde 1.0 indica separação perfeita.',
          'O tempo em segundos necessário para serializar o modelo em disco.',
          'O percentual de linhas descartadas do conjunto de treino.',
        ],
      },
    ],
    correctAnswers: [0, 1, 0],
    explanation: 'O K-Fold valida a consistência preditiva em todas as partições do dataset, Random Forest combina árvores independentes reduzindo o sobreajuste, e a AUC-ROC quantifica o poder de discriminação do modelo independente do threshold de corte.',
  },

  'disc-09': {
    disciplineId: 'disc-09',
    disciplineCode: 'DL-203',
    lessonId: 'disc-09-aula-1',
    lessonTitle: 'Aula 01: Arquitetura de Redes Neurais, Backpropagation e Funções de Ativação',
    questions: [
      {
        question: '1. Qual é o papel fundamental das funções de ativação não-lineares (como ReLU) nas camadas ocultas de uma rede neural profunda?',
        options: [
          'Permitir que a rede aprenda e modele relações complexas e fronteiras de decisão não-lineares nos dados, superando as limitações de transformações puramente lineares.',
          'Impedir que novos dados sejam inseridos no treinamento.',
          'Substituir a retropropagação do gradiente (backpropagation).',
        ],
      },
      {
        question: '2. No treinamento com backpropagation, qual componente é responsável por calcular o erro na saída e retropropagar os gradientes usando a Regra da Cadeia?',
        options: [
          'O Algoritmo de Otimização e a Função de Perda (Loss Function).',
          'O monitor de vídeo da placa gráfica.',
          'O compilador do navegador web.',
        ],
      },
      {
        question: '3. Em visão computacional e dados bidimensionais, por que Redes Neurais Convolucionais (CNNs) são mais adequadas que redes densas (MLP) tradicionais?',
        options: [
          'Porque utilizam filtros de convolução com compartilhamento de pesos que preservam a estrutura espacial local e reduzem drasticamente o número de parâmetros.',
          'Porque CNNs não precisam de dados para treinar.',
          'Porque operam sem camadas de pooling ou ativação.',
        ],
      },
    ],
    correctAnswers: [0, 0, 0],
    explanation: 'A ativação não-linear introduz a capacidade de aproximar funções complexas, o backpropagation aplica a regra da cadeia para ajustar os pesos a partir da perda, e filtros convolucionais exploram invariância translacional e localidade espacial em imagens com eficiência paramétrica.',
  },

  'disc-10': {
    disciplineId: 'disc-10',
    disciplineCode: 'PLN-204',
    lessonId: 'disc-10-aula-1',
    lessonTitle: 'Aula 01: Pré-Processamento de Texto, Embeddings e Agentes Conversacionais',
    questions: [
      {
        question: '1. No pipeline clássico de Processamento de Linguagem Natural, qual é o objetivo da etapa de Tokenização?',
        options: [
          'Dividir um texto contínuo em unidades menores e estruturadas (palavras, subpalavras ou caracteres) para posterior representação numérica.',
          'Excluir permanentemente o banco de dados do servidor.',
          'Traduzir o código Python para linguagem binária de máquina.',
        ],
      },
      {
        question: '2. Qual é a vantagem conceitual dos Word Embeddings densos (como Word2Vec ou GloVe) em relação ao modelo Bag-of-Words (One-Hot Encoding)?',
        options: [
          'Capturam relações semânticas e contextuais de palavras em um espaço vetorial contínuo de baixa dimensionalidade, onde palavras de sentidos próximos ficam espacialmente vizinhas.',
          'Exigem que todas as palavras do vocabulário comecem com a mesma letra.',
          'Eliminam a necessidade de qualquer modelo de aprendizado.',
        ],
      },
      {
        question: '3. Ao projetar a arquitetura de um chatbot orientado a tarefas, qual componente identifica a intenção do usuário (Intent) e as entidades nomeadas (Entities)?',
        options: [
          'O módulo de NLU (Natural Language Understanding).',
          'O protocolo TCP/IP da placa de rede.',
          'O sistema de arquivos do disco rígido.',
        ],
      },
    ],
    correctAnswers: [0, 0, 0],
    explanation: 'A tokenização fragmenta o fluxo textual em tokens computáveis, embeddings densos projetam similaridade semântica em espaços vetoriais contínuos, e o módulo NLU categoriza a intenção e extrai os parâmetros (entidades) da mensagem.',
  },

  'disc-11': {
    disciplineId: 'disc-11',
    disciplineCode: 'MET-205',
    lessonId: 'disc-11-aula-1',
    lessonTitle: 'Aula 01: Metodologia Científica, Reprodutibilidade e Redação Técnica em IA',
    questions: [
      {
        question: '1. Qual diretriz técnica é mandatória para garantir a reprodutibilidade de experimentos em Inteligência Artificial?',
        options: [
          'Fixar sementes aleatórias (random seeds), registrar versões exatas de dependências (requirements.txt/Lockfile) e versionar código e dados.',
          'Nunca documentar os hiperparâmetros utilizados nos experimentos.',
          'Executar os modelos apenas uma vez sem registrar os logs de saída.',
        ],
      },
      {
        question: '2. Em relatórios técnicos de IA para tomadores de decisão e clientes, qual prática de comunicação é essencial?',
        options: [
          'Apresentar apenas métricas de perda sem traduzir os impactos operacionais e o valor de negócio da solução.',
          'Alinhar métricas técnicas (F1, acurácia, latência) aos objetivos estratégicos, riscos e custos operacionais de forma clara e objetiva.',
          'Omitir as limitações e margens de erro conhecidas do modelo.',
        ],
      },
      {
        question: '3. Qual a finalidade da seção de "Trabalhos Correlatos / Estado da Arte" em um artigo ou documento técnico de IA?',
        options: [
          'Mapear e referenciar soluções prévias da literatura acadêmica e industrial, justificando a relevância e o diferencial da abordagem proposta.',
          'Aumentar artificialmente o número de páginas do documento sem relevância.',
          'Copiar códigos de terceiros sem atribuição de autoria.',
        ],
      },
    ],
    correctAnswers: [0, 1, 0],
    explanation: 'A reprodutibilidade exige determinismo via seeds e versionamento estrito de ambiente, relatórios de engenharia devem traduzir indicadores estatísticos em valor e riscos de negócio, e o estado da arte fundamenta o rigor e a originalidade da solução.',
  },

  'disc-12': {
    disciplineId: 'disc-12',
    disciplineCode: 'PPS-206',
    lessonId: 'disc-12-aula-1',
    lessonTitle: 'Aula 01: Ciclo de Vida do Projeto Integrador I — Da Hipótese à Modelagem',
    questions: [
      {
        question: '1. No desenvolvimento de um projeto prático supervisionado de IA, qual deve ser a primeira etapa técnica antes de treinar qualquer modelo complexo?',
        options: [
          'Compreender o problema de negócio, definir o objetivo mensurável e realizar a exploração e validação de qualidade dos dados (EDA).',
          'Comprar imediatamente os servidores de computação mais caros do mercado.',
          'Criar campanhas de marketing antes de possuir os dados.',
        ],
      },
      {
        question: '2. Por que a criação de um "Baseline" (modelo simples de referência, ex: regressão linear ou heurística de regra fixa) é uma boa prática inicial?',
        options: [
          'Para fornecer uma linha de base mínima de comparação empírica para validar se modelos mais complexos realmente trazem ganho de performance.',
          'Para substituir definitivamente qualquer etapa posterior de teste.',
          'Porque modelos complexos são proibidos em projetos aplicados.',
        ],
      },
      {
        question: '3. Qual documento técnico é crucial para assegurar que a solução desenvolvida possa ser mantida por outros engenheiros da equipe?',
        options: [
          'Documentação de arquitetura, README detalhado com instruções de setup, dicionário de dados e registro de métricas obtidas.',
          'Apenas comentários verbais não gravados em reuniões.',
          'O código-fonte com todas as variáveis nomeadas com apenas uma letra.',
        ],
      },
    ],
    correctAnswers: [0, 0, 0],
    explanation: 'Todo projeto de IA sólido se inicia pelo entendimento do domínio e auditoria dos dados, o baseline estabelece a régua mínima de validação empírica, e documentação estruturada com dicionário de dados viabiliza a manutenção e sustentação do software.',
  },

  // ==============================================================
  // MÓDULO III: MLOPS, LLMS, GOVERNANÇA E APLICAÇÕES AVANÇADAS (disc-13 a disc-20)
  // ==============================================================
  'disc-13': {
    disciplineId: 'disc-13',
    disciplineCode: 'SEG-301',
    lessonId: 'disc-13-aula-1',
    lessonTitle: 'Aula 01: LGPD, Privacidade de Dados, Ética e Mitigação de Viés em Modelos',
    questions: [
      {
        question: '1. Segundo a LGPD (Lei Geral de Proteção de Dados), qual é a diferença entre dados pseudonimizados e dados verdadeiramente anonimizados?',
        options: [
          'Dados pseudonimizados podem ser reidentificados com auxílio de informação adicional separada, enquanto dados anonimizados perdem definitivamente a possibilidade de associação direta ou indireta a um indivíduo.',
          'Dados anonimizados continuam permitindo identificação imediata do CPF do usuário.',
          'A LGPD não faz distinção entre esses dois conceitos.',
        ],
      },
      {
        question: '2. O que caracteriza o fenômeno de Viés Algorítmico (Algorithmic Bias) em modelos de Machine Learning?',
        options: [
          'A reprodução ou amplificação sistemática de preconceitos históricos ou disparidades presentes nos dados de treinamento contra determinados grupos protegidos.',
          'A falha de conexão de rede durante o download de arquivos.',
          'A velocidade com que a placa de vídeo processa tensores.',
        ],
      },
      {
        question: '3. Qual é o princípio mandatório de segurança no manuseio de chaves de API e credenciais de bancos de dados em sistemas de IA?',
        options: [
          'Isolar segredos em variáveis de ambiente acessíveis unicamente pelo backend servidor e nunca expô-las em código cliente ou repositórios públicos.',
          'Registrar senhas e chaves privadas nos arquivos JavaScript estáticos entregues ao navegador.',
          'Publicar as chaves de API nos comentários de documentação do GitHub.',
        ],
      },
    ],
    correctAnswers: [0, 0, 0],
    explanation: 'A anonimização irreversível remove o dado do escopo da LGPD enquanto a pseudonimização ainda retém chave de reversibilidade, o viés algorítmico replica distorções dos dados históricos demandando auditoria de equidade, e credenciais exigem isolamento estrito no backend.',
  },

  'disc-14': {
    disciplineId: 'disc-14',
    disciplineCode: 'ES-302',
    lessonId: 'disc-14-aula-1',
    lessonTitle: 'Aula 01: Padrões de Arquitetura de Software para IA, APIs RESTful e Testes',
    questions: [
      {
        question: '1. Qual padrão arquitetural é o mais recomendado para disponibilizar um modelo de IA treinado para consumo por aplicações web e mobile?',
        options: [
          'Encapsular o modelo atrás de uma API RESTful ou gRPC com endpoints estruturados (ex: POST /api/v1/predict) e validação de schema de entrada.',
          'Copiar os arquivos de pesos do modelo diretamente para o navegador do cliente em JavaScript.',
          'Executar a inferência enviando comandos de terminal por e-mail manual.',
        ],
      },
      {
        question: '2. Por que a conteinerização com Docker é amplamente adotada na engenharia de software para IA?',
        options: [
          'Porque empacota o modelo, interpretador Python, bibliotecas CUDA e dependências de sistema em uma imagem imutável e portável entre ambientes.',
          'Porque Docker elimina a necessidade de escrever código na aplicação.',
          'Porque dispensa qualquer tipo de teste ou validação de segurança.',
        ],
      },
      {
        question: '3. No contexto de testes automatizados para sistemas inteligentes, o que testa um "Data Integrity Test"?',
        options: [
          'Verifica se os dados de entrada na inferência respeitam os tipos, faixas numéricas e ausência de campos críticos obrigatórios antes de acionar o estimador.',
          'Testa a resolução de monitores conectados ao servidor.',
          'Mede a velocidade da digitação do desenvolvedor.',
        ],
      },
    ],
    correctAnswers: [0, 0, 0],
    explanation: 'APIs RESTful com contratos rígidos padronizam o serviço de predição, contêineres Docker asseguram portabilidade e paridade entre desenvolvimento e produção, e testes de integridade de dados protegem o modelo contra inferências com payloads corrompidos.',
  },

  'disc-15': {
    disciplineId: 'disc-15',
    disciplineCode: 'MLO-303',
    lessonId: 'disc-15-aula-1',
    lessonTitle: 'Aula 01: Fundamentos de MLOps, Rastreamento com MLflow e Monitoramento de Drift',
    questions: [
      {
        question: '1. O que é "Data Drift" no monitoramento de modelos de IA em produção?',
        options: [
          'A alteração da distribuição estatística dos dados de entrada no mundo real em relação à distribuição dos dados com que o modelo foi originalmente treinado.',
          'A perda física de um HD no servidor do data center.',
          'A exclusão manual de variáveis pelo administrador do sistema.',
        ],
      },
      {
        question: '2. Qual é o papel de ferramentas de experiment tracking como o MLflow no ciclo de vida de MLOps?',
        options: [
          'Registrar hiperparâmetros, métricas, artefatos (pesos) e versões de código de cada treino para garantir auditoria e comparabilidade de modelos.',
          'Escrever o código do frontend automaticamente sem intervenção humana.',
          'Substituir o provedor de computação em nuvem.',
        ],
      },
      {
        question: '3. Em estratégias de deploy contínuo em produção (como no Render.com), o que é um "Canary Deployment"?',
        options: [
          'Direcionar uma pequena porcentagem do tráfego real (ex: 5%) para o novo modelo antes de liberá-lo integralmente, monitorando erros e latência.',
          'Substituir todos os servidores de uma só vez sem backups prévios.',
          'Desligar o banco de dados durante os horários de pico.',
        ],
      },
    ],
    correctAnswers: [0, 0, 0],
    explanation: 'Data drift reflete a degradação silenciosa do modelo decorrente de mudanças no perfil dos usuários em produção, o MLflow provê governança e rastreabilidade dos experimentos, e o canary deployment mitiga riscos operacionais na introdução de novos modelos.',
  },

  'disc-16': {
    disciplineId: 'disc-16',
    disciplineCode: 'ASS-304',
    lessonId: 'disc-16-aula-1',
    lessonTitle: 'Aula 01: Arquitetura de Assistentes Inteligentes, Function Calling e Guardrails',
    questions: [
      {
        question: '1. O que possibilita o recurso de "Function Calling" (chamada de ferramentas) em assistentes baseados em modelos modernos como o Google Gemini?',
        options: [
          'Permite que o modelo analise o prompt do usuário e decida structured chamar ferramentas ou APIs externas (ex: consultar banco, clima, cálculos) retornando argumentos em JSON.',
          'Permite que o modelo execute comandos destrutivos no sistema operacional do usuário sem autorização.',
          'Obriga o usuário a programar apenas em linguagem assembly.',
        ],
      },
      {
        question: '2. Qual é a função dos "Guardrails" em um assistente de inteligência artificial de produção?',
        options: [
          'Definir filtros de entrada e saída para prevenir injeção de prompt (jailbreaks), vazamento de dados confidenciais e respostas fora das diretrizes institucionais.',
          'Aumentar o tempo de resposta propositalmente para simular digitação humana.',
          'Desativar o histórico de mensagens da conversa.',
        ],
      },
      {
        question: '3. Para manter a coerência de diálogos em conversas de múltiplos turnos, qual mecanismo arquitetural o backend deve implementar?',
        options: [
          'Gerenciamento de estado de sessão, mantendo o histórico de turnos anteriores (role: user / role: model) de forma isolada por aluno autenticado.',
          'Misturar as mensagens de todos os usuários em um único chat global sem autenticação.',
          'Apagar a resposta do modelo a cada 10 segundos.',
        ],
      },
    ],
    correctAnswers: [0, 0, 0],
    explanation: 'Function Calling conecta o raciocínio semântico do modelo a sistemas determinísticos externos via JSON, guardrails garantem conformidade ética e defensiva contra prompt injection, e o isolamento de sessões de diálogo preserva privacidade e contexto multi-turn.',
  },

  'disc-17': {
    disciplineId: 'disc-17',
    disciplineCode: 'LLM-305',
    lessonId: 'disc-17-aula-1',
    lessonTitle: 'Aula 01: Arquitetura Transformer, Engenharia de Prompts e Sistemas RAG',
    questions: [
      {
        question: '1. No mecanismo de Atenção Auto-Atencional (Self-Attention) dos Transformers, qual é a principal vantagem em relação a redes recorrentes (RNNs)?',
        options: [
          'Permite processar todos os tokens de uma sequência em paralelo com cálculos matriciais de atenção cruzada, mitigando o problema do gradiente evanescente em contextos longos.',
          'Limita o tamanho das frases a no máximo três palavras.',
          'Exige que os textos sejam gravados em fita magnética.',
        ],
      },
      {
        question: '2. Em sistemas RAG (Retrieval-Augmented Generation), qual é a sequência de etapas executada quando um usuário faz uma pergunta técnica?',
        options: [
          'Gera-se o embedding da pergunta, busca-se os trechos documentais mais similares por distância vetorial no acervo e injeta-se esses trechos como contexto no prompt do LLM.',
          'O LLM apaga os documentos locais e inventa respostas sem base de dados.',
          'O sistema envia a pergunta para todos os usuários cadastrados responderem.',
        ],
      },
      {
        question: '3. Qual técnica de Engenharia de Prompt fornece ao modelo alguns exemplos resolvidos antes de solicitar a resposta final para guiar o formato e raciocínio?',
        options: [
          'Few-Shot Prompting.',
          'Zero-Shot Prompting sem contexto.',
          'Prompt vazio.',
        ],
      },
    ],
    correctAnswers: [0, 0, 0],
    explanation: 'A auto-atenção paralela é o cerne da escalabilidade dos Transformers, o pipeline RAG ancora as respostas em evidências documentais locais via busca vetorial de embeddings (reduzindo alucinações), e o Few-Shot condiciona o modelo por demonstração prévia.',
  },

  'disc-18': {
    disciplineId: 'disc-18',
    disciplineCode: 'VIS-306',
    lessonId: 'disc-18-aula-1',
    lessonTitle: 'Aula 01: Processamento Digital de Imagens com OpenCV e Detecção de Objetos',
    questions: [
      {
        question: '1. Na biblioteca OpenCV, qual é a ordem padrão dos canais de cores em que imagens são lidas pela função cv2.imread()?',
        options: [
          'BGR (Blue, Green, Red), exigindo conversão para RGB antes de plotar com Matplotlib.',
          'CMYK (Cyan, Magenta, Yellow, Black).',
          'Tons de cinza obrigatoriamente sem cor.',
        ],
      },
      {
        question: '2. Qual é a principal característica arquitetural de modelos modernos de detecção de objetos em tempo real como a família YOLO (You Only Look Once)?',
        options: [
          'Realizam a predição de caixas delimitadoras (bounding boxes) e classes em uma única passagem (single-stage) pela rede, viabilizando alta taxa de quadros (FPS).',
          'Analisam pixel por pixel individualmente através de múltiplos dias.',
          'Funcionam apenas com câmeras térmicas industriais.',
        ],
      },
      {
        question: '3. Qual operação morfológica clássica combina erosão seguida de dilatação para remover pequenos ruídos pontuais em imagens binárias?',
        options: [
          'Abertura (Opening).',
          'Fechamento (Closing).',
          'Equalização de Histograma Global.',
        ],
      },
    ],
    correctAnswers: [0, 0, 0],
    explanation: 'O OpenCV adota BGR historicamente demandando conversão para RGB, modelos single-stage como YOLO predizem coordenadas e classes simultaneamente em um só forward pass para tempo real, e a Abertura elimina ruídos menores que o elemento estruturante.',
  },

  'disc-19': {
    disciplineId: 'disc-19',
    disciplineCode: 'GP-307',
    lessonId: 'disc-19-aula-1',
    lessonTitle: 'Aula 01: Metodologia CRISP-DM e Gestão Ágil de Projetos de Inteligência Artificial',
    questions: [
      {
        question: '1. No modelo metodológico CRISP-DM (Cross-Industry Standard Process for Data Mining), qual fase precede imediatamente a Preparação de Dados?',
        options: [
          'Compreensão dos Dados (Data Understanding).',
          'Deploy do Modelo em Produção.',
          'Aquisição de Licenças de Software.',
        ],
      },
      {
        question: '2. Por que a gestão de projetos de IA difere do desenvolvimento tradicional de software?',
        options: [
          'Projetos de IA possuem natureza experimental e incerteza científica inerente: a viabilidade depende da qualidade e representatividade dos dados, não apenas de linhas de código.',
          'Em projetos de IA nunca se documenta prazos ou entregas.',
          'Porque sistemas de IA não necessitam de testes de validação.',
        ],
      },
      {
        question: '3. Qual métrica de negócio deve ser estabelecida conjuntamente com a equipe antes de iniciar o desenvolvimento de um modelo?',
        options: [
          'O indicador-chave de sucesso de negócio (ex: redução de churn em X%, economia de tempo operacional ou ROI esperado).',
          'Apenas a preferência pessoal do desenvolvedor pela biblioteca gráfica.',
          'O número de reuniões semanais agendadas.',
        ],
      },
    ],
    correctAnswers: [0, 0, 0],
    explanation: 'No CRISP-DM a exploração e compreensão dos dados precede a sua limpeza/preparação, projetos de IA envolvem risco empírico intrínseco aos dados, e o sucesso deve ser medido por impacto e retorno de negócio (KPI/ROI) alinhado aos stakeholders.',
  },

  'disc-20': {
    disciplineId: 'disc-20',
    disciplineCode: 'PPS-308',
    lessonId: 'disc-20-aula-1',
    lessonTitle: 'Aula 01: Prática Profissional Supervisionada II — TCC e Solução Full-Stack em Produção',
    questions: [
      {
        question: '1. No Trabalho de Conclusão de Curso (TCC) aplicado do Pré-Curso de IA, qual é o requisito técnico central para a homologação do produto?',
        options: [
          'Apresentar uma aplicação full-stack funcional em produção com pipeline de inferência de IA, autenticação, persistência e interface de usuário responsiva.',
          'Apenas entregar um rascunho de texto impresso sem código funcional.',
          'Gravar um vídeo de demonstração sem ter desenvolvido o sistema.',
        ],
      },
      {
        question: '2. Ao realizar o deploy da aplicação final no Render.com, como deve ser gerenciada a integridade de dados e credenciais?',
        options: [
          'Configurar chaves secretas e DATABASE_URL nas variáveis de ambiente da nuvem e aplicar migrações estruturadas no pre-deploy.',
          'Publicar o arquivo com senhas e chaves privadas em fóruns abertos.',
          'Desativar todos os backups e travas de segurança do banco de dados.',
        ],
      },
      {
        question: '3. Na defesa perante banca avaliadora, qual aspecto metodológico demonstra maturidade técnica do estudante?',
        options: [
          'Apresentar a demonstração ao vivo da aplicação, explicar as escolhas arquiteturais, métricas obtidas e as limitações conscientes da solução com clareza ética.',
          'Afirmar que a solução possui 100% de precisão e zero chance de qualquer erro no futuro.',
          'Recusar-se a responder perguntas sobre a arquitetura do código.',
        ],
      },
    ],
    correctAnswers: [0, 0, 0],
    explanation: 'A prática profissional integradora consolida uma aplicação full-stack real em produção, o deploy no Render requer governança de variáveis de ambiente e migração segura, e a defesa técnica comprova domínio da arquitetura e responsabilidade ética.',
  },
};

export function getDisciplineQuiz(disciplineIdOrCode: string): FixationQuizData | undefined {
  if (!disciplineIdOrCode) return undefined;
  const key = disciplineIdOrCode.trim().toLowerCase();

  // Busca por id direto (disc-01, disc-02...)
  if (ALL_FIXATION_QUIZZES[key]) {
    return ALL_FIXATION_QUIZZES[key];
  }

  // Busca por código (INF-101, LOG-102...)
  const byCode = Object.values(ALL_FIXATION_QUIZZES).find(
    (q) => q.disciplineCode.toLowerCase() === key || q.disciplineId.toLowerCase() === key
  );
  if (byCode) return byCode;

  // Busca por prefixo de aula (disc-01-aula-1...)
  const byLesson = Object.values(ALL_FIXATION_QUIZZES).find(
    (q) => q.lessonId.toLowerCase() === key || key.startsWith(q.disciplineId.toLowerCase())
  );
  return byLesson;
}
