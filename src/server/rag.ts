import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let pdfPkg: any = null;
try {
  pdfPkg = require('pdf-parse');
} catch (e) {
  console.warn('⚠️ [RAG] Aviso: Módulo pdf-parse não carregado:', e);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DocumentChunk {
  id: string;
  disciplineId: string;
  documentName: string;
  documentPath: string;
  fileType: 'pdf' | 'text' | 'markdown';
  pageNumber: number;
  sectionTitle: string;
  content: string;
  embedding?: number[];
  termVector?: Map<string, number>;
  contentHash: string;
}

export interface RetrievalResult {
  hasRelevantContent: boolean;
  disciplineId: string;
  query: string;
  retrievedChunks: Array<{
    documentName: string;
    documentPath: string;
    pageNumber: number;
    sectionTitle: string;
    content: string;
    similarityScore: number;
  }>;
  formattedContextForPrompt: string;
  citations: Array<{
    title: string;
    section: string;
    path: string;
    pageNumber: number;
    similarity: string;
  }>;
  retrievalMethod: 'gemini_embedding_vector' | 'tfidf_lexical_vector';
}

export const RAG_EMBEDDING_MODEL = 'gemini-embedding-2-preview';

// Inicialização do cliente Gemini para embeddings caso a chave esteja disponível
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('⚠️ [RAG] Falha ao inicializar GoogleGenAI para embeddings:', err);
  }
}

// Cache em memória de documentos indexados por disciplina para evitar reindexação desnecessária
const indexedChunksCache = new Map<string, DocumentChunk[]>();
// Assinatura estável (manifesto) dos arquivos por disciplina para detecção precisa de criação, modificação e exclusão
const indexedDisciplineManifests = new Map<string, string>();
let isGeminiEmbeddingAvailable = true;

// ==============================================================
// FUNÇÕES AUXILIARES DE VETORIZAÇÃO E BUSCA POR SIMILARIDADE
// ==============================================================

/**
 * Calcula a similaridade de cosseno entre dois vetores numéricos:
 * cos(theta) = (A . B) / (||A|| * ||B||)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const PORTUGUESE_STOP_WORDS = new Set([
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'nao', 'uma',
  'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele',
  'das', 'tem', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'ha', 'nos', 'ja',
  'esta', 'eu', 'tambem', 'so', 'pelo', 'pela', 'ate', 'isso', 'ela', 'entre', 'era',
  'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles',
  'estao', 'voce', 'tinha', 'foram', 'essa', 'num', 'nem', 'suas', 'meu', 'minha',
  'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'sera', 'tenho', 'lhe', 'deles',
  'essas', 'esses', 'pelas', 'este', 'fosse', 'dele', 'tu', 'te', 'voces', 'vos', 'lhes',
  'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'nosso', 'nossa', 'nossos', 'nossas',
  'dela', 'delas', 'estes', 'estas', 'aquele', 'aquela', 'aqueles', 'aquelas',
  'isto', 'aquilo', 'estou', 'estamos', 'estive', 'esteve', 'estivemos',
  'estiveram', 'estava', 'estavamos', 'estavam', 'sao', 'fazer', 'sobre', 'onde'
]);

/**
 * Vetorizador TF-IDF / Bag of Words para busca lexical
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !PORTUGUESE_STOP_WORDS.has(w));
}

export function computeTFVector(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokens) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  const vector = new Map<string, number>();
  const total = tokens.length || 1;
  for (const [token, count] of counts.entries()) {
    vector.set(token, count / total);
  }
  return vector;
}

export function sparseCosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const val of vecA.values()) {
    normA += val * val;
  }
  for (const val of vecB.values()) {
    normB += val * val;
  }

  if (normA === 0 || normB === 0) return 0;

  for (const [key, valA] of vecA.entries()) {
    const valB = vecB.get(key);
    if (valB !== undefined) {
      dotProduct += valA * valB;
    }
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const DISCIPLINE_MODULE_MAP: Record<string, string> = {
  'disc-01': 'modulo-1/01-fundamentos',
  'disc-02': 'modulo-1/02-logica',
  'disc-03': 'modulo-1/03-python',
  'disc-04': 'modulo-1/04-banco-dados',
  'disc-05': 'modulo-1/05-matematica-estatistica',
  'disc-06': 'modulo-1/06-fundamentos-ia',
  'disc-07': 'modulo-2/07-python-ciencia-dados',
  'disc-08': 'modulo-2/08-ml-aplicado',
  'disc-09': 'modulo-2/09-deep-learning',
  'disc-10': 'modulo-2/10-pln-chatbots',
  'disc-11': 'modulo-2/11-metodologia',
  'disc-12': 'modulo-2/12-pratica-supervisionada-1',
  'disc-13': 'modulo-3/13-seguranca-lgpd',
  'disc-14': 'modulo-3/14-engenharia-software-ia',
  'disc-15': 'modulo-3/15-mlops-deploy',
  'disc-16': 'modulo-3/16-assistentes-ia',
  'disc-17': 'modulo-3/17-llms-ia',
  'disc-18': 'modulo-3/18-visao-computacional',
  'disc-19': 'modulo-3/19-gestao-projetos-ia',
  'disc-20': 'modulo-3/20-pratica-supervisionada-2',
};

// ==============================================================
// SERVIÇO RAG DE INDEXAÇÃO E RECUPERAÇÃO PEDAGÓGICA
// ==============================================================
export const ragService = {
  /**
   * Mapeamento de diretório de cada disciplina
   */
  getDisciplineDirectory(disciplineId: string): string {
    const rootDir = path.resolve(__dirname, '../../public/cursos');
    const subPath = DISCIPLINE_MODULE_MAP[disciplineId] || 'modulo-1/01-fundamentos';
    return path.join(rootDir, subPath);
  },

  /**
   * Extrai e segmenta textos de arquivos PDF
   */
  async extractChunksFromPDF(filePath: string, disciplineId: string): Promise<DocumentChunk[]> {
    const dataBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const chunks: DocumentChunk[] = [];

    try {
      let pagesData: Array<{ pageNumber: number; text: string }> = [];

      if (pdfPkg) {
        if (typeof pdfPkg.PDFParse === 'function') {
          const parser = new pdfPkg.PDFParse({ data: dataBuffer });
          await parser.load();
          const textResult = await parser.getText();
          if (textResult?.pages && textResult.pages.length > 0) {
            pagesData = textResult.pages.map((p: any, idx: number) => ({
              pageNumber: idx + 1,
              text: p.text || '',
            }));
          } else if (textResult?.text) {
            pagesData = [{ pageNumber: 1, text: textResult.text }];
          }
        } else if (typeof pdfPkg === 'function') {
          const pdfData = await pdfPkg(dataBuffer);
          const rawText = pdfData.text || '';
          const pages = rawText.split(/\f|\n(?=--- Página|\n\n==)/).filter((t: string) => t.trim().length > 30);
          pagesData = pages.map((t: string, idx: number) => ({ pageNumber: idx + 1, text: t }));
        }
      }

      // Fallback: extração de stream direto se o parser não extraiu texto
      if (pagesData.length === 0) {
        const rawContent = dataBuffer.toString('latin1');
        const matches = rawContent.match(/\((.*?)\)\s*'/g) || [];
        if (matches.length > 0) {
          const reconstructed = matches.map((m: string) => m.replace(/^\(|\)'$/g, '')).join('\n');
          pagesData = [{ pageNumber: 1, text: reconstructed }];
        }
      }

      pagesData.forEach(({ pageNumber, text: pageText }) => {
        const paragraphs = pageText
          .split(/\n\n+/)
          .map((p) => p.trim())
          .filter((p) => p.length > 40);

        const itemsToChunk = paragraphs.length > 0 ? paragraphs : [pageText.trim()].filter((t) => t.length > 30);

        itemsToChunk.forEach((pText, parIdx) => {
          const chunkId = `pdf-${disciplineId}-${fileName}-p${pageNumber}-c${parIdx + 1}`;
          const hash = crypto.createHash('sha256').update(pText).digest('hex');

          const lines = pText.split('\n');
          const firstLine = lines[0].replace(/^\[.*?\]\s*/, '').trim();
          const sectionTitle = firstLine.length < 80 ? firstLine : `Seção Temática ${parIdx + 1}`;

          chunks.push({
            id: chunkId,
            disciplineId,
            documentName: fileName,
            documentPath: `/cursos/${filePath.split('public/cursos/')[1] || fileName}`,
            fileType: 'pdf',
            pageNumber,
            sectionTitle,
            content: pText,
            termVector: computeTFVector(tokenize(pText)),
            contentHash: hash,
          });
        });
      });
    } catch (err) {
      console.warn(`⚠️ [RAG] Falha ao processar PDF ${fileName}:`, err);
    }

    return chunks;
  },

  /**
   * Extrai e segmenta textos de arquivos texto/markdown
   */
  extractChunksFromText(filePath: string, disciplineId: string): DocumentChunk[] {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    const chunks: DocumentChunk[] = [];

    const sections = content.split(/\n(?=## |\n--- Página |\n### )/);

    sections.forEach((secText, sIdx) => {
      const trimmed = secText.trim();
      if (trimmed.length < 40) return;

      const lines = trimmed.split('\n');
      const firstLine = lines[0].replace(/^#+\s*/, '').replace(/^--- Página \d+:\s*/, '').trim();
      const sectionTitle = firstLine.length < 80 ? firstLine : `Seção ${sIdx + 1}`;

      const pageMatch = trimmed.match(/Página\s*(\d+)/i);
      const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : sIdx + 1;

      const chunkId = `txt-${disciplineId}-${fileName}-s${sIdx + 1}`;
      const hash = crypto.createHash('sha256').update(trimmed).digest('hex');

      chunks.push({
        id: chunkId,
        disciplineId,
        documentName: fileName,
        documentPath: `/cursos/${filePath.split('public/cursos/')[1] || fileName}`,
        fileType: fileName.endsWith('.md') ? 'markdown' : 'text',
        pageNumber,
        sectionTitle,
        content: trimmed,
        termVector: computeTFVector(tokenize(trimmed)),
        contentHash: hash,
      });
    });

    return chunks;
  },

  /**
   * Computa uma representação estável (manifesto / checksum) do conjunto de arquivos
   * relevantes de uma disciplina para detectar com precisão criação, alteração ou exclusão.
   */
  computeDisciplineManifest(disciplineId: string): { manifestHash: string; filePaths: string[] } | null {
    const dir = this.getDisciplineDirectory(disciplineId);
    if (!fs.existsSync(dir)) {
      return null;
    }

    try {
      const entries = fs.readdirSync(dir);
      const relevantFiles = entries
        .filter((file) => {
          const lower = file.toLowerCase();
          if (lower.startsWith('readme') || lower.startsWith('.')) return false;
          return lower.endsWith('.pdf') || lower.endsWith('.txt') || lower.endsWith('.md');
        })
        .sort(); // ordenação estável

      if (relevantFiles.length === 0) {
        return { manifestHash: 'empty', filePaths: [] };
      }

      const fileEntries: string[] = [];
      const filePaths: string[] = [];

      for (const file of relevantFiles) {
        const fullPath = path.join(dir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            fileEntries.push(`${file}:${stat.size}:${stat.mtimeMs}`);
            filePaths.push(fullPath);
          }
        } catch {
          // Arquivo pode ter sido removido concorrentemente; prossegue com segurança
        }
      }

      const manifestPayload = fileEntries.join('||');
      const manifestHash = crypto.createHash('sha256').update(manifestPayload).digest('hex');
      return { manifestHash, filePaths };
    } catch {
      return null;
    }
  },

  /**
   * Limpa o cache em memória de documentos indexados (geral ou por disciplina).
   */
  clearCache(disciplineId?: string): void {
    if (disciplineId) {
      indexedChunksCache.delete(disciplineId);
      indexedDisciplineManifests.delete(disciplineId);
    } else {
      indexedChunksCache.clear();
      indexedDisciplineManifests.clear();
    }
  },

  /**
   * Indexa todos os materiais didáticos locais cadastrados para uma disciplina.
   * Evita re-indexação desnecessária, mas invalida o cache com precisão quando
   * arquivos são criados, modificados ou excluídos.
   */
  async indexDisciplineMaterials(disciplineId: string): Promise<DocumentChunk[]> {
    const manifestInfo = this.computeDisciplineManifest(disciplineId);
    if (!manifestInfo || manifestInfo.filePaths.length === 0) {
      // Se o diretório não existe ou não tem arquivos válidos, limpa cache da disciplina
      indexedChunksCache.delete(disciplineId);
      indexedDisciplineManifests.delete(disciplineId);
      return [];
    }

    const { manifestHash, filePaths } = manifestInfo;
    const cachedManifest = indexedDisciplineManifests.get(disciplineId);

    if (cachedManifest === manifestHash && indexedChunksCache.has(disciplineId)) {
      return indexedChunksCache.get(disciplineId)!;
    }

    const allChunks: DocumentChunk[] = [];

    for (const fullPath of filePaths) {
      const file = path.basename(fullPath);
      try {
        if (file.toLowerCase().endsWith('.pdf')) {
          const pdfChunks = await this.extractChunksFromPDF(fullPath, disciplineId);
          allChunks.push(...pdfChunks);
        } else if (
          file.toLowerCase().endsWith('.txt') ||
          file.toLowerCase().endsWith('.md')
        ) {
          const txtChunks = this.extractChunksFromText(fullPath, disciplineId);
          allChunks.push(...txtChunks);
        }
      } catch (fileErr) {
        console.warn(`⚠️ [RAG] Erro seguro ao processar arquivo ${file}:`, fileErr);
      }
    }

    // Se o cliente Gemini estiver ativo e embeddings suportados, gera embeddings vetoriais
    if (isGeminiEmbeddingAvailable && aiClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
      try {
        for (const chunk of allChunks) {
          const embedRes: any = await aiClient.models.embedContent({
            model: RAG_EMBEDDING_MODEL,
            contents: `${chunk.sectionTitle}: ${chunk.content.slice(0, 800)}`,
          });
          chunk.embedding = embedRes.embedding?.values || embedRes.embeddings?.[0]?.values;
        }
      } catch (embedErr: any) {
        isGeminiEmbeddingAvailable = false;
        console.warn('⚠️ [RAG] Embeddings densos Gemini indisponíveis (' + (embedErr?.message || embedErr) + '). Utilizando busca lexical vetorial TF-IDF.');
      }
    }

    indexedChunksCache.set(disciplineId, allChunks);
    indexedDisciplineManifests.set(disciplineId, manifestHash);

    return allChunks;
  },

  /**
   * Recupera os trechos mais relevantes para a dúvida do aluno com base na disciplina atual.
   * Aplica threshold estrito (0.18 para TF-IDF esparso, 0.60 para embeddings) para evitar falsas correspondências.
   */
  async retrieveContext(disciplineId: string, userQuery: string): Promise<RetrievalResult> {
    const chunks = await this.indexDisciplineMaterials(disciplineId);

    if (chunks.length === 0) {
      return {
        hasRelevantContent: false,
        disciplineId,
        query: userQuery,
        retrievedChunks: [],
        formattedContextForPrompt: '',
        citations: [],
        retrievalMethod: 'tfidf_lexical_vector',
      };
    }

    // 1. Tenta busca por embeddings vetoriais se Gemini estiver disponível
    let queryEmbedding: number[] | undefined;
    let usedMethod: 'gemini_embedding_vector' | 'tfidf_lexical_vector' = 'tfidf_lexical_vector';

    if (isGeminiEmbeddingAvailable && aiClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
      try {
        const embedRes: any = await aiClient.models.embedContent({
          model: RAG_EMBEDDING_MODEL,
          contents: userQuery,
        });
        queryEmbedding = embedRes.embedding?.values || embedRes.embeddings?.[0]?.values;
        if (queryEmbedding && queryEmbedding.length > 0) {
          usedMethod = 'gemini_embedding_vector';
        }
      } catch {
        // Fallback para TF-IDF
      }
    }

    const queryTokens = tokenize(userQuery);
    const queryVector = computeTFVector(queryTokens);

    // 2. Pontua os trechos
    const scoredChunks = chunks.map((chunk) => {
      let score = 0;
      if (usedMethod === 'gemini_embedding_vector' && queryEmbedding && chunk.embedding) {
        score = cosineSimilarity(queryEmbedding, chunk.embedding);
      } else if (chunk.termVector) {
        score = sparseCosineSimilarity(queryVector, chunk.termVector);
      }

      return {
        chunk,
        score,
      };
    });

    // 3. Ordena e filtra por threshold
    const threshold = usedMethod === 'gemini_embedding_vector' ? 0.60 : 0.16;
    const filtered = scoredChunks
      .filter((item) => item.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (filtered.length === 0) {
      return {
        hasRelevantContent: false,
        disciplineId,
        query: userQuery,
        retrievedChunks: [],
        formattedContextForPrompt: '',
        citations: [],
        retrievalMethod: usedMethod,
      };
    }

    // 4. Formata o contexto com barreiras de proteção contra injeção de prompt
    const promptContext = filtered
      .map((item, idx) => {
        const c = item.chunk;
        return `[TRECHO DIDÁTICO OFICIAL ${idx + 1} - DADOS NÃO CONFIÁVEIS]
Arquivo de Origem: ${c.documentName}
Página/Seção: Página ${c.pageNumber} (${c.sectionTitle})
Similaridade de Relevância: ${(item.score * 100).toFixed(1)}%
Conteúdo:
"""
${c.content}
"""`;
      })
      .join('\n\n');

    const citations = filtered.map((item) => ({
      title: `${item.chunk.documentName} (Pág. ${item.chunk.pageNumber})`,
      section: item.chunk.sectionTitle,
      path: item.chunk.documentPath,
      pageNumber: item.chunk.pageNumber,
      similarity: `${(item.score * 100).toFixed(1)}%`,
    }));

    return {
      hasRelevantContent: true,
      disciplineId,
      query: userQuery,
      retrievedChunks: filtered.map((item) => ({
        documentName: item.chunk.documentName,
        documentPath: item.chunk.documentPath,
        pageNumber: item.chunk.pageNumber,
        sectionTitle: item.chunk.sectionTitle,
        content: item.chunk.content,
        similarityScore: item.score,
      })),
      formattedContextForPrompt: promptContext,
      citations,
      retrievalMethod: usedMethod,
    };
  },

  /**
   * Diagnóstico do status de indexação do RAG para auditoria do sistema
   */
  async getRagDiagnostics() {
    const rootDir = path.resolve(__dirname, '../../public/cursos');
    const disciplinesInfo: Array<{
      disciplineId: string;
      directory: string;
      exists: boolean;
      files: string[];
      totalChunks: number;
    }> = [];

    for (const [discId, relPath] of Object.entries(DISCIPLINE_MODULE_MAP)) {
      const fullPath = path.join(rootDir, relPath);
      const exists = fs.existsSync(fullPath);
      let files: string[] = [];
      if (exists) {
        files = fs.readdirSync(fullPath).filter((f) => !f.toLowerCase().startsWith('readme'));
      }
      const chunks = indexedChunksCache.get(discId) || [];
      disciplinesInfo.push({
        disciplineId: discId,
        directory: relPath,
        exists,
        files,
        totalChunks: chunks.length,
      });
    }

    const hasValidKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    const isEmbeddingActive = Boolean(aiClient && isGeminiEmbeddingAvailable && hasValidKey);
    const activeSearchMethod: 'gemini_embedding_vector' | 'tfidf_lexical_vector' = isEmbeddingActive
      ? 'gemini_embedding_vector'
      : 'tfidf_lexical_vector';

    return {
      isGeminiClientInitialized: Boolean(aiClient),
      isGeminiEmbeddingAvailable: isEmbeddingActive,
      configuredEmbeddingModel: RAG_EMBEDDING_MODEL,
      embeddingModel: RAG_EMBEDDING_MODEL,
      activeSearchMethod,
      fallbackActive: !isEmbeddingActive,
      totalDisciplinesWithMaterials: disciplinesInfo.filter((d) => d.files.length > 0).length,
      totalCachedChunks: Array.from(indexedChunksCache.values()).reduce((acc, c) => acc + c.length, 0),
      disciplines: disciplinesInfo,
    };
  },
};
