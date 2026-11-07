import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootCoursesDir = path.resolve(__dirname, '../../public/cursos');

/**
 * Utilitário para gerar arquivo PDF 1.4 binário padronizado sem dependências externas.
 */
function generateValidPDF(title: string, author: string, pages: Array<{ header: string; text: string }>): Buffer {
  const objects: string[] = [];
  
  // 1. Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  
  // 2. Pages
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj`);
  
  pages.forEach((page, i) => {
    const pageObjNum = 3 + i * 3;
    const contentObjNum = 4 + i * 3;
    const fontObjNum = 5 + i * 3;
    
    objects.push(`${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>\nendobj`);
    
    // Cabeçalho institucional padronizado para modo de produção oficial
    const headerL1 = 'CAMPOS IA — PRE-CURSO DE INTELIGENCIA ARTIFICIAL (200 HORAS)';
    const headerL2 = 'MATERIAL DIDATICO INSTITUCIONAL — MODO DE PRODUCAO';
    const headerL3 = 'Ambiente Virtual de Aprendizagem Oficial • Rede Federal de Educacao Profissional e Tecnologica';
    const fullText = `[${title.toUpperCase()} - PAGINA ${i + 1}]\n${headerL1}\n${headerL2}\n${headerL3}\n\n${page.header}\n\n${page.text}`;
    const lines = fullText.split('\n').filter(l => l.trim().length > 0);
    
    let streamText = 'BT\n/F1 11 Tf\n45 740 Td\n15 TL\n';
    lines.forEach((line) => {
      const words = line.split(' ');
      let currentLine = '';
      words.forEach((w) => {
        if (!currentLine) {
          currentLine = w;
        } else if ((currentLine + ' ' + w).length <= 75) {
          currentLine += ' ' + w;
        } else {
          const escaped = currentLine.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
          streamText += `(${escaped}) '\n`;
          currentLine = w;
        }
      });
      if (currentLine) {
        const escaped = currentLine.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
        streamText += `(${escaped}) '\n`;
      }
    });
    streamText += 'ET';
    
    const streamLen = Buffer.byteLength(streamText, 'utf8');
    objects.push(`${contentObjNum} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream\nendobj`);
    objects.push(`${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`);
  });
  
  let body = '%PDF-1.4\n';
  const offsets: number[] = [0];
  
  objects.forEach((obj) => {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += obj + '\n';
  });
  
  const xrefOffset = Buffer.byteLength(body, 'utf8');
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    const offsetStr = String(offsets[i]).padStart(10, '0');
    xref += `${offsetStr} 00000 n \n`;
  }
  
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer, 'utf8');
}

/**
 * Definição estruturada de materiais didáticos para todos os 20 componentes curriculares oficiais.
 */
export const ALL_DISCIPLINES_MATERIALS = [
  // =========================================================================
  // MÓDULO I — FUNDAMENTOS DE COMPUTAÇÃO E MATEMÁTICA PARA IA (6 DISCIPLINAS)
  // =========================================================================
  {
    dir: 'modulo-1/01-fundamentos',
    pdfName: 'apostila-fundamentos-sistemas-linux.pdf',
    title: 'INF-101: Fundamentos de Informatica e Linux CLI',
    pages: [
      {
        header: 'Secao 1: Arquitetura de Hardware e Aceleracao para Inteligencia Artificial',
        text: 'Redes neurais modernas demandam operacoes massivas de algebra linear, especificamente multiplicacoes de matrizes densas conhecidas como GEMM. Enquanto CPUs sao otimizadas para processamento serial com branches complexos, GPUs e TPUs sao microarquitetadas para paralelismo massivo em milhares de nucleos simultaneos. Tensor Cores operam com precisao mista (FP16, BF16 e INT8), reduzindo a saturacao do barramento PCIe e permitindo que tensores volumosos caibam na memoria HBM de alta largura de banda.'
      },
      {
        header: 'Secao 2: Sistemas Operacionais Linux e Terminal CLI em Ciencia de Dados',
        text: 'O terminal Linux e a interface padrao para orquestracao de experimentos, computacao em nuvem e clusters de treinamento de IA. Comandos essenciais incluem navegacao no filesystem (ls -la, cd, mkdir -p), monitoramento de processos e utilizacao de GPU (ps aux, top, htop, nvidia-smi) e processamento em fluxo atraves de pipes Unix (|). O utilitario grep filtra logs de treino, awk realiza operacoes tabulares sobre datasets CSV, e sed efetua transformacoes automatizadas de texto sem carregamento previo na memoria RAM.'
      },
      {
        header: 'Secao 3: Controle de Versao com Git e Ambientes Virtuais em Python',
        text: 'A reprodutibilidade cientifica em IA exige rastreamento rigoroso do codigo-fonte e dos hiperparametros. O versionamento via Git deve obedecer ao principio de commits atomicos com mensagens semanticas. Datasets volumosos e checkpoints de pesos treinados (como .pt, .onnx, .safetensors) nunca devem ser commitados no Git; utiliza-se o arquivo .gitignore e ferramentas de versionamento de dados como DVC. Cada projeto deve ser isolado em um ambiente virtual criado com python -m venv .venv para prevenir incompatibilidade de dependencias.'
      }
    ]
  },
  {
    dir: 'modulo-1/02-logica',
    pdfName: 'apostila-logica-algoritmos.pdf',
    title: 'LOG-102: Logica de Programacao e Algoritmos',
    pages: [
      {
        header: 'Secao 1: Notacao Big-O e Complexidade Assintotica de Algoritmos',
        text: 'A analise assintotica mensura o crescimento do consumo de tempo e espaco de um algoritmo a medida que o tamanho da entrada N tende ao infinito. Operacoes de acesso direto em arrays e tabelas hash operam em tempo constante O(1). Algoritmos de busca binaria em bases ordenadas operam em O(log N). A ordenacao otima por comparacao (MergeSort e Timsort) atinge O(N log N). Algoritmos de ordenacao ingenua por lacos aninhados, como BubbleSort, degradam para O(N^2), tornando-se proibitivos para grandes massas de dados.'
      },
      {
        header: 'Secao 2: Estruturas de Dados Fundamentais e Modularizacao',
        text: 'Vetores sao blocos contiguos de memoria de tamanho estatico ou dinamico indexados a partir de zero. Matrizes bidimensionais representam tensores de ordem dois, essenciais para representar imagens digitais e tabelas de features. A modularizacao com funcoes puras divide problemas complexos em sub-rotinas testaveis e desacopladas, facilitando a manutencao de pipelines analiticos e a paralelizacao de processamento.'
      }
    ]
  },
  {
    dir: 'modulo-1/03-python',
    pdfName: 'apostila-python-aplicado-ia.pdf',
    title: 'PYTHON-103: Programacao em Python Aplicada a IA',
    pages: [
      {
        header: 'Secao 1: Ecossistema Cientifico de Python e Estruturas Nativas',
        text: 'Python e a linguagem dominante no desenvolvimento de Inteligencia Artificial devido a sua sintaxe expressiva e ao robusto ecossistema de bibliotecas nativas e cientificas. Estruturas como listas, tuplas imutaveis, conjuntos (sets com busca O(1)) e dicionarios sao amplamente utilizadas para ingestao e estruturacao de dados brutos. Compreensoes de lista (list comprehensions) e geradores (generators) permitem processamento em streaming com baixo footprint de memoria.'
      },
      {
        header: 'Secao 2: Computacao Vetorial com NumPy e Manipulacao com Pandas',
        text: 'A biblioteca NumPy fornece o objeto ndarray, permitindo operacoes vetorizadas implementadas em C com broadcasting sem necessidade de lacos for explicitos em Python. O Pandas organiza dados tabulares em DataFrames e Series, oferecendo metodos de alto desempenho para limpeza de valores ausentes (dropna, fillna), transformacao de colunas (apply, map), agregacoes agrupadas (groupby) e combinacao relacional de conjuntos de dados (merge, join).'
      },
      {
        header: 'Secao 3: Programacao Orientada a Objetos e Tratamento Robusto de Excecoes',
        text: 'O encapsulamento em classes modela componentes de aprendizado de maquina segundo o padrao de estimadores (fit, predict, transform). Blocos try-except-finally e criacao de excecoes customizadas garantem que falhas de IO ou inconsistencias em schemas de datasets sejam tratadas sem interromper pipelines de treino de longa duracao.'
      }
    ]
  },
  {
    dir: 'modulo-1/04-banco-dados',
    pdfName: 'apostila-bancos-dados-ia.pdf',
    title: 'BD-104: Bancos de Dados Relacionais e Vetoriais',
    pages: [
      {
        header: 'Secao 1: Modelagem Relacional, Normalizacao e PostgreSQL',
        text: 'Bancos de dados relacionais como o PostgreSQL asseguram a integridade transacional atraves das propriedades ACID (Atomicidade, Consistencia, Isolamento e Durabilidade). A normalizacao de dados elimina redundancias e anomalias de atualizacao por meio de chaves primarias (PK) e estrangeiras (FK). Indices B-Tree aceleram consultas filtradas por clausulas WHERE, enquanto transacoes com BEGIN e COMMIT previnem estados inconsistentes.'
      },
      {
        header: 'Secao 2: Bancos NoSQL e Bancos de Dados Vetoriais para RAG e IA',
        text: 'Bancos NoSQL baseados em documentos JSON (como MongoDB) ou chave-valor em memoria (como Redis) oferecem escalabilidade horizontal e flexibilidade de schema para telemetria de modelos. Na era dos Large Language Models, bancos de dados vetoriais (ou a extensao pgvector no PostgreSQL) armazenam embeddings numericos densos gerados por modelos de linguagem, permitindo buscas de similaridade semantica em larga escala via indices HNSW e IVFFlat com metricas de distancia de cosseno.'
      }
    ]
  },
  {
    dir: 'modulo-1/05-matematica-estatistica',
    pdfName: 'apostila-matematica-estatistica-ia.pdf',
    title: 'MAT-105: Matematica Computacional e Estatistica para IA',
    pages: [
      {
        header: 'Secao 1: Algebra Linear Aplicada e Multiplicacao de Matrizes',
        text: 'Tensores multidimensionais sao a base matematica de todas as representacoes neurais. O produto escalar (dot product) quantifica o alinhamento direcional entre dois vetores e e a operacao central do mecanismo de atencao (Attention Is All You Need) nos modelos Transformer. Autovalores, autovetores e Decomposicao em Valores Singulares (SVD) viabilizam a reducao de dimensionalidade em tecnicas como Analise de Componentes Principais (PCA).'
      },
      {
        header: 'Secao 2: Estatistica Descritiva, Probabilidade e Teorema de Bayes',
        text: 'Medidas de tendencia central (media aritmetica, mediana e moda) combinadas com medidas de dispersao (variancia, desvio-padrao e amplitude interquartil) caracterizam a distribuicao de features preditivas. O Teorema de Bayes formaliza a atualizacao da probabilidade a posteriori de uma hipotese a luz de novas evidencias observadas, constituindo a base de classificadores probabilisticos e modelos Bayesianos.'
      }
    ]
  },
  {
    dir: 'modulo-1/06-fundamentos-ia',
    pdfName: 'apostila-fundamentos-ia.pdf',
    title: 'IA-106: Introducao e Fundamentos da Inteligencia Artificial',
    pages: [
      {
        header: 'Secao 1: Evolucao Historica dos Paradigmas de Inteligencia Artificial',
        text: 'A Inteligencia Artificial evoluiu a partir do teste de Turing (1950) e da Conferencia de Dartmouth (1956). O paradigma simbolico (IA classica baseada em logica formal, sistemas especialistas e arvores de decisao com busca heuristica como A*) dominou as primeiras decadas. O paradigma conexionista (aprendizado estatistico e redes neurais artificiais) emergiu vitorioso gracas a disponibilidade de Big Data e processadores massivamente paralelos.'
      },
      {
        header: 'Secao 2: Taxonomia do Aprendizado de Maquina e Agentes Inteligentes',
        text: 'O Aprendizado de Maquina se subdivide em tres categorias centrais: 1. Aprendizado Supervisionado, no qual o modelo aprende um mapeamento entre entradas X e rotulos verdadeiros Y (regressao e classificacao); 2. Aprendizado Nao-Supervisionado, que descobre estruturas latentes e agrupamentos intrinsecos nos dados sem anotacoes previas (clustering, k-means, PCA); 3. Aprendizado por Reforco, onde um agente interage com um ambiente dinamico maximizando recompensas cumulativas.'
      }
    ]
  },

  // =========================================================================
  // MÓDULO II — APRENDIZADO DE MÁQUINA, DEEP LEARNING E PLN (6 DISCIPLINAS)
  // =========================================================================
  {
    dir: 'modulo-2/07-python-ciencia-dados',
    pdfName: 'apostila-python-ciencia-dados.pdf',
    title: 'CD-201: Python para Ciencia de Dados',
    pages: [
      {
        header: 'Secao 1: Objetivos de Aprendizagem e Manipulacao Estruturada com Pandas',
        text: 'Esta unidade capacita o estudante a ingerir, auditar e transformar bases de dados complexas para pipelines analiticos. Compreende o uso aprofundado de DataFrames e Series, indexacao booleana avancada, tratamento de valores nulos via tecnicas estatisticas de imputacao e conversoes categoricas (One-Hot Encoding, Ordinal Encoding) sem vazamento de dados (data leakage).'
      },
      {
        header: 'Secao 2: Analise Exploratoria e Visualizacao Grafica com Matplotlib e Seaborn',
        text: 'A analise exploratoria orientada por hipoteses emprega graficos de dispersao para correlacoes bivariadas, boxplots para deteccao de anomalias (outliers) pelo criterio de 1.5 IQR e histogramas com estimativa de densidade de kernel (KDE). Matrizes de correlacao de Pearson e Spearman expoe multicolinearidade entre atributos preditivos antes da etapa de modelagem.'
      },
      {
        header: 'Secao 3: Pipelines Automatizados de Transformacao com Scikit-Learn',
        text: 'A classe Pipeline e o ColumnTransformer encapsulam etapas sequenciais de padronizacao (StandardScaler), normalizacao min-max e transformacoes matematicas (log-transform, Yeo-Johnson). O encapsulamento garante que parametros como media e variancia sejam calculados exclusivamente no conjunto de treino (split de treino) e replicados sem reajuste no teste.'
      },
      {
        header: 'Secao 4: Atividades Praticas e Referencias Tecnicas Recomendadas',
        text: 'Atividade 1: Carregar conjunto tabular publico, efetuar imputacao de valores faltantes e gerar visualizacoes comparativas de features. Referencias essenciais: McKinney, Wes (Python for Data Analysis, O Reilly); VanderPlas, Jake (Python Data Science Handbook).'
      }
    ]
  },
  {
    dir: 'modulo-2/08-ml-aplicado',
    pdfName: 'apostila-ml-aplicado.pdf',
    title: 'MLA-202: Machine Learning Aplicado',
    pages: [
      {
        header: 'Secao 1: Algoritmos Supervisionados de Regressao e Classificacao',
        text: 'Regressoes lineares e logisticas utilizam otimizacao convexa por gradiente descendente com regularizacao L1 (Lasso) para selecao de features esparsas e L2 (Ridge) contra multicolinearidade. Arvores de decisao particionam o espaco amostral maximizando o ganho de informacao por Entropia de Shannon ou indice de Gini, servindo de base para ensambles poderosos como Random Forests e Gradient Boosting (XGBoost, LightGBM).'
      },
      {
        header: 'Secao 2: Metodos de Margem e Agrupamento Nao-Supervisionado',
        text: 'Support Vector Machines (SVM) encontram o hiperplano separador com margem maxima entre classes, utilizando o truque do kernel (RBF Gaussiano, Polinomial) para mapeamento em espacos de dimensão infinita. No agrupamento nao-supervisionado, o algoritmo K-Means minimiza a inercia intra-cluster via metodo do cotovelo (Elbow Method) e score de silhueta, enquanto PCA reduz a dimensionalidade preservando a variancia maxima explicada.'
      },
      {
        header: 'Secao 3: Validacao Cruzada e Metricas Rigorosas de Avaliacao',
        text: 'A divisao estratificada K-Fold previne desbalanceamento amostral. A avaliacao em classificacao binaria e multiclasse deve transcender a acuracia global: analisa-se a Matriz de Confusao, Precisao, Revocacao (Recall), F1-Score balanceado e a curva ROC com calculo da area sob a curva (AUC-ROC), essencial para diagnosticar taxas de falsos positivos e falsos negativos.'
      },
      {
        header: 'Secao 4: Exemplo de Implementacao e Exercicios de Fixacao',
        text: 'Exemplo: Treinamento de estimador RandomForestClassifier com GridSearchCV para ajuste fino de max_depth e n_estimators. Atividade: Comparar acuracia balanceada e F1-score em dataset com 95% de classe majoritaria. Referencias: Hastie, Tibshirani & Friedman (The Elements of Statistical Learning); Geron, Aurelien (Hands-On Machine Learning).'
      }
    ]
  },
  {
    dir: 'modulo-2/09-deep-learning',
    pdfName: 'apostila-deep-learning.pdf',
    title: 'DL-203: Redes Neurais Artificiais e Deep Learning',
    pages: [
      {
        header: 'Secao 1: Fundamentos do Perceptron Multicamadas e Algoritmo de Backpropagation',
        text: 'Redes Neurais Profundas (Deep Learning) empilham camadas lineares densas alternadas com funcoes de ativacao nao-lineares (ReLU, Leaky ReLU, GeLU, Sigmoid e Softmax), permitindo aproximar qualquer funcao continua de acordo com o Teorema da Aproximacao Universal. O algoritmo de retropropagacao (Backpropagation) propaga o erro da funcao de perda da saida para a entrada utilizando a regra da cadeia do calculo diferencial.'
      },
      {
        header: 'Secao 2: Otimizadores Estocasticos e Regularizacao em Redes Neurais',
        text: 'O algoritmo SGD com momento acelera o gradiente em direcoes consistentes e amortiza oscilacoes. Otimizadores adaptativos como Adam e AdamW calculam taxas de aprendizado individuais baseadas no primeiro e segundo momentos dos gradientes com desacoplamento de decaimento de peso (weight decay). Tecnicas como Dropout e Normalizacao em Lote (Batch Normalization) mitigam o desaparecimento do gradiente e o sobreajuste (overfitting).'
      },
      {
        header: 'Secao 3: Redes Convolucionais (CNN) e Redes Recorrentes (RNN e LSTM)',
        text: 'Camadas convolucionais aplicam filtros espaciais que preservam invariancia translacional em imagens, combinadas com operacoes de pooling para diminuicao de resolucao. Para dados sequenciais temporais e texto, redes LSTM (Long Short-Term Memory) e GRU incorporam portoes de esquecimento (forget gates) e atualizacao de celula, resolvendo o problema do gradiente que explode ou desaparece ao longo de passos temporais longos.'
      },
      {
        header: 'Secao 4: Transfer Learning e Implementacao em PyTorch',
        text: 'Transfer Learning consiste em aproveitar pesos convolucionais de redes pre-treinadas (como ResNet e EfficientNet treinadas na ImageNet) e congelar as camadas base, ajustando apenas a cabeca densa classificadora final. Atividade: Construir um classificador de tensores com PyTorch definindo a classe nn.Module, metodo forward e laco de treinamento supervisionado. Referencia: Goodfellow, Bengio & Courville (Deep Learning, MIT Press).'
      }
    ]
  },
  {
    dir: 'modulo-2/10-pln-chatbots',
    pdfName: 'apostila-pln-chatbots.pdf',
    title: 'PLN-204: Processamento de Linguagem Natural e Chatbots',
    pages: [
      {
        header: 'Secao 1: Pre-processamento Textual e Modelagem Bag-of-Words/TF-IDF',
        text: 'O processamento de texto inicia-se pela normalizacao de caracteres Unicode, remocao de pontuacao, conversao para caixa baixa e segmentacao em tokens lexicais. A lematizacao reduz palavras ao seu lema morfologico canonical, enquanto a contagem TF-IDF (Term Frequency-Inverse Document Frequency) pondera a raridade informacional de termos em relacao ao corpus documental, atenuando a influencia desproporcional de termos excessivamente frequentes.'
      },
      {
        header: 'Secao 2: Embeddings Semanticos e Modelos de Espaco Vetorial',
        text: 'Modelos de distribuicao semantica como Word2Vec (arquiteturas Skip-gram e CBOW), GloVe e FastText mapeiam palavras em vetores densos em espacos geometricos continuos R^D, preservando relacoes de analogia vetorial (Rei - Homem + Mulher aprox Rainha). A similaridade semantica e quantificada pelo cosseno do angulo entre vetores, calculada pelo produto escalar normalizado pelas normas euclidianas dos vetores.'
      },
      {
        header: 'Secao 3: Arquiteturas de Chatbots e Reconhecimento de Intencoes (NLU)',
        text: 'Sistemas conversacionais orientados a tarefas fundamentam-se em dois modulos principais de NLU: Classificacao de Intencao (identificacao do objetivo do usuario, ex: consultar_nota) e Extracao de Entidades (Named Entity Recognition - NER, ex: disciplina=LOG-102). O gerenciador de dialogo rastreia o estado da sessao (slot filling) e dispara acoes deterministicas ou respostas generativas contextuais.'
      },
      {
        header: 'Secao 4: Avaliacao de Coerencia Conversacional e Laboratorio',
        text: 'Metricas automaticas como BLEU, ROUGE e perplexidade avaliam similaridade com respostas humanas de referencia. Atividade pratica: Construir pipeline de classificacao de intencoes com TF-IDF e LogisticRegression para um bot de suporte academico. Referencia: Jurafsky, Daniel & Martin, James (Speech and Language Processing, 3rd ed).'
      }
    ]
  },
  {
    dir: 'modulo-2/11-metodologia',
    pdfName: 'apostila-metodologia-tecnica.pdf',
    title: 'MET-205: Metodologia para Elaboracao de Producoes Tecnicas',
    pages: [
      {
        header: 'Secao 1: Estrutura Canonica de Relatorios Tecnicos e Normas ABNT',
        text: 'A comunicacao cientifica e profissional na area de tecnologia rege-se por padroes estruturais precisos (ABNT NBR 10719 para relatorios tecnicos e NBR 6023 para citacoes e referencias). Um relatorio de engenharia de IA estrutura-se em: 1. Contextualizacao do Problema e Justificativa; 2. Objetivos Gerais e Especificos; 3. Metodologia de Coleta e Engenharia de Features; 4. Arquitetura e Modelagem; 5. Analise Critica de Resultados e Conclusao.'
      },
      {
        header: 'Secao 2: Reprodutibilidade Cientifica e Documentacao de Experimentos de IA',
        text: 'A reprodutibilidade exige a fixacao de sementes aleatorias (random seeds) em bibliotecas como NumPy, PyTorch e Scikit-Learn, o registro exato de versoes no requirements.txt e a documentacao de hiperparametros. A adocao de Model Cards (fichas tecnicas de modelos) detalha casos de uso pretendidos, metricas de desempenho em subgrupos, limitacoes operacionais e analise de riscos eticos de implantacao.'
      },
      {
        header: 'Secao 3: Comunicacao Tecnica e Visualizacao para Tomadores de Decisao',
        text: 'Engenheiros de IA devem traduzir indicadores tecnicos (como Loss logaritmica ou F1-score) em impactos economicos e operacionais tangiveis (como reducao de custos de triagem ou aumento de precisao de diagnostico). Graficos explicativos devem conter rotulos de eixos claros, unidades de medida explicitas e legendas compreensiveis sem ambiguidade.'
      },
      {
        header: 'Secao 4: Roteiro Pratico de Producao Tecnica e Referencias',
        text: 'Atividade: Elaborar um Model Card completo para um classificador preditivo, detalhando dados de treino, limitacoes operacionais e metricas de equidade. Referencias: Gil, Antonio Carlos (Como Elaborar Projetos de Pesquisa); Mitchell et al. (Model Cards for Model Reporting, ACM FAT).'
      }
    ]
  },
  {
    dir: 'modulo-2/12-pratica-supervisionada-1',
    pdfName: 'apostila-pratica-supervisionada-1.pdf',
    title: 'PPS-206: Pratica Profissional Supervisionada I',
    pages: [
      {
        header: 'Secao 1: Diretrizes e Concepcao do Projeto Integrador de Aprendizado de Maquina',
        text: 'A Pratica Profissional Supervisionada I integra conhecimentos de Ciencia de Dados e Machine Learning em um problema concreto da comunidade ou do setor produtivo. Segue o ciclo de vida padrao CRISP-DM (Cross-Industry Standard Process for Data Mining): Compreensao do Negocio, Compreensao dos Dados, Preparacao dos Dados, Modelagem, Avaliacao e Implantacao Experimental.'
      },
      {
        header: 'Secao 2: Protocolo de Ingestao e Validacao de Dados Reais',
        text: 'Estudantes devem realizar auditoria rigorosa de qualidade dos dados coletados: identificacao de valores duplicados, analise de completude de atributos obrigatorios, remocao ou mitigacao de outliers espurios e garantia de representatividade amostral sem viés sistematico de selecao antes de qualquer treino computacional.'
      },
      {
        header: 'Secao 3: Benchmark e Comparacao Empirica de Modelos Preditivos',
        text: 'E obrigatorio comparar ao menos tres modelos concorrentes: um baseline deterministico ou linear simples, um modelo baseado em arvores de decisao e um modelo ensamble ou rede neural. A selecao do modelo vencedor deve basear-se em criterios de desempenho estatistico (F1-score balanceado) e restricoes de tempo de inferencia e consumo de memoria.'
      },
      {
        header: 'Secao 4: Entregaveis Obrigatorios e Criterios de Aprovacao',
        text: 'Os entregaveis exigidos compreendem: 1. Repositorio de codigo versionado e documentado com README tecnico; 2. Pipeline reprodutivel de treino e inferencia; 3. Relatorio tecnico intermediario seguindo padroes ABNT. A avaliacao docente pondera rigor metodologico, clareza da apresentacao e viabilidade da solucao desenvolvida.'
      }
    ]
  },

  // =========================================================================
  // MÓDULO III — MLOPS, LLMS, GOVERNANÇA E APLICAÇÕES AVANÇADAS (8 DISCIPLINAS)
  // =========================================================================
  {
    dir: 'modulo-3/13-seguranca-lgpd',
    pdfName: 'apostila-seguranca-lgpd-dados.pdf',
    title: 'SEG-301: Seguranca, Governanca de Dados e LGPD Aplicada',
    pages: [
      {
        header: 'Secao 1: Marco Legal da LGPD (Lei 13.709/2018) no Contexto de Inteligencia Artificial',
        text: 'A Lei Geral de Protecao de Dados estabelece principios fundamentais para o tratamento de dados pessoais em sistemas de IA: Finalidade, Adequacao, Necessidade (minimizacao de dados), Livre Acesso, Seguranca e Nao-Discriminacao. O processamento para treino de modelos exige enquadramento em bases legais explicitas (como consentimento do titular ou legitimo interesse) e mecanismos de auditoria para atender solicitacoes de explicabilidade algoritmica.'
      },
      {
        header: 'Secao 2: Tecnicas de Anonimizacao e Privacidade Diferencial',
        text: 'A anonimizacao efetiva remove o vinculo causal entre o dado e a pessoa natural. O modelo k-Anonimato garante que qualquer individuo nao seja distinguivel de pelo menos k-1 outros individuos em atributos quase-identificadores. A Privacidade Diferencial adiciona ruido matematico controlado (calibrado pela distribuicao de Laplace ou Gaussiana) aos gradientes ou consultas estatisticas, garantindo protecao formal contra ataques de inferencia de associacao (membership inference).'
      },
      {
        header: 'Secao 3: Auditoria de Vies Algoritmico e Seguranca Cibernetica de Modelos',
        text: 'Vieses historicos presentes nos dados de treinamento podem amplificar discriminacoes sistemicas. Metricas de equidade (como Paridade Demografica e Igualdade de Oportunidades) devem ser auditadas. Em cibersegurança de IA, defesas contra ataques de envenenamento de dados (data poisoning), ataques adversariais com perturbacao de pixels e extracao indevida de pesos (model inversion) devem ser implementadas nos pipelines.'
      },
      {
        header: 'Secao 4: Relatorio de Impacto a Protecao de Dados (RIPD) e Pratica',
        text: 'Atividade: Elaborar secao de avaliacao de riscos em um Relatorio de Impacto a Protecao de Dados (RIPD) para um sistema automatizado de analise de credito. Referencias: Legislacao oficial (Lei 13.709/2018); Guias Orientativos da Autoridade Nacional de Protecao de Dados (ANPD); Barocas, Hardt & Narayanan (Fairness and Machine Learning).'
      }
    ]
  },
  {
    dir: 'modulo-3/14-engenharia-software-ia',
    pdfName: 'apostila-engenharia-software-ia.pdf',
    title: 'ES-302: Engenharia de Software para Sistemas de IA',
    pages: [
      {
        header: 'Secao 1: Principios Arquiteturais de Software e Clean Code em IA',
        text: 'Sistemas com componentes de IA exigem separacao rigida entre regras de negocio deterministicas, pipelines de engenharia de atributos e motores probabilisticos de inferencia. Os principios SOLID (como Responsabilidade Unica e Inversao de Dependencia) orientam a criacao de interfaces abstratas para modelos, permitindo trocar algoritmos subjacentes sem impactar consumidores downstream.'
      },
      {
        header: 'Secao 2: Desenvolvimento Orientado a Testes (TDD) para Dados e Modelos',
        text: 'Diferentemente do software tradicional, sistemas de IA falham silenciosamente atraves de degradacao estatistica. Testes automatizados dividem-se em: 1. Testes unitarios de transformacoes de dados; 2. Testes de integridade de schemas de entrada (validacao com Pydantic ou Zod); 3. Testes de invariancia e sensibilidade direcional de previsoes; 4. Testes de regressao de desempenho minimo garantido.'
      },
      {
        header: 'Secao 3: APIs RESTful Assincronas e Empacotamento em Conteineres Docker',
        text: 'Modelos em producao sao servidos via endpoints RESTful assincronos de alta performance (construidos em Express ou FastAPI) com serializacao JSON estrita. O empacotamento em imagens Docker multicamadas (multi-stage builds) isola drivers CUDA, compiladores C++ e dependencias Python, gerando imagens leves, imutaveis e reproduziveis em qualquer nuvem publica.'
      },
      {
        header: 'Secao 4: Padroes de Projeto em Machine Learning e Laboratorio',
        text: 'Aplicacao dos padroes Strategy (para alternar algoritmos em tempo de execucao) e Decorator (para injetar telemetria e calculo de latencia em chamadas de predict). Atividade: Escrever Dockerfile otimizado e suite de testes unitarios em pytest para uma API de inferencia preditiva. Referencias: Martin, Robert (Clean Code); Fowler, Martin (Patterns of Enterprise Application Architecture).'
      }
    ]
  },
  {
    dir: 'modulo-3/15-mlops-deploy',
    pdfName: 'apostila-mlops-deploy.pdf',
    title: 'MLO-303: MLOps e Praticas de Deploy Continuo',
    pages: [
      {
        header: 'Secao 1: Fundamentos de MLOps e Niveis de Maturidade Operacional',
        text: 'MLOps une Machine Learning, Engenharia de Software e Operacoes de TI para automatizar o ciclo de vida completo de modelos. O Google define niveis de maturidade que evoluem desde processos manuais orientados a scripts locais (Nivel 0), passando por pipelines automatizados de treinamento (Nivel 1), ate a integracao e entrega continua completa com CI/CD de modelos em producao (Nivel 2).'
      },
      {
        header: 'Secao 2: Rastreamento de Experimentos e Registro de Modelos com MLflow',
        text: 'Sistemas de rastreamento de experimentos registram de forma imutavel: commit do codigo Git, versao do dataset de entrada, hiperparametros de treino, curvas de perda e artefatos de pesos serializados. O Model Registry gerencia o ciclo de vida de transicao de estados (Staging, Production, Archived) com aprovacao formal antes do roteamento de trafego real.'
      },
      {
        header: 'Secao 3: Estrategias de Deploy em Nuvem e Integracao com Render/GCP',
        text: 'Deploy em producao adota padroes como Canary Deployment (roteamento gradual de 5% a 100% de requisicoes para avaliar estabilidade) e Blue-Green Deployment (troca instantanea de ambiente sem downtime). O dimensionamento automatico (auto-scaling) e health checks HTTP (/api/health) garantem alta disponibilidade no Render e em provedores de nuvem.'
      },
      {
        header: 'Secao 4: Monitoramento em Producao e Deteccao de Data Drift',
        text: 'Modelos em producao degradam devido ao desvio nos dados (Data Drift) ou desvio de conceito (Concept Drift). Testes estatisticos como Kolmogorov-Smirnov (KS) e Divergencia de Kullback-Leibler monitoram diferencas entre a distribuicao de treino e o trafego real de inferencia, disparando retreinamento automatico. Referencia: Treveil et al. (Introducing MLOps, O Reilly).'
      }
    ]
  },
  {
    dir: 'modulo-3/16-assistentes-ia',
    pdfName: 'apostila-assistentes-ia.pdf',
    title: 'ASS-304: Planejamento de Assistentes em Inteligencia Artificial',
    pages: [
      {
        header: 'Secao 1: Paradigma de Agentes Autonomos e Raciocinio ReAct',
        text: 'Assistentes inteligentes modernos transcendem chatbots estatisticos ao adotar o padrao ReAct (Reasoning and Acting). O modelo intercala passos de pensamento logico explicito (Thought), selecao de ferramentas operacionais (Action) e observacao de retornos do ambiente (Observation), permitindo decompor problemas complexos em subtarefas sequenciais verificaveis.'
      },
      {
        header: 'Secao 2: Chamada de Ferramentas (Tool Use e Function Calling)',
        text: 'Grandes modelos de linguagem sao conectados a fontes de informacao em tempo real atraves de declaracao formal de schemas JSON (OpenAPI / Function Calling). O modelo nao executa codigo diretamente; em vez disso, formula uma chamada estruturada com argumentos validados que a aplicacao servidora executa e devolve como observacao contextual.'
      },
      {
        header: 'Secao 3: Memoria Conversacional, Guardrails e Mitigacao de Alucinacoes',
        text: 'O gerenciamento de sessao utiliza estrategias como resumo dinamico (sliding window com summarization) para nao estourar a janela de contexto. Guardrails de seguranca filtram entradas maliciosas (jailbreak, prompt injection) e barram respostas fora do escopo institucional ou com dados confidenciais, assegurando confiabilidade operacional.'
      },
      {
        header: 'Secao 4: Design Instrucional e Avaliacao Qualitativa de Assistentes',
        text: 'Projetar a personalidade e os limites instrucionais de um assistente pedagógico exige instrucoes de sistema (System Prompts) precisas, tom colaborativo e estimulo a autonomia do aluno sem fornecer respostas prontas. Atividade: Construir definicao de ferramentas para consulta de notas escolares via Function Calling. Referencias: Yao et al. (ReAct: Synergizing Reasoning and Acting in Language Models).'
      }
    ]
  },
  {
    dir: 'modulo-3/17-llms-ia',
    pdfName: 'apostila-llms-inteligencia-artificial.pdf',
    title: 'LLM-305: LLMs e Inteligencia Artificial Generativa',
    pages: [
      {
        header: 'Secao 1: Arquitetura Transformer e Mecanismos de Auto-Atencao',
        text: 'A revolucao dos Large Language Models baseia-se no mecanismo de auto-atencao escalonada (Scaled Dot-Product Attention) introduzido por Vaswani et al. (2017). Projecoes lineares geram tensores de Consulta (Q), Chave (K) e Valor (V). A formula Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) V permite que cada token pondere semanticamente todos os demais tokens da sequencia simultaneamente, superando os gargalos sequenciais de RNNs.'
      },
      {
        header: 'Secao 2: Engenharia de Prompts Avancada e Respostas Estruturadas',
        text: 'Tecnicas como Few-Shot Prompting fornecem demonstracoes exemplares no proprio prompt de entrada; Chain-of-Thought (CoT) induz raciocinio explicito passo a passo antes da resposta final. A especificacao de schemas estruturados (JSON Mode / Structured Outputs) instrui a camada de amostragem do modelo a emitir exclusivamente dados aderentes a contratos estritos de tipos.'
      },
      {
        header: 'Secao 3: Arquitetura RAG Completa: Chunking, Embeddings e Reranking',
        text: 'RAG (Retrieval-Augmented Generation) ancora geracoes em bases confiaveis de conhecimento proprio. O processo abrange: 1. Chunking semantico de documentos com sobreposicao (overlap); 2. Geracao de vetores densos via modelos de embedding; 3. Busca de k-vizinhos mais proximos por similaridade de cosseno; 4. Reordenacao (Reranking) contextual; 5. Insercao dos trechos citados no prompt do modelo gerador.'
      },
      {
        header: 'Secao 4: Integracao com o SDK @google/genai e Gemini 3.8 Flash',
        text: 'O SDK oficial @google/genai fornece acesso a modelos de ultima geracao como Gemini 3.8 Flash. A integracao deve implementar respostas em fluxo (streaming), tratamento robusto de limites de cota (HTTP 429 com backoff exponencial) e fallback resiliente (como indexacao lexica TF-IDF). Atividade: Construir pipeline RAG ponta a ponta com recuperacao de trechos e citacao transparente de fontes.'
      }
    ]
  },
  {
    dir: 'modulo-3/18-visao-computacional',
    pdfName: 'apostila-visao-computacional.pdf',
    title: 'VIS-306: Visao Computacional Aplicada',
    pages: [
      {
        header: 'Secao 1: Fundamentos de Imagem Digital e Processamento Classico com OpenCV',
        text: 'Imagens digitais sao tensores tridimensionais (H x W x C) representando intensidade luminosa nos canais de cores (RGB ou BGR). O processamento de imagens emprega convolucoes com filtros lineares para suavizacao Gaussiana, realce de contornos (filtros Sobel e Laplaciano), binarizacao por threshold adaptativo (metodo de Otsu) e operacoes morfologicas de dilatacao e erosao.'
      },
      {
        header: 'Secao 2: Deteccao de Objetos em Tempo Real com Arquiteturas YOLO',
        text: 'Diferentemente de classificadores tradicionais que processam a imagem inteira para uma unica etiqueta, modelos de deteccao de objetos localizam multiplas instancias e suas respectivas caixas delimitadoras (bounding boxes). Arquiteturas como YOLO (You Only Look Once) operam em passagem unica, predizendo coordenadas normalizadas e probabilidades de classes com alta taxa de quadros por segundo (FPS).'
      },
      {
        header: 'Secao 3: Segmentacao Semantica e Reconhecimento de Padroes Complexos',
        text: 'A segmentacao semantica classifica cada pixel individual da imagem (como nas arquiteturas U-Net e Mask R-CNN), essencial em aplicacoes medicas de diagnostico por imagem e navegacao de veiculos autonomos. Tecnicas de aumento de dados (Data Augmentation) como rotacoes, cortes aleatorios e variacoes fotometricas ampliam a robustez contra mudancas de iluminacao.'
      },
      {
        header: 'Secao 4: Aplicacoes Industriais e Pratica com OpenCV e PyTorch',
        text: 'Sistemas visuais sao amplamente utilizados em inspecao de qualidade em linhas de montagem, contagem automatizada e biometria facial com preservacao de privacidade. Atividade: Implementar script em Python com OpenCV para extracao de caracteristicas de bordas e contornos em pecas industriais. Referencias: Szeliski, Richard (Computer Vision: Algorithms and Applications); Bradski & Kaehler (Learning OpenCV).'
      }
    ]
  },
  {
    dir: 'modulo-3/19-gestao-projetos-ia',
    pdfName: 'apostila-gestao-projetos-ia.pdf',
    title: 'GP-307: Gestao de Projetos em Inteligencia Artificial',
    pages: [
      {
        header: 'Secao 1: Metodologias Ageis e Ciclo de Vida de Projetos de Dados',
        text: 'A gestao de projetos de IA difere do desenvolvimento de software tradicional devido a alta incerteza inerente a dados e experimentacao cientifica. A combinacao do framework Scrum com o ciclo de vida CRISP-DM organiza sprints iterativos de exploracao, definindo criterios claros de parada (Timeboxing) para evitar prototipacoes sem retorno tangivel.'
      },
      {
        header: 'Secao 2: Gestao de Incerteza, Viabilidade Tecnica e Definicao de MVP',
        text: 'Antes de investir meses em treinamento massivo, a equipe de IA valida a viabilidade de dados (disponibilidade, qualidade e representatividade) e a viabilidade tecnica (existencia de modelos pre-treinados ou baselines simples). O Produto Minimo Viavel (MVP) deve entregar valor imediato com o menor custo de infraestrutura possivel.'
      },
      {
        header: 'Secao 3: Indicadores de Desempenho (KPIs de Negocio) e Metricas de Modelos',
        text: 'O sucesso de um projeto de IA e medido pelo impacto estrategico no negocio: reducao de retrabalho, elevacao de satisfacao do cliente ou otimizacao de receita. O gestor estabelece o alinhamento entre metricas tecnicas (F1-score, Recall) e os Objetivos e Resultados-Chave (OKRs) da organizacao.'
      },
      {
        header: 'Secao 4: Matriz de Riscos em Projetos de IA e Referencias em Gestao',
        text: 'Mapeamento de riscos especificos de IA: indisponibilidade de dados rotulados, data drift em producao, custos descontrolados de computacao em nuvem e riscos de conformidade regulatoria com a LGPD. Atividade: Elaborar termo de abertura de projeto (Project Charter) para uma solucao preditiva. Referencias: Schwaber & Sutherland (O Guia do Scrum); Project Management Institute (PMBOK Guide).'
      }
    ]
  },
  {
    dir: 'modulo-3/20-pratica-supervisionada-2',
    pdfName: 'apostila-pratica-supervisionada-2.pdf',
    title: 'PPS-308: Pratica Profissional Supervisionada II (TCC Aplicado)',
    pages: [
      {
        header: 'Secao 1: Regulamento e Escopo do Trabalho de Conclusao de Curso (TCC)',
        text: 'A Pratica Profissional Supervisionada II constitui o Trabalho de Conclusao de Curso (TCC) aplicado do Pre-Curso de Inteligencia Artificial (carga horaria: 10h). O projeto exige o desenvolvimento, a implantacao em producao e a defesa publica perante banca examinadora de uma solucao computacional completa que resolva um problema real.'
      },
      {
        header: 'Secao 2: Arquitetura Full-Stack da Solucao Tecnologica com IA Integrada',
        text: 'O produto final deve integrar: 1. Frontend interativo acessivel; 2. Backend estruturado com autenticacao segura e persistencia de dados; 3. Modelo preditivo, agente conversacional ou pipeline RAG operando com dados reais; 4. Deploy funcional em ambiente de nuvem publica com monitoramento de saude operacional.'
      },
      {
        header: 'Secao 3: Documentacao Tecnica Final, Manual do Usuario e Repositorio',
        text: 'A monografia tecnica segue as normas ABNT aplicaveis e inclui especificacao completa de arquitetura, analise critica de resultados obtidos, manual de instalacao e reproducao local com Docker/venv e politicas de governanca e conformidade com a LGPD.'
      },
      {
        header: 'Secao 4: Criterios Formais de Avaliacao da Banca Examinadora',
        text: 'A banca avaliadora analisa: 1. Dominio conceitual e tecnico das competencias do curso; 2. Qualidade e robustez da implementacao pratica; 3. Demonstracao ao vivo da solucao em funcionamento; 4. Clareza e articulacao na defesa oral. A aprovacao com nota minima 7,0 e requisito indispensavel para obtencao do Certificado do Pre-Curso de IA.'
      }
    ]
  }
];

/**
 * Cria os materiais didáticos em PDF e TXT para todas as 20 disciplinas do Pré-Curso de Inteligência Artificial em Modo de Produção
 */
export function seedAllCourseMaterials() {
  console.log('📚 Gerando materiais didáticos em modo de produção oficial para as 20 disciplinas (10h cada, 200h total)...');

  ALL_DISCIPLINES_MATERIALS.forEach((disc, index) => {
    const fullDirPath = path.join(rootCoursesDir, disc.dir);
    if (!fs.existsSync(fullDirPath)) {
      fs.mkdirSync(fullDirPath, { recursive: true });
    }

    // Extrai o número sequencial da disciplina com 2 dígitos (01, 02, ..., 20)
    const match = disc.dir.match(/\/(\d+)-/);
    const discNum = match ? match[1] : String(index + 1).padStart(2, '0');

    // 1. Gera o arquivo PDF completo da disciplina com estrutura oficial
    const pdfPath = path.join(fullDirPath, disc.pdfName);
    const pdfBuffer = generateValidPDF(disc.title, 'CAMPOS IA — Corpo Docente Oficial', disc.pages);
    fs.writeFileSync(pdfPath, pdfBuffer);

    // 2. Garante a existência de apostila-aula-XX.pdf (numerada pela disciplina)
    const aulaPdfName = `apostila-aula-${discNum}.pdf`;
    const aulaPdfPath = path.join(fullDirPath, aulaPdfName);
    fs.writeFileSync(aulaPdfPath, pdfBuffer);

    // Remove arquivo anterior sem numeração de disciplina para evitar conflitos em disciplinas > 1
    if (discNum !== '01') {
      const oldAula01Pdf = path.join(fullDirPath, 'apostila-aula-01.pdf');
      if (fs.existsSync(oldAula01Pdf)) {
        try { fs.unlinkSync(oldAula01Pdf); } catch {}
      }
    }

    // 2.1 Garante a existência de slides-aula-XX.pdf (lâminas de aula para o Passo 2)
    const slidesPdfName = `slides-aula-${discNum}.pdf`;
    const slidesPdfPath = path.join(fullDirPath, slidesPdfName);
    const slidesPages = disc.pages.map((p, idx) => ({
      header: `LAMINA DIDATICA ${idx + 1}: ${p.header.toUpperCase()}`,
      text: `SINTESE CONCEITUAL E DIAGRAMAS:\n${p.text}`,
    }));
    const slidesBuffer = generateValidPDF(`SLIDES: ${disc.title}`, 'CAMPOS IA — Corpo Docente Oficial', slidesPages);
    fs.writeFileSync(slidesPdfPath, slidesBuffer);

    // Remove slides genéricos antigos em disciplinas > 1
    if (discNum !== '01') {
      const oldSlidesAula01 = path.join(fullDirPath, 'slides-aula-01.pdf');
      if (fs.existsSync(oldSlidesAula01)) {
        try { fs.unlinkSync(oldSlidesAula01); } catch {}
      }
    }

    // 3. Gera a versão em texto estruturado oficial
    const txtPath = path.join(fullDirPath, 'material-estudo.txt');
    let txtContent = `# ${disc.title.toUpperCase()}\n`;
    txtContent += `# CAMPOS IA — PRÉ-CURSO DE INTELIGÊNCIA ARTIFICIAL (200 HORAS)\n`;
    txtContent += `# DISCIPLINA ${discNum} | MATERIAL DIDÁTICO OFICIAL — MODO DE PRODUÇÃO\n\n`;
    disc.pages.forEach((p, idx) => {
      txtContent += `--- Página ${idx + 1}: ${p.header}\n${p.text}\n\n`;
    });
    fs.writeFileSync(txtPath, txtContent, 'utf8');

    // Remove arquivos residuais de teste/experimentais se existirem
    const legacyTxtPath = path.join(fullDirPath, 'material-estudo-experimental.txt');
    if (fs.existsSync(legacyTxtPath)) {
      try {
        fs.unlinkSync(legacyTxtPath);
      } catch {}
    }

    // 4. Gera também apostila-aula-XX.txt para leitura e RAG
    const aulaTxtName = `apostila-aula-${discNum}.txt`;
    const aulaTxtPath = path.join(fullDirPath, aulaTxtName);
    fs.writeFileSync(aulaTxtPath, txtContent, 'utf8');

    // Remove texto genérico antigo aula-01 em disciplinas > 1
    if (discNum !== '01') {
      const oldAula01Txt = path.join(fullDirPath, 'apostila-aula-01.txt');
      if (fs.existsSync(oldAula01Txt)) {
        try { fs.unlinkSync(oldAula01Txt); } catch {}
      }
    }

    // 5. Gera o README.md oficial da disciplina
    const readmePath = path.join(fullDirPath, 'README.md');
    const readmeContent = `# ${disc.title}\n\n` +
      `Plataforma CAMPOS IA — Pré-Curso de Inteligência Artificial (200 horas).\n` +
      `Componente Curricular ${discNum} (Carga horária: 10 horas regimental).\n\n` +
      `Acervo didático oficial de apoio ao aprendizado, laboratórios práticos e suporte via Tutor IA com RAG.\n\n` +
      `### Arquivos disponíveis no diretório:\n` +
      `- \`video-aula-${discNum}.mp4\`: Vídeo expositivo da aula (suporta MP4/WebM)\n` +
      `- \`${slidesPdfName}\`: Lâminas de apresentação em PDF da aula\n` +
      `- \`${aulaPdfName}\`: Apostila didática em PDF da aula\n` +
      `- \`${aulaTxtName}\`: Versão textual da apostila da aula\n` +
      `- \`${disc.pdfName}\`: Livro técnico integral da disciplina em PDF\n` +
      `- \`material-estudo.txt\`: Texto oficial para estudo e indexação semântica\n`;
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
  });

  console.log('🎉 Materiais didáticos oficiais de todas as 20 disciplinas gerados com sucesso!');
}

// Se executado diretamente
if (process.argv[1] && process.argv[1].includes('seed-course-materials')) {
  seedAllCourseMaterials();
}

