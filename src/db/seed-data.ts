import { Module, Discipline, Lesson } from '../types/index.ts';

export const MODULES: Module[] = [
  {
    id: 1,
    title: 'Módulo I — Fundamentos de Computação e Matemática para IA',
    subtitle: 'Nivelamento técnico, pensamento computacional e introdução à inteligência artificial',
    total_hours: 60,
    description: 'Bases sólidas de sistemas, programação em Python, dados e ferramentas matemáticas essenciais.',
    order: 1,
  },
  {
    id: 2,
    title: 'Módulo II — Aprendizado de Máquina, Deep Learning e PLN',
    subtitle: 'Modelagem preditiva, redes neurais e processamento de linguagem natural',
    total_hours: 60,
    description: 'Aprofundamento prático em algoritmos de Machine Learning, Deep Learning, Visão e PLN.',
    order: 2,
  },
  {
    id: 3,
    title: 'Módulo III — MLOps, LLMs, Governança e Aplicações Avançadas',
    subtitle: 'Engenharia de modelos, implantação em produção, segurança e projetos práticos',
    total_hours: 80,
    description: 'Ciclo de vida de IA em produção, grandes modelos de linguagem, ética, LGPD e projeto final.',
    order: 3,
  },
];

export const DISCIPLINES: Discipline[] = [
  // MÓDULO I (60h - 6 disciplinas de 10h)
  {
    id: 'disc-01',
    order: 1,
    code: 'INF-101',
    moduleId: 1,
    title: 'Fundamentos de Informática, Sistemas Operacionais e Ferramentas de Programação',
    hours: 10,
    summary: 'Arquitetura básica de computadores, ecossistema Linux/CLI, Git/GitHub, ambientes virtuais e ferramentas do desenvolvedor moderno.',
    competencies: [
      'Operar sistemas operacionais Linux via linha de comando',
      'Configurar ambientes de desenvolvimento e controle de versão Git',
      'Compreender fundamentos de arquitetura de hardware para aceleração computacional',
    ],
    localMaterialPath: '/cursos/modulo-1/01-fundamentos',
    totalLessons: 1,
  },
  {
    id: 'disc-02',
    order: 2,
    code: 'LOG-102',
    moduleId: 1,
    title: 'Lógica de Programação e Algoritmos',
    hours: 10,
    summary: 'Construção de pensamento algorítmico, estruturas condicionais e de repetição, vetores, matrizes, funções e modularização.',
    competencies: [
      'Construir algoritmos estruturados para resolução de problemas reais',
      'Dominar estruturas de controle e manipulação de conjuntos de dados',
      'Calcular complexidade assintótica básica de algoritmos',
    ],
    localMaterialPath: '/cursos/modulo-1/02-logica',
    totalLessons: 1,
  },
  {
    id: 'disc-03',
    order: 3,
    code: 'PYT-103',
    moduleId: 1,
    title: 'Programação em Python',
    hours: 10,
    summary: 'Sintaxe fundamental de Python, tipos de dados avançados, manipulação de arquivos, orientação a objetos e boas práticas de código.',
    competencies: [
      'Desenvolver scripts e programas modulares em Python 3',
      'Trabalhar com Programação Orientada a Objetos e tratamento de exceções',
      'Manipular estruturas de dados eficientes (listas, dicionários, tuplas, conjuntos)',
    ],
    localMaterialPath: '/cursos/modulo-1/03-python',
    totalLessons: 1,
  },
  {
    id: 'disc-04',
    order: 4,
    code: 'BD-104',
    moduleId: 1,
    title: 'Banco de Dados e Big Data',
    hours: 10,
    summary: 'Modelagem relacional, consultas SQL avançadas em PostgreSQL, introdução a bancos NoSQL e conceitos fundamentais de Big Data.',
    competencies: [
      'Projetar esquemas relacionais normalizados no PostgreSQL',
      'Elaborar consultas analíticas complexas com joins, agregações e subqueries',
      'Compreender o ecossistema e pipelines de processamento de Big Data',
    ],
    localMaterialPath: '/cursos/modulo-1/04-banco-dados',
    totalLessons: 1,
  },
  {
    id: 'disc-05',
    order: 5,
    code: 'MAT-105',
    moduleId: 1,
    title: 'Matemática e Estatística Aplicada à IA',
    hours: 10,
    summary: 'Álgebra linear (vetores e matrizes), cálculo diferencial básico para gradiente descendente, probabilidade e inferência estatística.',
    competencies: [
      'Operar matrizes e transformações lineares para representação vetorial',
      'Aplicar derivadas e gradientes no contexto de otimização de funções',
      'Realizar análise exploratória de dados e testes estatísticos descritivos',
    ],
    localMaterialPath: '/cursos/modulo-1/05-matematica-estatistica',
    totalLessons: 1,
  },
  {
    id: 'disc-06',
    order: 6,
    code: 'FIA-106',
    moduleId: 1,
    title: 'Fundamentos de IA e Aprendizado de Máquina',
    hours: 10,
    summary: 'História e taxonomia da inteligência artificial, agentes inteligentes, paradigmas de aprendizado (supervisionado, não-supervisionado e por reforço).',
    competencies: [
      'Classificar os diferentes paradigmas e arquiteturas de sistemas de IA',
      'Distinguir tarefas de regressão, classificação e agrupamento',
      'Avaliar métricas de desempenho (acurácia, precisão, recall, F1-score)',
    ],
    localMaterialPath: '/cursos/modulo-1/06-fundamentos-ia',
    totalLessons: 1,
  },

  // MÓDULO II (60h - 6 disciplinas de 10h)
  {
    id: 'disc-07',
    order: 7,
    code: 'CD-201',
    moduleId: 2,
    title: 'Python para Ciência de Dados',
    hours: 10,
    summary: 'Manipulação e análise de dados tabulares com NumPy e Pandas; visualização técnica com Matplotlib e Seaborn; pré-processamento de datasets.',
    competencies: [
      'Limpar, transformar e tratar dados ausentes ou inconsistentes',
      'Criar visualizações gráficas explicativas para tomada de decisão',
      'Construir pipelines automatizados de preparação de features',
    ],
    localMaterialPath: '/cursos/modulo-2/07-python-ciencia-dados',
    totalLessons: 1,
  },
  {
    id: 'disc-08',
    order: 8,
    code: 'MLA-202',
    moduleId: 2,
    title: 'Machine Learning Aplicado',
    hours: 10,
    summary: 'Algoritmos clássicos com Scikit-Learn: regressão linear/logística, árvores de decisão, florestas aleatórias, SVM, KNN, K-Means e PCA.',
    competencies: [
      'Treinar e validar modelos preditivos supervisionados e não-supervisionados',
      'Aplicar validação cruzada, ajuste de hiperparâmetros e prevenção de overfitting',
      'Interpretar a importância de atributos e curvas ROC/AUC',
    ],
    localMaterialPath: '/cursos/modulo-2/08-ml-aplicado',
    totalLessons: 1,
  },
  {
    id: 'disc-09',
    order: 9,
    code: 'DL-203',
    moduleId: 2,
    title: 'Redes Neurais Artificiais e Deep Learning',
    hours: 10,
    summary: 'Perceptrons, backpropagation, redes neurais densas (MLP), convolucionais (CNN) e recorrentes (RNN/LSTM) com PyTorch/TensorFlow.',
    competencies: [
      'Construir e treinar arquiteturas de redes neurais profundas',
      'Configurar funções de perda, otimizadores (Adam, SGD) e regularização',
      'Aplicar técnicas de Transfer Learning com modelos pré-treinados',
    ],
    localMaterialPath: '/cursos/modulo-2/09-deep-learning',
    totalLessons: 1,
  },
  {
    id: 'disc-10',
    order: 10,
    code: 'PLN-204',
    moduleId: 2,
    title: 'Processamento de Linguagem Natural (PLN) Chatbots',
    hours: 10,
    summary: 'Tokenização, lematização, embeddings de texto (Word2Vec, GloVe), análise de sentimentos e construção de agentes conversacionais.',
    competencies: [
      'Processar e normalizar textos para pipelines de PLN',
      'Treinar classificadores de intenções e entidades para chatbots',
      'Implementar interfaces conversacionais interativas',
    ],
    localMaterialPath: '/cursos/modulo-2/10-pln-chatbots',
    totalLessons: 1,
  },
  {
    id: 'disc-11',
    order: 11,
    code: 'MET-205',
    moduleId: 2,
    title: 'Metodologia para Elaboração de Produções Técnicas',
    hours: 10,
    summary: 'Normas técnicas da ABNT, elaboração de relatórios técnicos de IA, documentação de experimentos, reprodutibilidade científica e apresentação.',
    competencies: [
      'Redigir relatórios técnicos e científicos com rigor metodológico',
      'Garantir documentação reprodutível de experimentos de aprendizado de máquina',
      'Comunicar resultados complexos para stakeholders técnicos e não-técnicos',
    ],
    localMaterialPath: '/cursos/modulo-2/11-metodologia',
    totalLessons: 1,
  },
  {
    id: 'disc-12',
    order: 12,
    code: 'PPS-206',
    moduleId: 2,
    title: 'Prática Profissional Supervisionada I',
    hours: 10,
    summary: 'Desenvolvimento de projeto prático integrador aplicando ciência de dados e machine learning para resolução de um problema comunitário ou industrial.',
    competencies: [
      'Conceber e executar um projeto aplicado de ponta a ponta',
      'Integrar técnicas de coleta, tratamento e modelagem preditiva',
      'Apresentar produto técnico funcional com documentação completa',
    ],
    localMaterialPath: '/cursos/modulo-2/12-pratica-supervisionada-1',
    totalLessons: 1,
  },

  // MÓDULO III (80h - 8 disciplinas de 10h)
  {
    id: 'disc-13',
    order: 13,
    code: 'SEG-301',
    moduleId: 3,
    title: 'Noções de Segurança, Governança de Dados LGPD Aplicada a Dados',
    hours: 10,
    summary: 'Lei Geral de Proteção de Dados (LGPD), anonimização de dados, viés algorítmico, ética em IA, cibersegurança e governança corporativa.',
    competencies: [
      'Identificar requisitos da LGPD em pipelines de coleta e treino de modelos',
      'Detectar e mitigar vieses discriminatórios em conjuntos de dados e modelos',
      'Aplicar práticas de segurança da informação em infraestruturas de dados',
    ],
    localMaterialPath: '/cursos/modulo-3/13-seguranca-lgpd',
    totalLessons: 1,
  },
  {
    id: 'disc-14',
    order: 14,
    code: 'ES-302',
    moduleId: 3,
    title: 'Engenharia de Software para IA',
    hours: 10,
    summary: 'Padrões de projeto para sistemas inteligentes, desenvolvimento orientado a testes (TDD), APIs RESTful para modelos, microsserviços e Docker.',
    competencies: [
      'Empacotar modelos de IA em contêineres Docker reutilizáveis',
      'Construir APIs performáticas para servir inferências com baixa latência',
      'Escrever testes automatizados de regressão para dados e modelos',
    ],
    localMaterialPath: '/cursos/modulo-3/14-engenharia-software-ia',
    totalLessons: 1,
  },
  {
    id: 'disc-15',
    order: 15,
    code: 'MLO-303',
    moduleId: 3,
    title: 'MLOPS e Deploy',
    hours: 10,
    summary: 'Integração contínua e entrega contínua (CI/CD) para modelos, rastreamento de experimentos com MLflow, monitoramento de data drift e deploy no Render/Cloud.',
    competencies: [
      'Implementar pipelines de CI/CD para retreinamento automático de modelos',
      'Monitorar degradação de acurácia e desvio de dados (drift) em produção',
      'Executar deploy em ambientes escaláveis de computação em nuvem (Render, GCP)',
    ],
    localMaterialPath: '/cursos/modulo-3/15-mlops-deploy',
    totalLessons: 1,
  },
  {
    id: 'disc-16',
    order: 16,
    code: 'ASS-304',
    moduleId: 3,
    title: 'Planejamento de Assistentes em Inteligência Artificial',
    hours: 10,
    summary: 'Arquitetura de agentes autônomos, chamadas de ferramentas (Function Calling), orquestração de diálogos multi-etapas e design instrucional centrado no usuário.',
    competencies: [
      'Projetar fluxos de conversação complexos e resolução autônoma de tarefas',
      'Conectar assistentes a bancos de dados externos e ferramentas via APIs',
      'Garantir barreiras de segurança (guardrails) e alinhamento do assistente',
    ],
    localMaterialPath: '/cursos/modulo-3/16-assistentes-ia',
    totalLessons: 1,
  },
  {
    id: 'disc-17',
    order: 17,
    code: 'LLM-305',
    moduleId: 3,
    title: 'LLMs e Inteligência Artificial',
    hours: 10,
    summary: 'Fundamentos de Transformers, atenção multi-cabeça, Prompt Engineering avançado, RAG (Retrieval-Augmented Generation), fine-tuning e modelos Gemini.',
    competencies: [
      'Arquitetar sistemas RAG com bancos de dados vetoriais e embeddings',
      'Aplicar técnicas modernas de engenharia de prompts estruturados',
      'Utilizar o SDK @google/genai com streaming e tratamento robusto de erros',
    ],
    localMaterialPath: '/cursos/modulo-3/17-llms-ia',
    totalLessons: 1,
  },
  {
    id: 'disc-18',
    order: 18,
    code: 'VIS-306',
    moduleId: 3,
    title: 'Visão Computacional Aplicada',
    hours: 10,
    summary: 'Processamento de imagens com OpenCV, detecção de objetos (YOLO), segmentação semântica, reconhecimento facial e aplicações industriais.',
    competencies: [
      'Pré-processar imagens e vídeos com transformações geométricas e filtros',
      'Treinar e inferir modelos de detecção de objetos em tempo real',
      'Integrar visão computacional com sistemas de automação e controle',
    ],
    localMaterialPath: '/cursos/modulo-3/18-visao-computacional',
    totalLessons: 1,
  },
  {
    id: 'disc-19',
    order: 19,
    code: 'GP-307',
    moduleId: 3,
    title: 'Gestão de Projetos em Inteligência Artificial',
    hours: 10,
    summary: 'Metodologias ágeis (Scrum, Kanban) aplicadas ao ciclo de vida de dados (CRISP-DM), estimativa de incerteza, KPIs de negócio e governança de entregas.',
    competencies: [
      'Gerenciar ciclos de sprints de experimentação e entrega em equipes de IA',
      'Alinhar métricas técnicas (F1, MSE) a objetivos estratégicos de negócio',
      'Mapear riscos técnicos, prazos e custos computacionais de modelos',
    ],
    localMaterialPath: '/cursos/modulo-3/19-gestao-projetos-ia',
    totalLessons: 1,
  },
  {
    id: 'disc-20',
    order: 20,
    code: 'PPS-308',
    moduleId: 3,
    title: 'Prática Profissional Supervisionada II',
    hours: 10,
    summary: 'Trabalho de Conclusão de Curso (TCC) aplicado: desenvolvimento, implantação em produção e defesa de uma solução tecnológica completa em IA.',
    competencies: [
      'Desenvolver uma solução full-stack com agente ou modelo de IA em produção',
      'Defender o projeto perante banca avaliadora com demonstração ao vivo',
      'Elaborar documentação técnica final e repositório de código aberto',
    ],
    localMaterialPath: '/cursos/modulo-3/20-pratica-supervisionada-2',
    totalLessons: 1,
  },
];

export function getDisciplineLessons(disciplineId: string): Lesson[] {
  const discipline = DISCIPLINES.find((d) => d.id === disciplineId);
  if (!discipline) return [];

  const discNum = String(discipline.order || 1).padStart(2, '0');
  const count = 1; // Apenas a primeira aula de cada disciplina
  const lessons: Lesson[] = [];

  for (let i = 1; i <= count; i++) {
    const isFirst = i === 1;
    lessons.push({
      id: `${disciplineId}-aula-${i}`,
      disciplineId,
      order: i,
      title: `Aula 0${i}: ${getLessonTitle(discipline.code, i)}`,
      summary: `Estudo guiado dos conceitos fundamentais, laboratório prático e avaliação de fixação da Aula 0${i}.`,
      steps: [
        {
          stepNumber: 1,
          type: 'video',
          title: 'Vídeo-Aula Explicativa',
          description: 'Apresentação expositiva conceitual (Material audiovisual em gravação pelo estúdio institucional; conteúdo coberto na apostila técnica).',
          requiredTimeMinutes: 25,
          assetUrl: `${discipline.localMaterialPath}/video-aula-${discNum}.mp4`,
          isAvailable: false, // Em produção institucional; ativação automática ao adicionar o arquivo
        },
        {
          stepNumber: 2,
          type: 'slides',
          title: 'Slides de Apresentação',
          description: 'Lâminas didáticas sintetizadas em PDF disponíveis fisicamente no acervo local da disciplina.',
          requiredTimeMinutes: 15,
          assetUrl: `${discipline.localMaterialPath}/slides-aula-${discNum}.pdf`,
          isAvailable: true, // Arquivo PDF gerado e disponível fisicamente no diretório
        },
        {
          stepNumber: 3,
          type: 'pdf',
          title: 'Material Didático em PDF',
          description: 'Apostila técnica completa em PDF (Material didático oficial em produção disponível no acervo local).',
          requiredTimeMinutes: 30,
          assetUrl: `${discipline.localMaterialPath}/apostila-aula-${discNum}.pdf`,
          isAvailable: true, // Arquivo PDF gerado e disponível fisicamente no diretório
        },
        {
          stepNumber: 4,
          type: 'quiz',
          title: 'Teste de Fixação',
          description: 'Avaliação conceitual objetiva com nota mínima 7.0 para validação do aprendizado.',
          requiredTimeMinutes: 10,
          isAvailable: true,
        },
        {
          stepNumber: 5,
          type: 'next_unlock',
          title: 'Conclusão da Aula e Liberação da Avaliação Final',
          description: 'Conclusão formal registrada no banco de dados e desbloqueio da Avaliação Final da disciplina.',
          isAvailable: true,
        },
      ],
    });
  }

  return lessons;
}

function getLessonTitle(code: string, lessonNumber: number): string {
  const titles: Record<string, string[]> = {
    'INF-101': [
      'Introdução à Arquitetura de Computadores e Sistemas Operacionais',
      'Dominando o Terminal Linux e Comandos Essenciais',
      'Controle de Versão com Git e Fluxos no GitHub',
      'Gerenciamento de Pacotes e Ambientes Virtuais',
    ],
    'LOG-102': [
      'Fundamentos de Raciocínio Algorítmico e Pseudocódigo',
      'Estruturas de Decisão Condicional e Operadores Lógicos',
      'Laços de Repetição e Eficiência de Algoritmos',
      'Vetores, Matrizes e Modularização com Funções',
    ],
    'PYT-103': [
      'Sintaxe Python Moderna, Variáveis e Tipagem Dinâmica',
      'Estruturas de Dados Nativas: Listas, Dicionários e Sets',
      'Funções, Parâmetros Arbitrários e Lambdas',
      'Programação Orientada a Objetos: Classes, Objetos e Métodos',
      'Manipulação de Arquivos, JSON e Tratamento de Exceções',
    ],
  };

  const defaultTitles = [
    'Conceitos Teóricos e Fundamentos Metodológicos',
    'Laboratório Prático e Implementação Técnica',
    'Estudo de Casos Reais e Resolução de Problemas',
    'Tópicos Avançados e Integração de Ferramentas',
    'Síntese Curricular e Avaliação de Competências',
  ];

  if (titles[code] && titles[code][lessonNumber - 1]) {
    return titles[code][lessonNumber - 1];
  }
  return defaultTitles[lessonNumber - 1] || `Tópico Temático da Aula 0${lessonNumber}`;
}

export function calculateTotalHours(): number {
  return DISCIPLINES.reduce((acc, curr) => acc + curr.hours, 0);
}

import { FinalExamQuestion } from '../types/index.ts';

export function getDisciplineFinalExam(disciplineId: string): FinalExamQuestion[] {
  const discipline = DISCIPLINES.find((d) => d.id === disciplineId) || DISCIPLINES[0];
  const questions: FinalExamQuestion[] = [];

  const questionTemplates = [
    {
      q: `Em ${discipline.title}, qual é o princípio orientador fundamental para assegurar a reprodutibilidade dos experimentos?`,
      opts: [
        'Execução em notebooks locais sem controle de versão ou dependências.',
        'Versionamento estrito do código, sementes aleatórias (seeds), dados e ambientes de execução isolados.',
        'Armazenamento dos modelos apenas na memória RAM sem serialização.',
        'Utilização exclusiva de bibliotecas sem documentação técnica.',
      ],
    },
    {
      q: `Considerando as competências de ${discipline.code}, como a validação cruzada contribui para a robustez de modelos?`,
      opts: [
        'Aumenta o risco de vazamento de dados (data leakage) em todas as partições.',
        'Garante que os hiperparâmetros sejam selecionados aleatoriamente em produção.',
        'Permite estimar a capacidade de generalização do modelo e mitigar o sobreajuste (overfitting).',
        'Substitui a necessidade de métricas de avaliação quantitativas.',
      ],
    },
    {
      q: `Na arquitetura de software e dados para ${discipline.title}, qual é o papel das restrições de integridade referencial?`,
      opts: [
        'Garantir a consistência lógica entre entidades relacionadas, impedindo registros órfãos.',
        'Desabilitar índices de busca para acelerar comandos SELECT.',
        'Impedir que qualquer usuário autenticado leia os dados de suas próprias sessões.',
        'Executar migrações assíncronas sem transações ACID.',
      ],
    },
    {
      q: `No desenvolvimento com foco em ${discipline.summary.slice(0, 50)}..., qual prática de segurança deve ser observada?`,
      opts: [
        'Inserir chaves secretas de APIs nos arquivos JavaScript públicos do frontend.',
        'Isolar segredos em variáveis de ambiente acessíveis unicamente pelo backend e proteger endpoints com autenticação e rate limiting.',
        'Confiar exclusivamente no navegador do cliente para validar autorizações de acesso.',
        'Registrar senhas e tokens de autenticação em texto claro nos logs do sistema.',
      ],
    },
    {
      q: `Qual é o impacto ético e de governança mais relevante abordado no percurso formativo de ${discipline.code}?`,
      opts: [
        'A detecção e mitigação de vieses algorítmicos em conjuntos de dados e a conformidade com a LGPD.',
        'A priorização da velocidade de inferência sobre qualquer consideração de privacidade.',
        'A eliminação de auditorias humanas em decisões críticas de sistemas de IA.',
        'A recusa em documentar limitações ou margens de erro de modelos automatizados.',
      ],
    },
    {
      q: `Durante o ciclo de vida de modelos em ${discipline.title}, o que caracteriza o fenômeno de data drift?`,
      opts: [
        'A alteração da distribuição estatística dos dados de entrada em produção em relação aos dados de treino.',
        'A perda física de conexão de rede com o banco de dados relacional.',
        'O aumento instantâneo do tamanho do arquivo de pesos da rede neural.',
        'O cancelamento automático de assinaturas de cookies de sessão.',
      ],
    },
    {
      q: `No contexto de ${discipline.title}, qual estratégia técnica otimiza o tempo de resposta em consultas complexas?`,
      opts: [
        'Criação de índices B-tree nos campos frequentemente filtrados e análise de planos de execução (EXPLAIN).',
        'Remoção de todas as chaves primárias e chaves estrangeiras da base de dados.',
        'Execução de varredura completa da tabela (Seq Scan) para todas as requisições.',
        'Transferência de toda a lógica relacional para o frontend.',
      ],
    },
    {
      q: `Ao projetar pipelines de dados e IA em ${discipline.code}, qual é a finalidade de contêineres e imagens Docker?`,
      opts: [
        'Empacotar aplicação, bibliotecas e dependências de sistema em um ambiente padronizado e portável.',
        'Substituir completamente o banco de dados PostgreSQL em produção.',
        'Aumentar o acoplamento do sistema ao hardware específico da máquina de desenvolvimento.',
        'Eliminar a necessidade de testes de unidade e integração.',
      ],
    },
    {
      q: `Em ambientes de produção no Render.com, como deve ser gerenciada a persistência de arquivos gerados pela aplicação?`,
      opts: [
        'Gravando diretamente no sistema de arquivos local da instância efêmera sem volumes.',
        'Utilizando discos persistentes montados (Render Persistent Disk) ou Object Storage (S3/GCS/R2) com URLs controladas.',
        'Armazenando arquivos binários pesados como strings no localStorage do navegador.',
        'Descartando qualquer arquivo ao término de cada requisição HTTP.',
      ],
    },
    {
      q: `Qual critério acadêmico é obrigatório para aprovação nesta Avaliação Final do componente ${discipline.code}?`,
      opts: [
        'Obtenção de nota igual ou superior a 7,0 (70% de aproveitamento) calculada estritamente pelo backend.',
        'Apenas visualização das questões sem submissão de respostas.',
        'Acerto de pelo menos 1 questão das 10 apresentadas.',
        'Solicitação verbal ao assistente de inteligência artificial.',
      ],
    },
  ];

  for (let i = 0; i < 10; i++) {
    const item = questionTemplates[i];
    questions.push({
      id: `${discipline.id}-final-q${i + 1}`,
      disciplineId: discipline.id,
      questionNumber: i + 1,
      question: `${i + 1}. ${item.q}`,
      options: item.opts,
    });
  }

  return questions;
}
