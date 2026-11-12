import pg from 'pg';
import crypto from 'crypto';
import { DISCIPLINES, getDisciplineLessons, getDisciplineFinalExam } from '../db/seed-data.ts';
import { getDisciplineQuiz, ALL_FIXATION_QUIZZES } from '../db/fixation-quizzes.ts';
import { 
  User, 
  UserRole, 
  ExternalIdentity, 
  StudentProgress, 
  Certificate, 
  ChatMessage, 
  FinalExamAttempt, 
  DisciplineApproval,
  FinalExamQuestion 
} from '../types/index.ts';

// Detecção do ambiente de execução Render.com
// No Render, as variáveis RENDER=true e RENDER_SERVICE_ID são injetadas nativamente pela plataforma.
const isRenderEnvironment = Boolean(
  process.env.RENDER === 'true' ||
  Boolean(process.env.RENDER_SERVICE_ID) ||
  process.env.IS_RENDER === 'true' ||
  process.env.FORCE_DB_CONNECT === 'true'
);

// Conexão com o banco de dados PostgreSQL: Ativada EXCLUSIVAMENTE quando executado no Render
const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';
const allowMemoryStore = process.env.ALLOW_MEMORY_STORE === 'true';
const isRenderPostgres = connectionString?.includes('render.com');
const isNeonPostgres = connectionString?.includes('neon.tech');
const requiresSsl = Boolean(isProduction || isRenderPostgres || isNeonPostgres || connectionString?.includes('sslmode=require'));

let pgPool: pg.Pool | null = null;
let isPostgresConnected = false;
let connectionError: string | null = null;

// Inicializa o pool PostgreSQL EXCLUSIVAMENTE no Render
if (isRenderEnvironment) {
  if (connectionString && !connectionString.includes('localhost:5432/lms_ia')) {
    try {
      console.log('🚀 [DB] Ambiente Render detectado (RENDER=true). Inicializando conexão com PostgreSQL...');
      pgPool = new pg.Pool({
        connectionString,
        ssl: requiresSsl ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      pgPool.query('SELECT NOW()', (err) => {
        if (err) {
          connectionError = err.message;
          console.warn('⚠️ [DB] PostgreSQL no Render não acessível no momento:', err.message);
        } else {
          isPostgresConnected = true;
          const providerName = isRenderPostgres ? 'Render PostgreSQL' : (isNeonPostgres ? 'Neon' : 'PostgreSQL');
          console.log(`✅ [DB] Conectado com sucesso ao banco ${providerName} no Render.`);
        }
      });
    } catch (err: any) {
      connectionError = err.message;
      console.warn('⚠️ [DB] Falha ao instanciar Pool PostgreSQL no Render:', err.message);
    }
  } else {
    console.warn('⚠️ [DB] Executando no Render, mas DATABASE_URL não foi configurada. Utilizando armazenamento em memória temporário.');
  }
} else {
  console.log('ℹ️ [DB] Ambiente Local / Desenvolvimento: Conexão com banco PostgreSQL desativada (configurada para conectar exclusivamente no Render). Armazenamento em memória ativo.');
}

/**
 * Verificação de Segurança Operacional para Produção no Render
 */
export function assertDatabaseAvailable() {
  if (!isRenderEnvironment) {
    // Fora do Render, a camada de dados em memória está sempre liberada e operacional
    return;
  }
  const allowMem = process.env.ALLOW_MEMORY_STORE === 'true' || !process.env.DATABASE_URL;
  if (!allowMem && !isPostgresConnected) {
    const error: any = new Error(
      'SERVIÇO INDISPONÍVEL NO RENDER: O banco de dados PostgreSQL não está conectado. Configure a variável DATABASE_URL com um PostgreSQL ativo no Render.'
    );
    error.status = 503;
    error.code = 'DATABASE_UNAVAILABLE';
    throw error;
  }
}

// ==============================================================
// BANCO EM MEMÓRIA CONTROLADO (Apenas para Testes e Dev Local)
// ==============================================================
interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

interface StoredChatMessage extends ChatMessage {
  userId: string;
}

const memoryStore = {
  users: new Map<string, User>(),
  externalIdentities: new Map<string, ExternalIdentity>(), // key: `google:${provider_id}`
  sessions: new Map<string, SessionRecord>(),
  progress: new Map<string, StudentProgress>(), // key: `${userId}:${disciplineId}:${lessonId}:${step}`
  chatMessages: [] as StoredChatMessage[],
  certificates: new Map<string, Certificate>(),
  finalExamAttempts: [] as FinalExamAttempt[],
  disciplineApprovals: new Map<string, DisciplineApproval>(), // key: `${userId}:${disciplineId}`
  auditLogs: [] as Array<{ id: string; userId?: string; action: string; resource: string; ip?: string; details: any; timestamp: string }>,
};

// Respostas oficiais dos Testes de Fixação (Aulas) mantidas EXCLUSIVAMENTE no servidor
// Mapeamento automático dos gabaritos e explicações para os 20 componentes curriculares
const QUIZ_ANSWERS_SERVER: Record<string, { answers: number[]; explanation: string }> = Object.values(ALL_FIXATION_QUIZZES).reduce(
  (acc, item) => {
    acc[item.lessonId] = {
      answers: item.correctAnswers,
      explanation: item.explanation,
    };
    acc[item.disciplineId] = {
      answers: item.correctAnswers,
      explanation: item.explanation,
    };
    acc[item.disciplineCode] = {
      answers: item.correctAnswers,
      explanation: item.explanation,
    };
    return acc;
  },
  {} as Record<string, { answers: number[]; explanation: string }>
);

// Gabarito Oficial da Avaliação Final de 10 Questões mantido estritamente no servidor
const FINAL_EXAM_ANSWERS_SERVER: Record<string, number[]> = {
  default: [1, 2, 0, 1, 0, 0, 0, 0, 1, 0], // Índices oficiais de 0 a 9
};

// ==============================================================
// SERVIÇO DE BANCO DE DADOS
// ==============================================================
export const db = {
  async getHealthStatus() {
    if (!isRenderEnvironment) {
      return {
        status: 'ok',
        engine: 'Armazenamento em Memória Resiliente (Local / Conexão PostgreSQL ativada exclusivamente no Render)',
        productionSafe: true,
        connectOnlyOnRender: true,
        isRenderEnvironment: false,
        postgres: {
          configured: Boolean(connectionString && !connectionString.includes('localhost:5432/lms_ia')),
          connected: false,
          activeOnRenderOnly: true,
          provider: 'PostgreSQL no Render (Aguardando Deploy)',
          latencyMs: null,
          error: null,
          sslEnabled: false,
          message: 'Banco de dados configurado para conectar exclusivamente quando executado no Render.com (RENDER=true).',
        },
        stats: {
          totalDisciplines: DISCIPLINES.length,
          totalModules: 3,
          totalHoursItemized: 200,
          targetHours: 200,
          registeredUsers: memoryStore.users.size,
        },
      };
    }

    let pgStatus = 'disconnected';
    let latencyMs: number | null = null;

    if (pgPool) {
      try {
        const start = Date.now();
        await pgPool.query('SELECT 1');
        latencyMs = Date.now() - start;
        pgStatus = 'connected';
        isPostgresConnected = true;
      } catch (err: any) {
        pgStatus = 'error';
        isPostgresConnected = false;
        connectionError = err.message;
      }
    }

    const isHealthy = pgStatus === 'connected' || allowMemoryStore || !connectionString;
    const isNeon = Boolean(connectionString?.includes('neon.tech'));
    const isRender = Boolean(connectionString?.includes('render.com'));
    const providerName = isRender ? 'Render PostgreSQL' : (isNeon ? 'Neon PostgreSQL' : 'PostgreSQL no Render');

    return {
      status: isHealthy ? 'ok' : 'degraded',
      engine: pgStatus === 'connected' ? providerName : 'Camada de Dados Relacional Resiliente (Render)',
      productionSafe: pgStatus === 'connected',
      connectOnlyOnRender: true,
      isRenderEnvironment: true,
      postgres: {
        configured: Boolean(connectionString && !connectionString.includes('localhost:5432/lms_ia')),
        connected: pgStatus === 'connected',
        provider: providerName,
        latencyMs,
        error: pgStatus === 'error' ? 'Falha de conexão com o banco de dados PostgreSQL no Render' : connectionError,
        sslEnabled: requiresSsl,
      },
      stats: {
        totalDisciplines: DISCIPLINES.length,
        totalModules: 3,
        totalHoursItemized: 200,
        targetHours: 200,
        registeredUsers: memoryStore.users.size,
      },
    };
  },

  async findUserById(id: string): Promise<User | null> {
    assertDatabaseAvailable();
    if (pgPool && isPostgresConnected) {
      try {
        const res = await pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
        return res.rows[0] || null;
      } catch {}
    }
    return memoryStore.users.get(id) || null;
  },

  async findUserByEmail(email: string): Promise<User | null> {
    assertDatabaseAvailable();
    const cleanEmail = email.trim().toLowerCase();
    if (pgPool && isPostgresConnected) {
      try {
        const res = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
        return res.rows[0] || null;
      } catch {}
    }
    for (const u of memoryStore.users.values()) {
      if (u.email.toLowerCase() === cleanEmail) return u;
    }
    return null;
  },

  async findUserByGoogleSub(googleSub: string): Promise<User | null> {
    assertDatabaseAvailable();
    if (pgPool && isPostgresConnected) {
      try {
        const res = await pgPool.query(
          `SELECT u.* FROM users u
           JOIN external_identities e ON u.id = e.user_id
           WHERE e.provider = 'google' AND e.provider_id = $1`,
          [googleSub]
        );
        return res.rows[0] || null;
      } catch {}
    }
    const ext = memoryStore.externalIdentities.get(`google:${googleSub}`);
    if (ext) {
      return memoryStore.users.get(ext.user_id) || null;
    }
    return null;
  },

  async upsertGoogleUser(profile: {
    googleSub: string;
    email: string;
    name: string;
    picture?: string;
  }): Promise<User> {
    assertDatabaseAvailable();
    const cleanEmail = profile.email.trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || 'josel6449@gmail.com').trim().toLowerCase();
    
    // Regra de segurança: Apenas o e-mail pré-designado recebe perfil 'administrador'
    const targetRole: UserRole = cleanEmail === adminEmail ? 'administrador' : 'aluno';

    // 1. Verifica se já existe por Google Sub estável
    const existingBySub = await this.findUserByGoogleSub(profile.googleSub);
    if (existingBySub) {
      existingBySub.name = profile.name || existingBySub.name;
      existingBySub.avatar_url = profile.picture || existingBySub.avatar_url;
      existingBySub.updated_at = new Date().toISOString();
      if (cleanEmail === adminEmail) existingBySub.role = 'administrador';
      return existingBySub;
    }

    // 2. Verifica se usuário já existia por e-mail e vincula com segurança
    const existingByEmail = await this.findUserByEmail(cleanEmail);
    if (existingByEmail) {
      const extIdentity: ExternalIdentity = {
        id: crypto.randomUUID(),
        user_id: existingByEmail.id,
        provider: 'google',
        provider_id: profile.googleSub,
        email: cleanEmail,
        created_at: new Date().toISOString(),
      };
      memoryStore.externalIdentities.set(`google:${profile.googleSub}`, extIdentity);

      if (cleanEmail === adminEmail) existingByEmail.role = 'administrador';
      existingByEmail.avatar_url = profile.picture || existingByEmail.avatar_url;
      existingByEmail.updated_at = new Date().toISOString();
      return existingByEmail;
    }

    // 3. Cria novo usuário
    const newUserId = crypto.randomUUID();
    const newUser: User = {
      id: newUserId,
      email: cleanEmail,
      name: profile.name,
      avatar_url: profile.picture,
      role: targetRole,
      registration_number: `IF-IA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryStore.users.set(newUserId, newUser);

    const extIdentity: ExternalIdentity = {
      id: crypto.randomUUID(),
      user_id: newUserId,
      provider: 'google',
      provider_id: profile.googleSub,
      email: cleanEmail,
      created_at: new Date().toISOString(),
    };
    memoryStore.externalIdentities.set(`google:${profile.googleSub}`, extIdentity);

    if (pgPool && isPostgresConnected) {
      try {
        await pgPool.query(
          `INSERT INTO users (id, email, name, avatar_url, role, registration_number)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url`,
          [newUser.id, newUser.email, newUser.name, newUser.avatar_url, newUser.role, newUser.registration_number]
        );
        await pgPool.query(
          `INSERT INTO external_identities (user_id, provider, provider_id, email)
           VALUES ($1, 'google', $2, $3)
           ON CONFLICT (provider, provider_id) DO NOTHING`,
          [newUser.id, profile.googleSub, newUser.email]
        );
      } catch (err) {
        console.warn('⚠️ Erro ao persistir usuário no PostgreSQL:', err);
      }
    }

    return newUser;
  },

  async createSession(userId: string, ip?: string, userAgent?: string): Promise<string> {
    assertDatabaseAvailable();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 dias

    memoryStore.sessions.set(token, {
      id: token,
      userId,
      expiresAt,
      ipAddress: ip,
      userAgent,
    });

    if (pgPool && isPostgresConnected) {
      try {
        await pgPool.query(
          `INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5)`,
          [token, userId, expiresAt, ip, userAgent]
        );
      } catch {}
    }

    return token;
  },

  async getSession(token: string): Promise<User | null> {
    assertDatabaseAvailable();
    const session = memoryStore.sessions.get(token);
    if (!session) return null;

    if (session.expiresAt < new Date()) {
      memoryStore.sessions.delete(token);
      return null;
    }

    return this.findUserById(session.userId);
  },

  async deleteSession(token: string): Promise<void> {
    assertDatabaseAvailable();
    memoryStore.sessions.delete(token);
    if (pgPool && isPostgresConnected) {
      try {
        await pgPool.query('DELETE FROM sessions WHERE id = $1', [token]);
      } catch {}
    }
  },

  // ==============================================================
  // PROGRESSO SEQUENCIAL COM VALIDAÇÃO RÍGIDA NO BACKEND
  // ==============================================================
  async getUserProgress(userId: string): Promise<StudentProgress[]> {
    assertDatabaseAvailable();
    if (pgPool && isPostgresConnected) {
      try {
        const res = await pgPool.query(
          `SELECT user_id, discipline_id, lesson_id, step_number, completed, quiz_score, completed_at
           FROM student_progress WHERE user_id = $1`,
          [userId]
        );
        if (res.rows.length > 0) {
          return res.rows.map((r) => ({
            userId: r.user_id,
            disciplineId: r.discipline_id,
            lessonId: r.lesson_id,
            stepNumber: r.step_number,
            completed: r.completed,
            completedAt: typeof r.completed_at === 'string' ? r.completed_at : new Date(r.completed_at).toISOString(),
            quizScore: r.quiz_score != null ? Number(r.quiz_score) : undefined,
          }));
        }
      } catch (err) {
        console.warn('⚠️ [DB] Erro ao consultar student_progress do PostgreSQL:', err);
      }
    }

    const results: StudentProgress[] = [];
    for (const [key, p] of memoryStore.progress.entries()) {
      if (key.startsWith(`${userId}:`)) {
        results.push(p);
      }
    }
    return results;
  },

  async completeStep(
    userId: string,
    disciplineId: string,
    lessonId: string,
    stepNumber: number,
    quizScore?: number
  ): Promise<{ success: boolean; message: string; unlockedNextStep: number | null }> {
    assertDatabaseAvailable();

    // Validação 1: O passo deve ser entre 1 e 5
    if (stepNumber < 1 || stepNumber > 5) {
      return { success: false, message: 'Passo inválido (deve ser entre 1 e 5).', unlockedNextStep: null };
    }

    // Validação 2: Se não for o passo 1, o passo anterior (stepNumber - 1) PRECISA estar concluído!
    if (stepNumber > 1) {
      const prevKey = `${userId}:${disciplineId}:${lessonId}:${stepNumber - 1}`;
      const prevStep = memoryStore.progress.get(prevKey);
      if (!prevStep || !prevStep.completed) {
        return {
          success: false,
          message: `Desbloqueio não autorizado: você precisa concluir a etapa anterior (Etapa ${stepNumber - 1}) primeiro.`,
          unlockedNextStep: null,
        };
      }
    }

    // Validação 3: Se o passo for o Teste de Fixação (Passo 4), a nota precisa ser >= 7.0
    if (stepNumber === 4 && (quizScore === undefined || quizScore < 7.0)) {
      return {
        success: false,
        message: `Aprovação não concedida: nota obtida (${quizScore?.toFixed(1) || '0.0'}) é inferior ao mínimo exigido de 7.0.`,
        unlockedNextStep: null,
      };
    }

    // Salva de forma idempotente
    const progressKey = `${userId}:${disciplineId}:${lessonId}:${stepNumber}`;
    const progressRecord: StudentProgress = {
      userId,
      disciplineId,
      lessonId,
      stepNumber,
      completed: true,
      completedAt: new Date().toISOString(),
      quizScore,
    };
    memoryStore.progress.set(progressKey, progressRecord);

    if (pgPool && isPostgresConnected) {
      try {
        await pgPool.query(
          `INSERT INTO student_progress (user_id, discipline_id, lesson_id, step_number, completed, quiz_score, completed_at)
           VALUES ($1, $2, $3, $4, true, $5, NOW())
           ON CONFLICT (user_id, discipline_id, lesson_id, step_number)
           DO UPDATE SET completed = true, quiz_score = EXCLUDED.quiz_score, completed_at = NOW()`,
          [userId, disciplineId, lessonId, stepNumber, quizScore != null ? quizScore : null]
        );
      } catch (err) {
        console.warn('⚠️ [DB] Erro ao persistir student_progress no PostgreSQL:', err);
      }
    }

    const unlockedNext = stepNumber < 5 ? stepNumber + 1 : null;

    return {
      success: true,
      message: stepNumber === 5 ? 'Aula concluída com sucesso! Avaliação Final da disciplina liberada.' : `Etapa ${stepNumber} validada e concluída.`,
      unlockedNextStep: unlockedNext,
    };
  },

  // ==============================================================
  // AVALIAÇÕES DE FIXAÇÃO POR AULA (CORREÇÃO NO SERVIDOR)
  // ==============================================================
  async gradeQuiz(
    userId: string,
    disciplineId: string,
    lessonId: string,
    answers: number[]
  ): Promise<{ score: number; passed: boolean; explanation: string }> {
    assertDatabaseAvailable();
    const quiz = getDisciplineQuiz(disciplineId) || getDisciplineQuiz(lessonId);
    const official = quiz
      ? { answers: quiz.correctAnswers, explanation: quiz.explanation }
      : (QUIZ_ANSWERS_SERVER[lessonId] || QUIZ_ANSWERS_SERVER[disciplineId] || { answers: [0, 0, 0], explanation: 'Fundamentos verificados conforme gabarito oficial.' });

    let correctCount = 0;
    official.answers.forEach((ans, idx) => {
      if (answers[idx] === ans) correctCount++;
    });

    const score = Number(((correctCount / official.answers.length) * 10).toFixed(1));
    const passed = score >= 7.0;

    if (passed) {
      await this.completeStep(userId, disciplineId, lessonId, 4, score);
    }

    return {
      score,
      passed,
      explanation: official.explanation,
    };
  },

  // ==============================================================
  // AVALIAÇÃO FINAL DO COMPONENTE CURRICULAR (10 QUESTÕES - NOTA 0 A 10)
  // ==============================================================
  async getDisciplineFinalExamQuestions(disciplineId: string): Promise<FinalExamQuestion[]> {
    assertDatabaseAvailable();
    return getDisciplineFinalExam(disciplineId);
  },

  async gradeFinalExam(
    userId: string,
    disciplineId: string,
    answers: number[]
  ): Promise<{ score: number; passed: boolean; attemptId: string; feedback: string }> {
    assertDatabaseAvailable();

    // 1. Verificação rígida de pré-requisito: todas as aulas da disciplina devem estar concluídas
    const lessons = getDisciplineLessons(disciplineId);
    for (const l of lessons) {
      const step5Key = `${userId}:${disciplineId}:${l.id}:5`;
      const step5 = memoryStore.progress.get(step5Key);
      if (!step5 || !step5.completed) {
        const error: any = new Error(
          `Pré-requisito pendente: Para realizar a Avaliação Final, todas as aulas de ${disciplineId} devem estar integralmente concluídas (Passos 1 a 5).`
        );
        error.status = 403;
        throw error;
      }
    }

    // 2. Validação do formato das respostas (10 questões)
    if (!Array.isArray(answers) || answers.length !== 10) {
      const error: any = new Error('A avaliação final requer exatamente 10 respostas preenchidas.');
      error.status = 400;
      throw error;
    }

    // 3. Correção estrita no servidor
    const officialKeys = FINAL_EXAM_ANSWERS_SERVER[disciplineId] || FINAL_EXAM_ANSWERS_SERVER.default;
    let correctCount = 0;
    for (let i = 0; i < 10; i++) {
      if (answers[i] === officialKeys[i]) {
        correctCount++;
      }
    }

    const score = Number((correctCount * 1.0).toFixed(1)); // 0 a 10
    const passed = score >= 7.0; // Nota mínima: 7,0
    const attemptId = crypto.randomUUID();

    const attempt: FinalExamAttempt = {
      id: attemptId,
      userId,
      disciplineId,
      score,
      passed,
      answers,
      attemptedAt: new Date().toISOString(),
    };
    memoryStore.finalExamAttempts.push(attempt);

    // Se aprovado, registra aprovação acadêmica formal no componente curricular
    if (passed) {
      const approvalRecord: DisciplineApproval = {
        userId,
        disciplineId,
        approved: true,
        finalGrade: score,
        approvedAt: new Date().toISOString(),
      };
      memoryStore.disciplineApprovals.set(`${userId}:${disciplineId}`, approvalRecord);

      if (pgPool && isPostgresConnected) {
        try {
          await pgPool.query(
            `INSERT INTO discipline_approvals (user_id, discipline_id, approved, final_grade, approved_at)
             VALUES ($1, $2, true, $3, NOW())
             ON CONFLICT (user_id, discipline_id)
             DO UPDATE SET approved = true, final_grade = EXCLUDED.final_grade, approved_at = NOW()`,
            [userId, disciplineId, score]
          );
        } catch (err) {
          console.warn('⚠️ [DB] Erro ao persistir discipline_approvals no PostgreSQL:', err);
        }
      }
    }

    await this.logAudit(userId, 'SUBMIT_FINAL_EXAM', 'academic', undefined, {
      disciplineId,
      score,
      passed,
      attemptId,
    });

    return {
      score,
      passed,
      attemptId,
      feedback: passed
        ? `Parabéns! Você obteve nota ${score.toFixed(1)}/10,0 e foi APROVADO(A) no componente curricular!`
        : `Nota ${score.toFixed(1)}/10,0 insuficiente para aprovação (mínimo exigido: 7,0). Revise o material didático e realize uma nova tentativa.`,
    };
  },

  async getDisciplineApproval(userId: string, disciplineId: string): Promise<DisciplineApproval | null> {
    assertDatabaseAvailable();
    if (pgPool && isPostgresConnected) {
      try {
        const res = await pgPool.query(
          `SELECT user_id, discipline_id, approved, final_grade, approved_at
           FROM discipline_approvals WHERE user_id = $1 AND discipline_id = $2`,
          [userId, disciplineId]
        );
        if (res.rows[0]) {
          const row = res.rows[0];
          return {
            userId: row.user_id,
            disciplineId: row.discipline_id,
            approved: row.approved,
            finalGrade: Number(row.final_grade),
            approvedAt: typeof row.approved_at === 'string' ? row.approved_at : new Date(row.approved_at).toISOString(),
          };
        }
      } catch (err) {
        console.warn('⚠️ [DB] Erro ao consultar discipline_approvals do PostgreSQL:', err);
      }
    }
    return memoryStore.disciplineApprovals.get(`${userId}:${disciplineId}`) || null;
  },

  async getUserApprovals(userId: string): Promise<DisciplineApproval[]> {
    assertDatabaseAvailable();
    if (pgPool && isPostgresConnected) {
      try {
        const res = await pgPool.query(
          `SELECT user_id, discipline_id, approved, final_grade, approved_at
           FROM discipline_approvals WHERE user_id = $1`,
          [userId]
        );
        if (res.rows.length > 0) {
          return res.rows.map((row) => ({
            userId: row.user_id,
            disciplineId: row.discipline_id,
            approved: row.approved,
            finalGrade: Number(row.final_grade),
            approvedAt: typeof row.approved_at === 'string' ? row.approved_at : new Date(row.approved_at).toISOString(),
          }));
        }
      } catch (err) {
        console.warn('⚠️ [DB] Erro ao listar discipline_approvals do PostgreSQL:', err);
      }
    }
    const approvals: DisciplineApproval[] = [];
    for (const [key, app] of memoryStore.disciplineApprovals.entries()) {
      if (key.startsWith(`${userId}:`)) {
        approvals.push(app);
      }
    }
    return approvals;
  },

  // ==============================================================
  // TUTOR IA - HISTÓRICO COM ISOLAMENTO ESTRITO POR USUÁRIO
  // ==============================================================
  async getChatHistory(userId: string, disciplineId?: string): Promise<ChatMessage[]> {
    assertDatabaseAvailable();
    if (pgPool && isPostgresConnected) {
      try {
        let query = 'SELECT * FROM chat_messages WHERE user_id = $1';
        const params: any[] = [userId];
        if (disciplineId) {
          query += ' AND discipline_id = $2';
          params.push(disciplineId);
        }
        query += ' ORDER BY created_at ASC';
        const res = await pgPool.query(query, params);
        if (res.rows.length > 0) {
          return res.rows.map((r) => ({
            id: r.id,
            role: r.role,
            content: r.content,
            sources: typeof r.sources === 'string' ? JSON.parse(r.sources) : r.sources || [],
            timestamp: typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
            disciplineId: r.discipline_id || undefined,
            lessonId: r.lesson_id || undefined,
          }));
        }
      } catch (err) {
        console.warn('⚠️ [DB] Erro ao consultar chat_messages do PostgreSQL:', err);
      }
    }
    return memoryStore.chatMessages
      .filter((m) => m.userId === userId && (!disciplineId || m.disciplineId === disciplineId))
      .map(({ userId: _uid, ...msg }) => msg);
  },

  async addChatMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'> & { userId: string }): Promise<ChatMessage> {
    assertDatabaseAvailable();
    const fullMsg: StoredChatMessage = {
      id: crypto.randomUUID(),
      userId: msg.userId, // Rigorosamente associado ao aluno autenticado
      role: msg.role,
      content: msg.content,
      disciplineId: msg.disciplineId,
      lessonId: msg.lessonId,
      sources: msg.sources,
      timestamp: new Date().toISOString(),
    };

    memoryStore.chatMessages.push(fullMsg);

    if (pgPool && isPostgresConnected) {
      try {
        await pgPool.query(
          `INSERT INTO chat_messages (id, user_id, discipline_id, lesson_id, role, content, sources)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            fullMsg.id,
            fullMsg.userId,
            fullMsg.disciplineId || null,
            fullMsg.lessonId || null,
            fullMsg.role,
            fullMsg.content,
            JSON.stringify(fullMsg.sources || []),
          ]
        );
      } catch {}
    }

    return fullMsg;
  },

  // ==============================================================
  // CERTIFICADOS E AUTENTICIDADE
  // ==============================================================
  async verifyCertificate(code: string): Promise<Certificate | null> {
    assertDatabaseAvailable();
    const cleanCode = code.trim().toUpperCase();

    if (pgPool && isPostgresConnected) {
      try {
        const res = await pgPool.query(
          `SELECT c.*, u.name as user_name FROM certificates c
           JOIN users u ON c.user_id = u.id
           WHERE UPPER(c.validation_code) = $1 AND c.status = 'valido'`,
          [cleanCode]
        );
        if (res.rows[0]) {
          const row = res.rows[0];
          return {
            id: row.id,
            validationCode: row.validation_code,
            userId: row.user_id,
            userName: row.user_name || 'Estudante Certificado',
            courseTitle: row.course_title,
            totalHours: row.total_hours,
            completionDate: typeof row.completion_date === 'string' ? row.completion_date : new Date(row.completion_date).toISOString().split('T')[0],
            status: row.status,
            issuedAt: row.issued_at,
          };
        }
      } catch (err) {
        console.warn('⚠️ [DB] Erro ao verificar certificado no PostgreSQL:', err);
      }
    }

    for (const cert of memoryStore.certificates.values()) {
      if (cert.validationCode.toUpperCase() === cleanCode && cert.status === 'valido') {
        return cert;
      }
    }
    return null;
  },

  async getUserCertificate(userId: string): Promise<Certificate | null> {
    assertDatabaseAvailable();
    if (pgPool && isPostgresConnected) {
      try {
        const res = await pgPool.query(
          `SELECT c.*, u.name as user_name FROM certificates c
           JOIN users u ON c.user_id = u.id
           WHERE c.user_id = $1 AND c.status = 'valido'
           ORDER BY c.issued_at DESC LIMIT 1`,
          [userId]
        );
        if (res.rows[0]) {
          const row = res.rows[0];
          return {
            id: row.id,
            validationCode: row.validation_code,
            userId: row.user_id,
            userName: row.user_name || 'Estudante',
            courseTitle: row.course_title,
            totalHours: row.total_hours,
            completionDate: typeof row.completion_date === 'string' ? row.completion_date : new Date(row.completion_date).toISOString().split('T')[0],
            status: row.status,
            issuedAt: row.issued_at,
          };
        }
      } catch (err) {
        console.warn('⚠️ [DB] Erro ao buscar certificado do usuário no PostgreSQL:', err);
      }
    }

    for (const cert of memoryStore.certificates.values()) {
      if (cert.userId === userId && cert.status === 'valido') {
        return cert;
      }
    }
    return null;
  },

  async issueCertificate(userId: string): Promise<{ success: boolean; certificate?: Certificate; reason?: string }> {
    assertDatabaseAvailable();
    const user = await this.findUserById(userId);
    if (!user) return { success: false, reason: 'Usuário não localizado.' };

    // 1. Se já possui certificado emitido, retorna o existente (evita duplicidade)
    const existing = await this.getUserCertificate(userId);
    if (existing) {
      return { success: true, certificate: existing };
    }

    // 2. Auditoria rigorosa de aprovação nos 20 componentes curriculares com nota mínima 7.0
    const approvals = await this.getUserApprovals(userId);
    const approvedCount = approvals.filter((a) => a.approved && (a.finalGrade === undefined || a.finalGrade >= 7.0)).length;

    if (approvedCount < DISCIPLINES.length) {
      return {
        success: false,
        reason: `Requisitos acadêmicos incompletos: ${approvedCount} de ${DISCIPLINES.length} componentes aprovados com nota mínima 7,0.`,
      };
    }

    // 3. Gera código único e persistente
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const validationCode = `IFIA-2026-${randomHex}`;
    const completionDate = new Date().toISOString().split('T')[0];
    const issuedAt = new Date().toISOString();

    const cert: Certificate = {
      id: crypto.randomUUID(),
      validationCode,
      userId: user.id,
      userName: user.name,
      courseTitle: 'Pré-Curso de Inteligência Artificial',
      totalHours: 200,
      completionDate,
      status: 'valido',
      issuedAt,
    };

    if (pgPool && isPostgresConnected) {
      try {
        await pgPool.query(
          `INSERT INTO certificates (id, validation_code, user_id, course_title, total_hours, completion_date, status, issued_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [cert.id, cert.validationCode, cert.userId, cert.courseTitle, cert.totalHours, cert.completionDate, cert.status, cert.issuedAt]
        );
      } catch (err) {
        console.warn('⚠️ [DB] Erro ao gravar certificado no PostgreSQL:', err);
      }
    }

    memoryStore.certificates.set(cert.id, cert);

    await this.logAudit(userId, 'CERTIFICATE_ISSUED', `certificate:${validationCode}`, undefined, {
      studentName: user.name,
      validationCode,
    });

    return { success: true, certificate: cert };
  },

  async issueCertificateIfEligible(userId: string, allowOfficialIssuance = false): Promise<{ eligible: boolean; certificate?: Certificate; reason?: string }> {
    assertDatabaseAvailable();
    const user = await this.findUserById(userId);
    if (!user) return { eligible: false, reason: 'Usuário não localizado.' };

    // 1. Auditoria dos 20 componentes aprovados
    const approvals = await this.getUserApprovals(userId);
    const approvedCount = approvals.filter((a) => a.approved).length;

    if (approvedCount < DISCIPLINES.length) {
      return {
        eligible: false,
        reason: `Requisitos acadêmicos incompletos: ${approvedCount} de ${DISCIPLINES.length} componentes aprovados com nota mínima 7,0.`,
      };
    }

    // Se a emissão oficial foi explicitamente solicitada (Etapa 4):
    if (allowOfficialIssuance) {
      const result = await this.issueCertificate(userId);
      return { eligible: result.success, certificate: result.certificate, reason: result.reason };
    }

    // Regra padrão de auditoria prévia da Etapa 1.1:
    return {
      eligible: false,
      reason: 'Etapa 1.1 em vigor: Todos os componentes acadêmicos foram aprovados, porém a emissão de diplomas oficiais segue bloqueada aguardando definição do regimento institucional de certificação.',
    };
  },

  // ==============================================================
  // GESTÃO ACADÊMICA & DOCÊNCIA (PROFESSORES E ADMINISTRADORES)
  // ==============================================================
  async listAllCertificates(): Promise<Certificate[]> {
    assertDatabaseAvailable();
    if (pgPool && isPostgresConnected) {
      try {
        const res = await pgPool.query(
          `SELECT c.*, u.name as user_name FROM certificates c
           JOIN users u ON c.user_id = u.id
           ORDER BY c.issued_at DESC`
        );
        return res.rows.map((row) => ({
          id: row.id,
          validationCode: row.validation_code,
          userId: row.user_id,
          userName: row.user_name || 'Estudante',
          courseTitle: row.course_title,
          totalHours: row.total_hours,
          completionDate: typeof row.completion_date === 'string' ? row.completion_date : new Date(row.completion_date).toISOString().split('T')[0],
          status: row.status,
          issuedAt: row.issued_at,
        }));
      } catch (err) {
        console.warn('⚠️ [DB] Erro ao listar certificados do PostgreSQL:', err);
      }
    }
    return Array.from(memoryStore.certificates.values()).sort(
      (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
    );
  },

  async listAllStudents(): Promise<Array<{
    id: string;
    name: string;
    email: string;
    registrationNumber?: string;
    role: string;
    createdAt: string;
    completedDisciplinesCount: number;
    overallPercent: number;
    hasCertificate: boolean;
    certificateCode?: string;
  }>> {
    assertDatabaseAvailable();
    let studentsList: User[] = [];

    if (pgPool && isPostgresConnected) {
      try {
        const res = await pgPool.query(
          `SELECT id, name, email, registration_number, role, created_at, updated_at
           FROM users WHERE role = 'aluno' ORDER BY name ASC`
        );
        studentsList = res.rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          registration_number: r.registration_number,
          role: r.role,
          created_at: r.created_at,
          updated_at: r.updated_at,
        }));
      } catch (err) {
        console.warn('⚠️ [DB] Erro ao consultar estudantes no PostgreSQL:', err);
      }
    }

    if (studentsList.length === 0) {
      studentsList = Array.from(memoryStore.users.values()).filter((u) => u.role === 'aluno');
    }

    const totalCurriculumSteps = DISCIPLINES.reduce((acc, d) => acc + getDisciplineLessons(d.id).length * 5, 0);

    const result = [];
    for (const student of studentsList) {
      const progress = await this.getUserProgress(student.id);
      const approvals = await this.getUserApprovals(student.id);
      const cert = await this.getUserCertificate(student.id);

      const approvedCount = approvals.filter((a) => a.approved && (a.finalGrade === undefined || a.finalGrade >= 7.0)).length;
      const completedSteps = progress.filter((p) => p.completed).length;
      const overallPercent = totalCurriculumSteps > 0
        ? Math.min(100, Math.round((completedSteps / totalCurriculumSteps) * 100))
        : 0;

      result.push({
        id: student.id,
        name: student.name,
        email: student.email,
        registrationNumber: student.registration_number,
        role: student.role,
        createdAt: student.created_at,
        completedDisciplinesCount: approvedCount,
        overallPercent,
        hasCertificate: Boolean(cert),
        certificateCode: cert?.validationCode,
      });
    }

    return result;
  },

  async getStudentDetailedAcademicRecord(studentId: string): Promise<any> {
    assertDatabaseAvailable();
    const student = await this.findUserById(studentId);
    if (!student) return null;

    const progress = await this.getUserProgress(studentId);
    const approvals = await this.getUserApprovals(studentId);
    const certificate = await this.getUserCertificate(studentId);

    const disciplinesProgress = DISCIPLINES.map((d) => {
      const lessons = getDisciplineLessons(d.id);
      const approval = approvals.find((a) => a.disciplineId === d.id && a.approved);
      const completedSteps = progress.filter((p) => p.disciplineId === d.id && p.completed).length;
      const totalSteps = lessons.length * 5;
      return {
        disciplineId: d.id,
        code: d.code,
        title: d.title,
        moduleId: d.moduleId,
        hours: d.hours,
        approved: Boolean(approval),
        finalGrade: approval ? approval.finalGrade : null,
        completedSteps,
        totalSteps,
        percent: Math.min(100, Math.round((completedSteps / totalSteps) * 100)),
      };
    });

    return {
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        registrationNumber: student.registration_number,
        role: student.role,
        createdAt: student.created_at,
      },
      disciplines: disciplinesProgress,
      approvedDisciplinesCount: approvals.filter((a) => a.approved && (a.finalGrade === undefined || a.finalGrade >= 7.0)).length,
      totalDisciplinesCount: DISCIPLINES.length,
      certificate,
    };
  },

  async logAudit(userId: string | undefined, action: string, resource: string, ip?: string, details?: any) {
    memoryStore.auditLogs.push({
      id: crypto.randomUUID(),
      userId,
      action,
      resource,
      ip,
      details,
      timestamp: new Date().toISOString(),
    });
  },
};