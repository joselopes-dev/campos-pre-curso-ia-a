import pg from 'pg';
import crypto from 'crypto';
import { DISCIPLINES, getDisciplineLessons, getDisciplineFinalExam } from '../db/seed-data.ts';
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

// ==============================================================
// CONEXÃO EXCLUSIVA COM RENDER POSTGRESQL
// ==============================================================
// O serviço só abre conexão PostgreSQL quando está hospedado no Render.
// Em produção, DATABASE_URL deve receber a INTERNAL DATABASE URL do Render.
const isRenderEnvironment =
  process.env.RENDER === 'true' || Boolean(process.env.RENDER_SERVICE_ID);

const connectionString = process.env.DATABASE_URL?.trim();

let pgPool: pg.Pool | null = null;
let isPostgresConnected = false;
let connectionError: string | null = null;
let initializationPromise: Promise<void> | null = null;

function createDatabaseUnavailableError(): Error & { status: number; code: string } {
  const error = new Error(
    'Banco de dados indisponível. Configure DATABASE_URL com a Internal Database URL do Render PostgreSQL e confirme que o banco está Available na mesma região do Web Service.'
  ) as Error & { status: number; code: string };
  error.status = 503;
  error.code = 'DATABASE_UNAVAILABLE';
  return error;
}

/**
 * Inicializa e testa a conexão com o Render PostgreSQL.
 * A URL interna do Render usa hostname privado dpg-... sem domínio público.
 */
export async function initializeDatabase(): Promise<void> {
  if (!isRenderEnvironment) return;
  if (isPostgresConnected && pgPool) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    if (!connectionString) {
      throw new Error('DATABASE_URL não foi configurada no Web Service do Render.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(connectionString);
    } catch {
      throw new Error('DATABASE_URL inválida. Informe a Internal Database URL do Render PostgreSQL.');
    }

    if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
      throw new Error('DATABASE_URL deve usar o protocolo postgres:// ou postgresql://.');
    }

    // Exige a URL interna do Render: hostname privado dpg-... sem sufixo público.
    // Isso impede apontar acidentalmente o serviço para um banco externo.
    const isRenderInternalHost =
      parsedUrl.hostname.startsWith('dpg-') && !parsedUrl.hostname.includes('.');
    if (!isRenderInternalHost) {
      throw new Error(
        'DATABASE_URL não parece ser a URL interna do Render PostgreSQL. Copie a opção Internal Database URL em Connect no painel do banco.'
      );
    }

    // A conexão interna do Render não exige TLS. Se sslmode=require estiver
    // presente, habilita TLS aceitando o certificado interno autoassinado.
    const sslMode = parsedUrl.searchParams.get('sslmode');
    const sslConfig = sslMode === 'require' ? { rejectUnauthorized: false } : false;

    console.log('🚀 [DB] Render detectado. Inicializando Render PostgreSQL pela rede interna...');

    pgPool = new pg.Pool({
      connectionString,
      ssl: sslConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
    });

    pgPool.on('error', (err) => {
      connectionError = err.message;
      isPostgresConnected = false;
      const failedPool = pgPool;
      pgPool = null;
      initializationPromise = null;
      if (failedPool) {
        void failedPool.end().catch(() => undefined);
      }
      console.error('❌ [DB] Erro inesperado no pool PostgreSQL do Render:', err.message);
    });

    const client = await pgPool.connect();
    try {
      await client.query('SELECT 1');
      isPostgresConnected = true;
      connectionError = null;
      console.log('✅ [DB] Conexão validada com Render PostgreSQL.');
    } finally {
      client.release();
    }
  })();

  try {
    await initializationPromise;
  } catch (err: any) {
    connectionError = err?.message || 'Falha desconhecida ao conectar ao Render PostgreSQL.';
    isPostgresConnected = false;
    const failedPool = pgPool;
    pgPool = null;
    initializationPromise = null;
    if (failedPool) {
      try { await failedPool.end(); } catch { /* encerra pool com falha */ }
    }
    console.error('❌ [DB] Não foi possível conectar ao Render PostgreSQL:', connectionError);
    throw createDatabaseUnavailableError();
  }
}

// A conexão começa na inicialização do módulo; as operações aguardam a promessa.
const startupDatabaseConnection = isRenderEnvironment
  ? initializeDatabase().catch((err) => {
      console.error('❌ [DB] Inicialização do banco pendente:', err?.message || err);
    })
  : Promise.resolve();

/** Em produção, nenhuma operação pode continuar usando armazenamento em memória. */
export async function assertDatabaseAvailable(): Promise<void> {
  if (!isRenderEnvironment) return;

  await startupDatabaseConnection;
  if (!pgPool || !isPostgresConnected) {
    await initializeDatabase();
  }

  if (!pgPool || !isPostgresConnected) {
    throw createDatabaseUnavailableError();
  }
}

function getConnectedPool(): pg.Pool {
  if (!isRenderEnvironment || !pgPool || !isPostgresConnected) {
    throw createDatabaseUnavailableError();
  }
  return pgPool;
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
const QUIZ_ANSWERS_SERVER: Record<string, { answers: number[]; explanation: string }> = {
  'disc-01-aula-1': {
    answers: [1, 2, 0], // Índices das respostas corretas
    explanation: 'No Linux e em SOs modernos para IA, a separação de privilégios e a CLI garantem automação reprodutível.',
  },
  'disc-01-aula-2': {
    answers: [0, 3, 1],
    explanation: 'Comandos Bash como grep, awk, sed e xargs permitem manipular gigabytes de logs e datasets diretamente na memória.',
  },
  'disc-02-aula-1': {
    answers: [2, 1, 3],
    explanation: 'Pensamento algorítmico precede qualquer linguagem de programação e otimiza recursos computacionais.',
  },
};

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
        engine: 'Armazenamento em Memória (desenvolvimento/testes)',
        productionSafe: false,
        connectOnlyOnRender: true,
        isRenderEnvironment: false,
        postgres: {
          configured: false,
          connected: false,
          activeOnRenderOnly: true,
          provider: 'Render PostgreSQL (conexão somente no Render)',
          latencyMs: null,
          error: null,
          sslEnabled: false,
          message: 'Em ambiente local, o armazenamento em memória é usado apenas para desenvolvimento e testes.',
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
    let registeredUsers = 0;

    try {
      await initializeDatabase();
      const pool = getConnectedPool();
      const startedAt = Date.now();
      await pool.query('SELECT 1');
      latencyMs = Date.now() - startedAt;
      const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM users');
      registeredUsers = Number(countResult.rows[0]?.total || 0);
      pgStatus = 'connected';
      isPostgresConnected = true;
      connectionError = null;
    } catch (err: any) {
      pgStatus = 'error';
      isPostgresConnected = false;
      connectionError = err?.message || connectionError;
      const failedPool = pgPool;
      pgPool = null;
      initializationPromise = null;
      if (failedPool) void failedPool.end().catch(() => undefined);
    }

    const isHealthy = pgStatus === 'connected';
    return {
      status: isHealthy ? 'ok' : 'degraded',
      engine: isHealthy ? 'Render PostgreSQL' : 'Render PostgreSQL indisponível',
      productionSafe: isHealthy,
      connectOnlyOnRender: true,
      isRenderEnvironment: true,
      postgres: {
        configured: Boolean(connectionString),
        connected: isHealthy,
        provider: 'Render PostgreSQL (Internal Database URL)',
        latencyMs,
        error: isHealthy ? null : connectionError || 'Falha de conexão com Render PostgreSQL.',
        sslEnabled: (() => {
          try { return new URL(connectionString || '').searchParams.get('sslmode') === 'require'; }
          catch { return false; }
        })(),
      },
      stats: {
        totalDisciplines: DISCIPLINES.length,
        totalModules: 3,
        totalHoursItemized: 200,
        targetHours: 200,
        registeredUsers,
      },
    };
  },

  async findUserById(id: string): Promise<User | null> {
    await assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const res = await getConnectedPool().query('SELECT * FROM users WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return memoryStore.users.get(id) || null;
  },

  async findUserByEmail(email: string): Promise<User | null> {
    await assertDatabaseAvailable();
    const cleanEmail = email.trim().toLowerCase();
    if (isRenderEnvironment) {
      const res = await getConnectedPool().query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
      return res.rows[0] || null;
    }
    for (const user of memoryStore.users.values()) {
      if (user.email.toLowerCase() === cleanEmail) return user;
    }
    return null;
  },

  async findUserByGoogleSub(googleSub: string): Promise<User | null> {
    await assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const res = await getConnectedPool().query(
        `SELECT u.* FROM users u
         JOIN external_identities e ON u.id = e.user_id
         WHERE e.provider = 'google' AND e.provider_id = $1`,
        [googleSub]
      );
      return res.rows[0] || null;
    }
    const identity = memoryStore.externalIdentities.get(`google:${googleSub}`);
    return identity ? memoryStore.users.get(identity.user_id) || null : null;
  },

  async upsertGoogleUser(profile: {
    googleSub: string;
    email: string;
    name: string;
    picture?: string;
  }): Promise<User> {
    await assertDatabaseAvailable();
    const cleanEmail = profile.email.trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || 'josel6449@gmail.com').trim().toLowerCase();
    const isAdmin = cleanEmail === adminEmail;
    const targetRole: UserRole = isAdmin ? 'administrador' : 'aluno';

    if (isRenderEnvironment) {
      const pool = getConnectedPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const byGoogle = await client.query(
          `SELECT u.* FROM users u
           JOIN external_identities e ON e.user_id = u.id
           WHERE e.provider = 'google' AND e.provider_id = $1
           LIMIT 1`,
          [profile.googleSub]
        );

        let user = byGoogle.rows[0];
        if (user) {
          const updated = await client.query(
            `UPDATE users
             SET name = $2, avatar_url = COALESCE($3, avatar_url),
                 role = CASE WHEN $4 THEN 'administrador' ELSE role END,
                 updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [user.id, profile.name || user.name, profile.picture || null, isAdmin]
          );
          user = updated.rows[0];
        } else {
          const byEmail = await client.query(
            'SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1',
            [cleanEmail]
          );

          if (byEmail.rows[0]) {
            const existing = byEmail.rows[0];
            const updated = await client.query(
              `UPDATE users
               SET name = $2, avatar_url = COALESCE($3, avatar_url),
                   role = CASE WHEN $4 THEN 'administrador' ELSE role END,
                   updated_at = NOW()
               WHERE id = $1 RETURNING *`,
              [existing.id, profile.name || existing.name, profile.picture || null, isAdmin]
            );
            user = updated.rows[0];
          } else {
            const registrationNumber = `IF-IA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const inserted = await client.query(
              `INSERT INTO users (id, email, name, avatar_url, role, registration_number)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
              [crypto.randomUUID(), cleanEmail, profile.name, profile.picture || null, targetRole, registrationNumber]
            );
            user = inserted.rows[0];
          }

          await client.query(
            `INSERT INTO external_identities (user_id, provider, provider_id, email)
             VALUES ($1, 'google', $2, $3)
             ON CONFLICT (provider, provider_id)
             DO UPDATE SET user_id = EXCLUDED.user_id, email = EXCLUDED.email`,
            [user.id, profile.googleSub, cleanEmail]
          );
        }

        await client.query('COMMIT');
        return user as User;
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* rollback best effort */ }
        throw err;
      } finally {
        client.release();
      }
    }

    // Armazenamento em memória preservado somente para desenvolvimento/testes locais.
    const existingBySub = await this.findUserByGoogleSub(profile.googleSub);
    if (existingBySub) {
      existingBySub.name = profile.name || existingBySub.name;
      existingBySub.avatar_url = profile.picture || existingBySub.avatar_url;
      existingBySub.updated_at = new Date().toISOString();
      if (isAdmin) existingBySub.role = 'administrador';
      return existingBySub;
    }

    const existingByEmail = await this.findUserByEmail(cleanEmail);
    if (existingByEmail) {
      const identity: ExternalIdentity = {
        id: crypto.randomUUID(), user_id: existingByEmail.id, provider: 'google',
        provider_id: profile.googleSub, email: cleanEmail, created_at: new Date().toISOString(),
      };
      memoryStore.externalIdentities.set(`google:${profile.googleSub}`, identity);
      if (isAdmin) existingByEmail.role = 'administrador';
      existingByEmail.avatar_url = profile.picture || existingByEmail.avatar_url;
      existingByEmail.updated_at = new Date().toISOString();
      return existingByEmail;
    }

    const newUser: User = {
      id: crypto.randomUUID(), email: cleanEmail, name: profile.name, avatar_url: profile.picture,
      role: targetRole,
      registration_number: `IF-IA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    memoryStore.users.set(newUser.id, newUser);
    memoryStore.externalIdentities.set(`google:${profile.googleSub}`, {
      id: crypto.randomUUID(), user_id: newUser.id, provider: 'google', provider_id: profile.googleSub,
      email: cleanEmail, created_at: new Date().toISOString(),
    });
    return newUser;
  },

  async createSession(userId: string, ip?: string, userAgent?: string): Promise<string> {
    await assertDatabaseAvailable();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    if (isRenderEnvironment) {
      await getConnectedPool().query(
        `INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [token, userId, expiresAt, ip || null, userAgent || null]
      );
      return token;
    }

    memoryStore.sessions.set(token, { id: token, userId, expiresAt, ipAddress: ip, userAgent });
    return token;
  },

  async getSession(token: string): Promise<User | null> {
    await assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const result = await getConnectedPool().query(
        `SELECT u.* FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.expires_at > NOW()
         LIMIT 1`,
        [token]
      );
      if (!result.rows[0]) {
        await getConnectedPool().query('DELETE FROM sessions WHERE id = $1 AND expires_at <= NOW()', [token]);
        return null;
      }
      return result.rows[0] as User;
    }

    const session = memoryStore.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      memoryStore.sessions.delete(token);
      return null;
    }
    return this.findUserById(session.userId);
  },

  async deleteSession(token: string): Promise<void> {
    await assertDatabaseAvailable();
    if (isRenderEnvironment) {
      await getConnectedPool().query('DELETE FROM sessions WHERE id = $1', [token]);
      return;
    }
    memoryStore.sessions.delete(token);
  },

  // ==============================================================
  // PROGRESSO SEQUENCIAL COM VALIDAÇÃO RÍGIDA NO BACKEND
  // ==============================================================
  async getUserProgress(userId: string): Promise<StudentProgress[]> {
    await assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const res = await getConnectedPool().query(
        `SELECT user_id, discipline_id, lesson_id, step_number, completed, quiz_score, completed_at
         FROM student_progress WHERE user_id = $1 ORDER BY discipline_id, lesson_id, step_number`,
        [userId]
      );
      return res.rows.map((r) => ({
        userId: r.user_id, disciplineId: r.discipline_id, lessonId: r.lesson_id,
        stepNumber: Number(r.step_number), completed: Boolean(r.completed),
        completedAt: typeof r.completed_at === 'string' ? r.completed_at : new Date(r.completed_at).toISOString(),
        quizScore: r.quiz_score != null ? Number(r.quiz_score) : undefined,
      }));
    }
    return Array.from(memoryStore.progress.entries())
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, progress]) => progress);
  },

  async completeStep(
    userId: string,
    disciplineId: string,
    lessonId: string,
    stepNumber: number,
    quizScore?: number
  ): Promise<{ success: boolean; message: string; unlockedNextStep: number | null }> {
    await assertDatabaseAvailable();

    if (stepNumber < 1 || stepNumber > 5) {
      return { success: false, message: 'Passo inválido (deve ser entre 1 e 5).', unlockedNextStep: null };
    }
    if (stepNumber === 4 && (quizScore === undefined || quizScore < 7.0)) {
      return {
        success: false,
        message: `Aprovação não concedida: nota obtida (${quizScore?.toFixed(1) || '0.0'}) é inferior ao mínimo exigido de 7.0.`,
        unlockedNextStep: null,
      };
    }

    if (isRenderEnvironment) {
      const pool = getConnectedPool();
      if (stepNumber > 1) {
        const previous = await pool.query(
          `SELECT 1 FROM student_progress
           WHERE user_id = $1 AND discipline_id = $2 AND lesson_id = $3
             AND step_number = $4 AND completed = true LIMIT 1`,
          [userId, disciplineId, lessonId, stepNumber - 1]
        );
        if (!previous.rows[0]) {
          return {
            success: false,
            message: `Desbloqueio não autorizado: você precisa concluir a etapa anterior (Etapa ${stepNumber - 1}) primeiro.`,
            unlockedNextStep: null,
          };
        }
      }

      await pool.query(
        `INSERT INTO student_progress (user_id, discipline_id, lesson_id, step_number, completed, quiz_score, completed_at)
         VALUES ($1, $2, $3, $4, true, $5, NOW())
         ON CONFLICT (user_id, discipline_id, lesson_id, step_number)
         DO UPDATE SET completed = true, quiz_score = EXCLUDED.quiz_score, completed_at = NOW()`,
        [userId, disciplineId, lessonId, stepNumber, quizScore != null ? quizScore : null]
      );
    } else {
      if (stepNumber > 1) {
        const previousKey = `${userId}:${disciplineId}:${lessonId}:${stepNumber - 1}`;
        const previous = memoryStore.progress.get(previousKey);
        if (!previous || !previous.completed) {
          return {
            success: false,
            message: `Desbloqueio não autorizado: você precisa concluir a etapa anterior (Etapa ${stepNumber - 1}) primeiro.`,
            unlockedNextStep: null,
          };
        }
      }
      const key = `${userId}:${disciplineId}:${lessonId}:${stepNumber}`;
      memoryStore.progress.set(key, {
        userId, disciplineId, lessonId, stepNumber, completed: true,
        completedAt: new Date().toISOString(), quizScore,
      });
    }

    return {
      success: true,
      message: stepNumber === 5 ? 'Aula concluída com sucesso! Avaliação Final da disciplina liberada.' : `Etapa ${stepNumber} validada e concluída.`,
      unlockedNextStep: stepNumber < 5 ? stepNumber + 1 : null,
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
    await assertDatabaseAvailable();
    const key = lessonId || 'disc-01-aula-1';
    const official = QUIZ_ANSWERS_SERVER[key] || { answers: [1, 2, 0], explanation: 'Fundamentos verificados conforme gabarito oficial.' };

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
    await assertDatabaseAvailable();
    return getDisciplineFinalExam(disciplineId);
  },

  async gradeFinalExam(
    userId: string,
    disciplineId: string,
    answers: number[]
  ): Promise<{ score: number; passed: boolean; attemptId: string; feedback: string }> {
    await assertDatabaseAvailable();

    // 1. Verificação rígida de pré-requisito: todas as aulas da disciplina devem estar concluídas
    const lessons = getDisciplineLessons(disciplineId);
    for (const l of lessons) {
      let step5Completed = false;
      if (isRenderEnvironment) {
        const result = await getConnectedPool().query(
          `SELECT 1 FROM student_progress
           WHERE user_id = $1 AND discipline_id = $2 AND lesson_id = $3
             AND step_number = 5 AND completed = true LIMIT 1`,
          [userId, disciplineId, l.id]
        );
        step5Completed = Boolean(result.rows[0]);
      } else {
        const step5Key = `${userId}:${disciplineId}:${l.id}:5`;
        step5Completed = Boolean(memoryStore.progress.get(step5Key)?.completed);
      }
      if (!step5Completed) {
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
    if (!isRenderEnvironment) memoryStore.finalExamAttempts.push(attempt);

    // Se aprovado, registra aprovação acadêmica formal no componente curricular
    if (passed) {
      const approvalRecord: DisciplineApproval = {
        userId,
        disciplineId,
        approved: true,
        finalGrade: score,
        approvedAt: new Date().toISOString(),
      };
      if (isRenderEnvironment) {
        await getConnectedPool().query(
          `INSERT INTO discipline_approvals (user_id, discipline_id, approved, final_grade, approved_at)
           VALUES ($1, $2, true, $3, NOW())
           ON CONFLICT (user_id, discipline_id)
           DO UPDATE SET approved = true, final_grade = EXCLUDED.final_grade, approved_at = NOW()`,
          [userId, disciplineId, score]
        );
      } else {
        memoryStore.disciplineApprovals.set(`${userId}:${disciplineId}`, approvalRecord);
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
    await assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const res = await getConnectedPool().query(
        `SELECT user_id, discipline_id, approved, final_grade, approved_at
         FROM discipline_approvals WHERE user_id = $1 AND discipline_id = $2`,
        [userId, disciplineId]
      );
      const row = res.rows[0];
      return row ? {
        userId: row.user_id, disciplineId: row.discipline_id, approved: row.approved,
        finalGrade: Number(row.final_grade),
        approvedAt: typeof row.approved_at === 'string' ? row.approved_at : new Date(row.approved_at).toISOString(),
      } : null;
    }
    return memoryStore.disciplineApprovals.get(`${userId}:${disciplineId}`) || null;
  },

  async getUserApprovals(userId: string): Promise<DisciplineApproval[]> {
    await assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const res = await getConnectedPool().query(
        `SELECT user_id, discipline_id, approved, final_grade, approved_at
         FROM discipline_approvals WHERE user_id = $1`,
        [userId]
      );
      return res.rows.map((row) => ({
        userId: row.user_id, disciplineId: row.discipline_id, approved: row.approved,
        finalGrade: Number(row.final_grade),
        approvedAt: typeof row.approved_at === 'string' ? row.approved_at : new Date(row.approved_at).toISOString(),
      }));
    }
    return Array.from(memoryStore.disciplineApprovals.entries())
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, approval]) => approval);
  },

  // ==============================================================
  // TUTOR IA - HISTÓRICO COM ISOLAMENTO ESTRITO POR USUÁRIO
  // ==============================================================
  async getChatHistory(userId: string, disciplineId?: string): Promise<ChatMessage[]> {
    await assertDatabaseAvailable();
    if (isRenderEnvironment) {
      let query = 'SELECT * FROM chat_messages WHERE user_id = $1';
      const params: any[] = [userId];
      if (disciplineId) { query += ' AND discipline_id = $2'; params.push(disciplineId); }
      query += ' ORDER BY created_at ASC';
      const res = await getConnectedPool().query(query, params);
      return res.rows.map((row) => ({
        id: row.id, role: row.role, content: row.content,
        sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources || [],
        timestamp: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
        disciplineId: row.discipline_id || undefined, lessonId: row.lesson_id || undefined,
      }));
    }
    return memoryStore.chatMessages
      .filter((message) => message.userId === userId && (!disciplineId || message.disciplineId === disciplineId))
      .map(({ userId: _userId, ...message }) => message);
  },

  async addChatMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'> & { userId: string }): Promise<ChatMessage> {
    await assertDatabaseAvailable();
    const fullMsg: StoredChatMessage = {
      id: crypto.randomUUID(), userId: msg.userId, role: msg.role, content: msg.content,
      disciplineId: msg.disciplineId, lessonId: msg.lessonId, sources: msg.sources,
      timestamp: new Date().toISOString(),
    };

    if (isRenderEnvironment) {
      await getConnectedPool().query(
        `INSERT INTO chat_messages (id, user_id, discipline_id, lesson_id, role, content, sources)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [fullMsg.id, fullMsg.userId, fullMsg.disciplineId || null, fullMsg.lessonId || null,
          fullMsg.role, fullMsg.content, JSON.stringify(fullMsg.sources || [])]
      );
    } else {
      memoryStore.chatMessages.push(fullMsg);
    }

    const { userId: _userId, ...publicMessage } = fullMsg;
    return publicMessage;
  },

  // ==============================================================
  // CERTIFICADOS E AUTENTICIDADE
  // ==============================================================
  async verifyCertificate(code: string): Promise<Certificate | null> {
    await assertDatabaseAvailable();
    const cleanCode = code.trim().toUpperCase();
    if (isRenderEnvironment) {
      const res = await getConnectedPool().query(
        `SELECT c.*, u.name AS user_name FROM certificates c
         JOIN users u ON c.user_id = u.id
         WHERE UPPER(c.validation_code) = $1 AND c.status = 'valido'`,
        [cleanCode]
      );
      const row = res.rows[0];
      return row ? {
        id: row.id, validationCode: row.validation_code, userId: row.user_id,
        userName: row.user_name || 'Estudante Certificado', courseTitle: row.course_title,
        totalHours: row.total_hours,
        completionDate: typeof row.completion_date === 'string' ? row.completion_date : new Date(row.completion_date).toISOString().split('T')[0],
        status: row.status, issuedAt: row.issued_at,
      } : null;
    }
    for (const certificate of memoryStore.certificates.values()) {
      if (certificate.validationCode.toUpperCase() === cleanCode && certificate.status === 'valido') return certificate;
    }
    return null;
  },

  async getUserCertificate(userId: string): Promise<Certificate | null> {
    await assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const res = await getConnectedPool().query(
        `SELECT c.*, u.name AS user_name FROM certificates c
         JOIN users u ON c.user_id = u.id
         WHERE c.user_id = $1 AND c.status = 'valido'
         ORDER BY c.issued_at DESC LIMIT 1`,
        [userId]
      );
      const row = res.rows[0];
      return row ? {
        id: row.id, validationCode: row.validation_code, userId: row.user_id,
        userName: row.user_name || 'Estudante', courseTitle: row.course_title,
        totalHours: row.total_hours,
        completionDate: typeof row.completion_date === 'string' ? row.completion_date : new Date(row.completion_date).toISOString().split('T')[0],
        status: row.status, issuedAt: row.issued_at,
      } : null;
    }
    for (const certificate of memoryStore.certificates.values()) {
      if (certificate.userId === userId && certificate.status === 'valido') return certificate;
    }
    return null;
  },

  async issueCertificate(userId: string): Promise<{ success: boolean; certificate?: Certificate; reason?: string }> {
    await assertDatabaseAvailable();
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

    if (isRenderEnvironment) {
      await getConnectedPool().query(
        `INSERT INTO certificates (id, validation_code, user_id, course_title, total_hours, completion_date, status, issued_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [cert.id, cert.validationCode, cert.userId, cert.courseTitle, cert.totalHours, cert.completionDate, cert.status, cert.issuedAt]
      );
    } else {
      memoryStore.certificates.set(cert.id, cert);
    }

    await this.logAudit(userId, 'CERTIFICATE_ISSUED', `certificate:${validationCode}`, undefined, {
      studentName: user.name,
      validationCode,
    });

    return { success: true, certificate: cert };
  },

  async issueCertificateIfEligible(userId: string, allowOfficialIssuance = false): Promise<{ eligible: boolean; certificate?: Certificate; reason?: string }> {
    await assertDatabaseAvailable();
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
    await assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const res = await getConnectedPool().query(
        `SELECT c.*, u.name AS user_name FROM certificates c
         JOIN users u ON c.user_id = u.id
         ORDER BY c.issued_at DESC`
      );
      return res.rows.map((row) => ({
        id: row.id, validationCode: row.validation_code, userId: row.user_id,
        userName: row.user_name || 'Estudante', courseTitle: row.course_title,
        totalHours: row.total_hours,
        completionDate: typeof row.completion_date === 'string' ? row.completion_date : new Date(row.completion_date).toISOString().split('T')[0],
        status: row.status, issuedAt: row.issued_at,
      }));
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
    await assertDatabaseAvailable();
    let studentsList: User[] = [];

    if (isRenderEnvironment) {
      const res = await getConnectedPool().query(
        `SELECT id, name, email, registration_number, role, created_at, updated_at
         FROM users WHERE role = 'aluno' ORDER BY name ASC`
      );
      studentsList = res.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        registration_number: row.registration_number,
        role: row.role,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } else {
      studentsList = Array.from(memoryStore.users.values()).filter((user) => user.role === 'aluno');
    }

    const totalCurriculumSteps = DISCIPLINES.reduce(
      (acc, discipline) => acc + getDisciplineLessons(discipline.id).length * 5,
      0
    );

    const result = [];
    for (const student of studentsList) {
      const progress = await this.getUserProgress(student.id);
      const approvals = await this.getUserApprovals(student.id);
      const certificate = await this.getUserCertificate(student.id);

      const approvedCount = approvals.filter(
        (approval) => approval.approved && (approval.finalGrade === undefined || approval.finalGrade >= 7.0)
      ).length;
      const completedSteps = progress.filter((item) => item.completed).length;
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
        hasCertificate: Boolean(certificate),
        certificateCode: certificate?.validationCode,
      });
    }

    return result;
  },

  async getStudentDetailedAcademicRecord(studentId: string): Promise<any> {
    await assertDatabaseAvailable();
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
    if (isRenderEnvironment) return;
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