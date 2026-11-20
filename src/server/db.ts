import pg from 'pg';
import crypto from 'crypto';
import { DISCIPLINES, getDisciplineLessons } from '../db/seed-data.ts';
import { getDisciplineQuiz, ALL_FIXATION_QUIZZES } from '../db/fixation-quizzes.ts';
import { 
  User, 
  UserRole, 
  ExternalIdentity, 
  StudentProgress, 
  Certificate, 
  ChatMessage, 
  DisciplineApproval,
  VocationalSession,
  VocationalMessage,
  VocationalDiagnosis
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
const isRenderPostgres = connectionString?.includes('render.com');
const requiresSsl = Boolean(isProduction || isRenderPostgres || connectionString?.includes('sslmode=require'));

let pgPool: pg.Pool | null = null;
let isPostgresConnected = false;
let connectionError: string | null = null;

// O pool é criado no início do processo, mas a conexão é estabelecida sob demanda
// pelo próprio pg.Pool. Não dependemos de um callback assíncrono para liberar consultas.
if (isRenderEnvironment) {
  if (!connectionString || connectionString.includes('localhost:5432/lms_ia')) {
    connectionError = 'DATABASE_URL não configurada para o PostgreSQL do Render.';
    console.error(`[DB] ${connectionError}`);
  } else {
    pgPool = new pg.Pool({
      connectionString,
      ssl: requiresSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
    });

    pgPool.on('error', (error) => {
      isPostgresConnected = false;
      connectionError = error.message;
      console.error('[DB] Erro inesperado no pool PostgreSQL:', error.message);
    });

    console.log('[DB] Pool do PostgreSQL do Render inicializado. A conexão será validada nas consultas.');
  }
} else {
  console.log('[DB] Desenvolvimento local: armazenamento em memória habilitado.');
}

function assertDatabaseAvailable(): void {
  if (!isRenderEnvironment && isProduction) {
    const error: any = new Error('PostgreSQL obrigatório em produção. Configure DATABASE_URL.');
    error.status = 503;
    error.code = 'DATABASE_UNAVAILABLE';
    throw error;
  }

  if (isRenderEnvironment && (!connectionString || !pgPool)) {
    const error: any = new Error(
      'PostgreSQL do Render indisponível. Configure DATABASE_URL com a Internal Database URL.'
    );
    error.status = 503;
    error.code = 'DATABASE_UNAVAILABLE';
    throw error;
  }
}

function getPgPool(): pg.Pool {
  assertDatabaseAvailable();
  if (!pgPool) {
    const error: any = new Error('Pool PostgreSQL não inicializado.');
    error.status = 503;
    error.code = 'DATABASE_UNAVAILABLE';
    throw error;
  }
  return pgPool;
}

function httpError(message: string, status = 400): Error {
  const error: any = new Error(message);
  error.status = status;
  return error;
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

interface StoredVocationalMessage extends VocationalMessage {
  userId: string;
}

let vocationalTablesEnsured = false;

async function ensureVocationalTablesOnPostgres() {
  if (!isRenderEnvironment || !pgPool || vocationalTablesEnsured) return;
  try {
    await getPgPool().query(`
      CREATE TABLE IF NOT EXISTS vocational_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(24) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
        current_stage INTEGER NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 7),
        diagnosis_json JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_vocational_sessions_user ON vocational_sessions(user_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS vocational_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES vocational_sessions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        stage INTEGER NOT NULL DEFAULT 1,
        is_diagnosis BOOLEAN NOT NULL DEFAULT FALSE,
        diagnosis_json JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_vocational_messages_session ON vocational_messages(session_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_vocational_messages_user ON vocational_messages(user_id, created_at ASC);
    `);
    vocationalTablesEnsured = true;
  } catch (err) {
    if (isRenderEnvironment) throw err;
    console.warn('⚠️ [DB] Erro ao garantir tabelas do Orientador Vocacional no PostgreSQL:', err);
  }
}

const memoryStore = {
  users: new Map<string, User>(),
  externalIdentities: new Map<string, ExternalIdentity>(), // key: `google:${provider_id}`
  sessions: new Map<string, SessionRecord>(),
  progress: new Map<string, StudentProgress>(), // key: `${userId}:${disciplineId}:${lessonId}:${step}`
  chatMessages: [] as StoredChatMessage[],
  vocationalSessions: new Map<string, VocationalSession>(), // key: session.id
  vocationalMessages: [] as StoredVocationalMessage[],
  certificates: new Map<string, Certificate>(),
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

// ==============================================================
// REGRA ÚNICA DE APROVAÇÃO E CÁLCULO DE PROGRESSO (200h / 20x10h)
// ==============================================================
export function isDisciplineApprovalValid(a: DisciplineApproval | undefined | null): a is DisciplineApproval {
  return Boolean(
    a &&
    a.approved &&
    typeof a.finalGrade === 'number' &&
    !Number.isNaN(a.finalGrade) &&
    a.finalGrade >= 7.0
  );
}

export function computeAcademicProgressSummary(
  progressList: StudentProgress[],
  approvals: DisciplineApproval[]
) {
  let completedDisciplinesCount = 0;
  let inProgressDisciplinesCount = 0;
  let previousDisciplineApproved = false;

  const disciplines = DISCIPLINES.map((d, index) => {
    const lessons = getDisciplineLessons(d.id);
    const activeLessonIds = new Set(lessons.map((l) => l.id));
    const disciplinePossibleSteps = lessons.length * 5; // 5 etapas por aula

    // Deduplica etapas concluídas apenas das aulas ativas (Etapas 1 a 5)
    const completedStepKeys = new Set<string>();
    for (const p of progressList) {
      if (
        p.disciplineId === d.id &&
        p.completed &&
        activeLessonIds.has(p.lessonId) &&
        p.stepNumber >= 1 &&
        p.stepNumber <= 5
      ) {
        completedStepKeys.add(`${p.lessonId}:${p.stepNumber}`);
      }
    }

    const completedStepsCount = completedStepKeys.size;
    const percent =
      disciplinePossibleSteps > 0
        ? Math.min(100, Math.round((completedStepsCount / disciplinePossibleSteps) * 100))
        : 0;

    // Critério único de aprovação: registro válido em discipline_approvals com nota >= 7,0 (oriunda da Etapa 4)
    const approval = approvals.find((a) => a.disciplineId === d.id && isDisciplineApprovalValid(a));
    const isApproved = Boolean(approval);

    let status: 'bloqueado' | 'em_andamento' | 'concluido' = 'bloqueado';
    if (isApproved) {
      status = 'concluido';
      completedDisciplinesCount++;
    } else if (index === 0 || previousDisciplineApproved || completedStepsCount > 0) {
      status = 'em_andamento';
      inProgressDisciplinesCount++;
    }

    previousDisciplineApproved = isApproved;

    const allLessonsCompleted =
      lessons.length > 0 &&
      lessons.every((l) => completedStepKeys.has(`${l.id}:5`));

    return {
      disciplineId: d.id,
      code: d.code,
      title: d.title,
      moduleId: d.moduleId,
      hours: d.hours,
      status,
      percent,
      completedStepsCount,
      totalStepsCount: disciplinePossibleSteps,
      totalLessons: lessons.length,
      allLessonsCompleted,
      approved: isApproved,
      finalExamApproved: isApproved,
      finalGrade: approval ? approval.finalGrade : undefined,
    };
  });

  // Cálculo sincronizado com a carga horária de 10h por disciplina (200h totais)
  // Horas concluídas contabilizam exclusivamente disciplinas formalmente aprovadas em discipline_approvals
  const totalHoursItemized = DISCIPLINES.reduce((sum, d) => sum + d.hours, 0);
  const hoursCompletedExact = disciplines.reduce((sum, d) => {
    return d.approved ? sum + d.hours : sum;
  }, 0);

  const hoursCompleted = Math.min(totalHoursItemized, Math.round(hoursCompletedExact));
  const overallPercent = Math.min(100, Math.round((hoursCompleted / (totalHoursItemized || 200)) * 100));

  const activeDiscipline =
    disciplines.find((dp) => dp.status === 'em_andamento') ||
    disciplines[disciplines.length - 1] ||
    disciplines[0];

  return {
    overallPercent,
    totalHoursItemized,
    targetHoursOfficial: totalHoursItemized,
    hoursCompleted,
    completedDisciplinesCount,
    inProgressDisciplinesCount,
    totalDisciplinesCount: DISCIPLINES.length,
    nextToResume: {
      disciplineId: activeDiscipline.disciplineId,
      disciplineTitle: activeDiscipline.title,
    },
    disciplines,
  };
}

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
        await getPgPool().query('SELECT 1');
        latencyMs = Date.now() - start;
        pgStatus = 'connected';
        isPostgresConnected = true;
      } catch (err: any) {
        pgStatus = 'error';
        isPostgresConnected = false;
        connectionError = err.message;
      }
    }

    const isHealthy = pgStatus === 'connected';
    const providerName = 'Render PostgreSQL';

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
    if (isRenderEnvironment) {
      try {
        const res = await getPgPool().query('SELECT * FROM users WHERE id = $1', [id]);
        return res.rows[0] || null;
      } catch (err) {
        if (isRenderEnvironment) throw err;
      }
    }
    return memoryStore.users.get(id) || null;
  },

  async findUserByEmail(email: string): Promise<User | null> {
    assertDatabaseAvailable();
    const cleanEmail = email.trim().toLowerCase();
    if (isRenderEnvironment) {
      try {
        const res = await getPgPool().query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
        return res.rows[0] || null;
      } catch (err) {
        if (isRenderEnvironment) throw err;
      }
    }
    for (const u of memoryStore.users.values()) {
      if (u.email.toLowerCase() === cleanEmail) return u;
    }
    return null;
  },

  async findUserByGoogleSub(googleSub: string): Promise<User | null> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      try {
        const res = await getPgPool().query(
          `SELECT u.* FROM users u
           JOIN external_identities e ON u.id = e.user_id
           WHERE e.provider = 'google' AND e.provider_id = $1`,
          [googleSub]
        );
        return res.rows[0] || null;
      } catch (err) {
        if (isRenderEnvironment) throw err;
      }
    }
    const ext = memoryStore.externalIdentities.get(`google:${googleSub}`);
    if (ext) {
      return memoryStore.users.get(ext.user_id) || null;
    }
    return null;
  },

  async upsertGoogleUser(profile: {
    googleSub: string; email: string; name: string; picture?: string;
  }): Promise<User> {
    assertDatabaseAvailable();
    if (!profile.googleSub || !profile.email) throw httpError('Perfil Google inválido.', 400);

    const email = profile.email.trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || 'josel6449@gmail.com').trim().toLowerCase();
    const isAdmin = email === adminEmail;
    const role: UserRole = isAdmin ? 'administrador' : 'aluno';

    if (isRenderEnvironment) {
      const client = await getPgPool().connect();
      try {
        await client.query('BEGIN');

        const bySub = await client.query(
          `SELECT u.* FROM users u
           JOIN external_identities e ON e.user_id = u.id
           WHERE e.provider = 'google' AND e.provider_id = $1
           LIMIT 1 FOR UPDATE OF u`,
          [profile.googleSub]
        );

        let user: any = bySub.rows[0];

        if (user) {
          const updated = await client.query(
            `UPDATE users
             SET name = COALESCE(NULLIF($2, ''), name),
                 avatar_url = COALESCE($3, avatar_url),
                 role = CASE WHEN $4 THEN 'administrador' ELSE role END,
                 updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [user.id, profile.name || '', profile.picture || null, isAdmin]
          );
          user = updated.rows[0];
          await client.query(
            `UPDATE external_identities SET email = $2
             WHERE provider = 'google' AND provider_id = $1`,
            [profile.googleSub, email]
          );
        } else {
          const byEmail = await client.query(
            'SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1 FOR UPDATE', [email]
          );
          user = byEmail.rows[0];

          if (user) {
            const updated = await client.query(
              `UPDATE users
               SET name = COALESCE(NULLIF($2, ''), name),
                   avatar_url = COALESCE($3, avatar_url),
                   role = CASE WHEN $4 THEN 'administrador' ELSE role END,
                   updated_at = NOW()
               WHERE id = $1 RETURNING *`,
              [user.id, profile.name || '', profile.picture || null, isAdmin]
            );
            user = updated.rows[0];
          } else {
            const registrationNumber =
              `IF-IA-${new Date().getFullYear()}-${crypto.randomInt(1000, 10000)}`;
            const inserted = await client.query(
              `INSERT INTO users (email, name, avatar_url, role, registration_number)
               VALUES ($1, $2, $3, $4, $5) RETURNING *`,
              [email, profile.name || email, profile.picture || null, role, registrationNumber]
            );
            user = inserted.rows[0];
          }

          await client.query(
            `INSERT INTO external_identities (user_id, provider, provider_id, email)
             VALUES ($1, 'google', $2, $3)
             ON CONFLICT (provider, provider_id) DO NOTHING`,
            [user.id, profile.googleSub, email]
          );

          const linked = await client.query(
            `SELECT user_id FROM external_identities
             WHERE provider = 'google' AND provider_id = $1`,
            [profile.googleSub]
          );
          if (!linked.rows[0] || linked.rows[0].user_id !== user.id) {
            throw httpError('A identidade Google já está vinculada a outra conta.', 409);
          }
        }

        await client.query('COMMIT');
        return user as User;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    const existing = await this.findUserByGoogleSub(profile.googleSub);
    if (existing) {
      existing.name = profile.name || existing.name;
      existing.avatar_url = profile.picture || existing.avatar_url;
      existing.updated_at = new Date().toISOString();
      if (isAdmin) existing.role = 'administrador';
      return existing;
    }

    let user = await this.findUserByEmail(email);
    if (!user) {
      user = {
        id: crypto.randomUUID(), email, name: profile.name || email,
        avatar_url: profile.picture, role,
        registration_number: `IF-IA-${new Date().getFullYear()}-${crypto.randomInt(1000, 10000)}`,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      } as User;
      memoryStore.users.set(user.id, user);
    } else if (isAdmin) {
      user.role = 'administrador';
    }

    const identity: ExternalIdentity = {
      id: crypto.randomUUID(), user_id: user.id, provider: 'google',
      provider_id: profile.googleSub, email,
      created_at: new Date().toISOString(),
    };
    memoryStore.externalIdentities.set(`google:${profile.googleSub}`, identity);
    return user;
  },

  async createSession(userId: string, ip?: string, userAgent?: string): Promise<string> {
    assertDatabaseAvailable();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (isRenderEnvironment) {
      await getPgPool().query(
        `INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [token, userId, expiresAt, ip || null, userAgent || null]
      );
    } else {
      memoryStore.sessions.set(token, {
        id: token, userId, expiresAt, ipAddress: ip, userAgent,
      });
    }
    return token;
  },

  async getSession(token: string): Promise<User | null> {
    assertDatabaseAvailable();
    if (!token) return null;
    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT u.* FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.expires_at > NOW() LIMIT 1`,
        [token]
      );
      if (result.rows[0]) return result.rows[0] as User;
      await getPgPool().query(
        'DELETE FROM sessions WHERE id = $1 AND expires_at <= NOW()', [token]
      );
      return null;
    }
    const session = memoryStore.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      memoryStore.sessions.delete(token);
      return null;
    }
    return this.findUserById(session.userId);
  },

  async deleteSession(token: string): Promise<void> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      await getPgPool().query('DELETE FROM sessions WHERE id = $1', [token]);
    } else {
      memoryStore.sessions.delete(token);
    }
  },

  async getUserProgress(userId: string): Promise<StudentProgress[]> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      try {
        const res = await getPgPool().query(
          `SELECT user_id, discipline_id, lesson_id, step_number, completed, quiz_score, completed_at
           FROM student_progress WHERE user_id = $1`,
          [userId]
        );
        return res.rows.map((r) => ({
          userId: r.user_id,
          disciplineId: r.discipline_id,
          lessonId: r.lesson_id,
          stepNumber: Number(r.step_number),
          completed: Boolean(r.completed),
          completedAt: typeof r.completed_at === 'string' ? r.completed_at : new Date(r.completed_at).toISOString(),
          quizScore: r.quiz_score != null ? Number(r.quiz_score) : undefined,
        }));
      } catch (err) {
        if (isRenderEnvironment) throw err;
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

  async getLessonStepProgress(
    userId: string,
    disciplineId: string,
    lessonId: string,
    stepNumber: number
  ): Promise<StudentProgress | null> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      try {
        const res = await getPgPool().query(
          `SELECT user_id, discipline_id, lesson_id, step_number, completed, quiz_score, completed_at
           FROM student_progress
           WHERE user_id = $1 AND discipline_id = $2 AND lesson_id = $3 AND step_number = $4
           LIMIT 1`,
          [userId, disciplineId, lessonId, stepNumber]
        );
        if (res.rows[0]) {
          const r = res.rows[0];
          return {
            userId: r.user_id,
            disciplineId: r.discipline_id,
            lessonId: r.lesson_id,
            stepNumber: Number(r.step_number),
            completed: Boolean(r.completed),
            completedAt: typeof r.completed_at === 'string' ? r.completed_at : new Date(r.completed_at).toISOString(),
            quizScore: r.quiz_score != null ? Number(r.quiz_score) : undefined,
          };
        }
        return null;
      } catch (err) {
        if (isRenderEnvironment) throw err;
        console.warn('⚠️ [DB] Erro ao consultar etapa em student_progress do PostgreSQL:', err);
      }
    }
    return memoryStore.progress.get(`${userId}:${disciplineId}:${lessonId}:${stepNumber}`) || null;
  },

  async completeStep(
    userId: string,
    disciplineId: string,
    lessonId: string,
    stepNumber: number,
    quizScore?: number
  ): Promise<{ success: boolean; message: string; unlockedNextStep: number | null; approved?: boolean; finalGrade?: number }> {
    assertDatabaseAvailable();

    // Validação 1: O passo deve ser entre 1 e 5 e pertencer à matriz curricular
    if (stepNumber < 1 || stepNumber > 5) {
      return { success: false, message: 'Passo inválido (deve ser entre 1 e 5).', unlockedNextStep: null };
    }

    const lessons = getDisciplineLessons(disciplineId);
    if (lessons.length === 0 || !lessons.some((l) => l.id === lessonId)) {
      return { success: false, message: 'Disciplina ou aula não localizada na matriz curricular.', unlockedNextStep: null };
    }

    // Validação 2: Se não for o passo 1, o passo anterior (stepNumber - 1) PRECISA estar concluído!
    if (stepNumber > 1) {
      const prevStep = await this.getLessonStepProgress(userId, disciplineId, lessonId, stepNumber - 1);
      if (!prevStep || !prevStep.completed) {
        return {
          success: false,
          message: `Desbloqueio não autorizado: você precisa concluir a etapa anterior (Etapa ${stepNumber - 1}) primeiro.`,
          unlockedNextStep: null,
        };
      }
    }

    // Validação 3: Se o passo for o Teste de Fixação (Etapa 4), a nota precisa ser >= 7.0
    if (stepNumber === 4 && (quizScore === undefined || Number.isNaN(quizScore) || quizScore < 7.0)) {
      return {
        success: false,
        message: `Aprovação não concedida: nota obtida (${quizScore?.toFixed(1) || '0.0'}) é inferior ao mínimo exigido de 7.0.`,
        unlockedNextStep: null,
      };
    }

    // Validação 4: Na Etapa 5, exigir aprovação prévia na Etapa 4 com nota válida (>= 7.0) sem inventar nota
    let validatedStep4Grade: number | undefined;
    if (stepNumber === 5) {
      const step4Record = await this.getLessonStepProgress(userId, disciplineId, lessonId, 4);
      if (
        !step4Record ||
        !step4Record.completed ||
        typeof step4Record.quizScore !== 'number' ||
        Number.isNaN(step4Record.quizScore) ||
        step4Record.quizScore < 7.0
      ) {
        return {
          success: false,
          message: 'Aprovação na Etapa 4 (Teste de Fixação com nota mínima 7,0) é obrigatória antes de concluir a Etapa 5.',
          unlockedNextStep: null,
        };
      }
      validatedStep4Grade = step4Record.quizScore;
    }

    // Salva a etapa de forma idempotente (PostgreSQL no Render + memória)
    const progressKey = `${userId}:${disciplineId}:${lessonId}:${stepNumber}`;
    const progressRecord: StudentProgress = {
      userId,
      disciplineId,
      lessonId,
      stepNumber,
      completed: true,
      completedAt: new Date().toISOString(),
      quizScore: stepNumber === 4 ? quizScore : undefined,
    };

    if (isRenderEnvironment) {
      await getPgPool().query(
        `INSERT INTO student_progress (user_id, discipline_id, lesson_id, step_number, completed, quiz_score, completed_at)
         VALUES ($1, $2, $3, $4, true, $5, NOW())
         ON CONFLICT (user_id, discipline_id, lesson_id, step_number)
         DO UPDATE SET completed = true, quiz_score = EXCLUDED.quiz_score, completed_at = NOW()`,
        [userId, disciplineId, lessonId, stepNumber, stepNumber === 4 && quizScore != null ? quizScore : null]
      );
    }

    memoryStore.progress.set(progressKey, progressRecord);

    const unlockedNext = stepNumber < 5 ? stepNumber + 1 : null;

    // Etapa 5: após validação da Etapa 4 e conclusão de todas as aulas da disciplina,
    // registra ou atualiza a aprovação única em discipline_approvals com a nota real da Etapa 4.
    if (stepNumber === 5 && validatedStep4Grade !== undefined) {
      const lessonGrades: number[] = [];
      let allDisciplineLessonsDone = true;

      for (const l of lessons) {
        if (l.id === lessonId) {
          lessonGrades.push(validatedStep4Grade);
        } else {
          const otherStep5 = await this.getLessonStepProgress(userId, disciplineId, l.id, 5);
          const otherStep4 = await this.getLessonStepProgress(userId, disciplineId, l.id, 4);
          if (
            !otherStep5 ||
            !otherStep5.completed ||
            !otherStep4 ||
            !otherStep4.completed ||
            typeof otherStep4.quizScore !== 'number' ||
            Number.isNaN(otherStep4.quizScore) ||
            otherStep4.quizScore < 7.0
          ) {
            allDisciplineLessonsDone = false;
            break;
          }
          lessonGrades.push(otherStep4.quizScore);
        }
      }

      if (allDisciplineLessonsDone && lessonGrades.length > 0) {
        const finalGrade = Number(
          (lessonGrades.reduce((sum, g) => sum + g, 0) / lessonGrades.length).toFixed(1)
        );

        const approvalRecord: DisciplineApproval = {
          userId,
          disciplineId,
          approved: true,
          finalGrade,
          approvedAt: new Date().toISOString(),
        };

        if (isRenderEnvironment) {
          await getPgPool().query(
            `INSERT INTO discipline_approvals (user_id, discipline_id, approved, final_grade, approved_at)
             VALUES ($1, $2, true, $3, NOW())
             ON CONFLICT (user_id, discipline_id)
             DO UPDATE SET approved = true, final_grade = EXCLUDED.final_grade, approved_at = NOW()`,
            [userId, disciplineId, finalGrade]
          );
        }

        memoryStore.disciplineApprovals.set(`${userId}:${disciplineId}`, approvalRecord);

        await this.logAudit(userId, 'APPROVE_DISCIPLINE', 'academic', undefined, {
          disciplineId,
          finalGrade,
        });

        return {
          success: true,
          message: `Disciplina concluída com sucesso! Aprovação registrada com nota ${finalGrade.toFixed(1)}/10,0.`,
          unlockedNextStep: null,
          approved: true,
          finalGrade,
        };
      }

      return {
        success: true,
        message: 'Aula concluída com sucesso!',
        unlockedNextStep: null,
      };
    }

    return {
      success: true,
      message: `Etapa ${stepNumber} validada e concluída.`,
      unlockedNextStep: unlockedNext,
    };
  },

  // ==============================================================
  // AVALIAÇÕES DE FIXAÇÃO POR AULA (CORREÇÃO NO SERVIDOR)
  // Critério único de aprovação da disciplina: nota >= 7.0 na Etapa 4
  // ==============================================================
  async gradeQuiz(
    userId: string,
    disciplineId: string,
    lessonId: string,
    answers: number[]
  ): Promise<{ score: number; passed: boolean; explanation: string }> {
    assertDatabaseAvailable();

    if (!Array.isArray(answers) || answers.length !== 3 ||
        answers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 2)) {
      const error: any = new Error('O Teste de Fixação exige exatamente 3 respostas válidas.');
      error.status = 400;
      throw error;
    }

    // Validação prévia obrigatória: disciplina/aula válidas e Etapa 3 concluída antes de realizar a Etapa 4
    const lessons = getDisciplineLessons(disciplineId);
    if (lessons.length === 0 || !lessons.some((l) => l.id === lessonId)) {
      const error: any = new Error('Disciplina ou aula não localizada na matriz curricular.');
      error.status = 400;
      throw error;
    }

    const step3 = await this.getLessonStepProgress(userId, disciplineId, lessonId, 3);
    if (!step3 || !step3.completed) {
      const error: any = new Error('Desbloqueio não autorizado: você precisa concluir a etapa anterior (Etapa 3) primeiro.');
      error.status = 403;
      throw error;
    }

    const quiz = getDisciplineQuiz(disciplineId) || getDisciplineQuiz(lessonId);
    const official = quiz
      ? { answers: quiz.correctAnswers, explanation: quiz.explanation }
      : (QUIZ_ANSWERS_SERVER[lessonId] || QUIZ_ANSWERS_SERVER[disciplineId]);
    if (!official || !Array.isArray(official.answers) || official.answers.length !== 3) {
      const error: any = new Error('Gabarito oficial do Teste de Fixação não encontrado ou inválido.');
      error.status = 500;
      throw error;
    }

    let correctCount = 0;
    official.answers.forEach((ans, idx) => {
      if (answers[idx] === ans) correctCount++;
    });

    const score = Number(((correctCount / official.answers.length) * 10).toFixed(1));
    const passed = score >= 7.0;

    if (passed) {
      const stepResult = await this.completeStep(userId, disciplineId, lessonId, 4, score);
      if (!stepResult.success) {
        const error: any = new Error(stepResult.message);
        error.status = 403;
        throw error;
      }
    } else {
      // Registra tentativa reprovada mantendo completed = false se a Etapa 4 ainda não foi aprovada
      const existingStep4 = await this.getLessonStepProgress(userId, disciplineId, lessonId, 4);
      if (!existingStep4 || !existingStep4.completed) {
        const progressKey = `${userId}:${disciplineId}:${lessonId}:4`;
        if (isRenderEnvironment) {
          await getPgPool().query(
            `INSERT INTO student_progress (user_id, discipline_id, lesson_id, step_number, completed, quiz_score, completed_at)
             VALUES ($1, $2, $3, 4, false, $4, NOW())
             ON CONFLICT (user_id, discipline_id, lesson_id, step_number)
             DO UPDATE SET completed = false, quiz_score = EXCLUDED.quiz_score, completed_at = NOW()`,
            [userId, disciplineId, lessonId, score]
          );
        }
        memoryStore.progress.set(progressKey, {
          userId,
          disciplineId,
          lessonId,
          stepNumber: 4,
          completed: false,
          completedAt: new Date().toISOString(),
          quizScore: score,
        });
      }
    }

    return {
      score,
      passed,
      explanation: official.explanation,
    };
  },

  async getDisciplineApproval(userId: string, disciplineId: string): Promise<DisciplineApproval | null> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      try {
        const res = await getPgPool().query(
          `SELECT user_id, discipline_id, approved, final_grade, approved_at
           FROM discipline_approvals WHERE user_id = $1 AND discipline_id = $2`,
          [userId, disciplineId]
        );
        if (res.rows[0]) {
          const row = res.rows[0];
          return {
            userId: row.user_id,
            disciplineId: row.discipline_id,
            approved: Boolean(row.approved),
            finalGrade: Number(row.final_grade),
            approvedAt: typeof row.approved_at === 'string' ? row.approved_at : new Date(row.approved_at).toISOString(),
          };
        }
        return null;
      } catch (err) {
        if (isRenderEnvironment) throw err;
        console.warn('⚠️ [DB] Erro ao consultar discipline_approvals do PostgreSQL:', err);
      }
    }
    return memoryStore.disciplineApprovals.get(`${userId}:${disciplineId}`) || null;
  },

  async getUserApprovals(userId: string): Promise<DisciplineApproval[]> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      try {
        const res = await getPgPool().query(
          `SELECT user_id, discipline_id, approved, final_grade, approved_at
           FROM discipline_approvals WHERE user_id = $1`,
          [userId]
        );
        return res.rows.map((row) => ({
          userId: row.user_id,
          disciplineId: row.discipline_id,
          approved: Boolean(row.approved),
          finalGrade: Number(row.final_grade),
          approvedAt: typeof row.approved_at === 'string' ? row.approved_at : new Date(row.approved_at).toISOString(),
        }));
      } catch (err) {
        if (isRenderEnvironment) throw err;
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
    if (isRenderEnvironment) {
      try {
        let query = 'SELECT * FROM chat_messages WHERE user_id = $1';
        const params: any[] = [userId];
        if (disciplineId) {
          query += ' AND discipline_id = $2';
          params.push(disciplineId);
        }
        query += ' ORDER BY created_at ASC';
        const res = await getPgPool().query(query, params);
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
        if (isRenderEnvironment) throw err;
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

    if (isRenderEnvironment) {
      try {
        await getPgPool().query(
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
      } catch (err) {
        if (isRenderEnvironment) throw err;
      }
    }

    return fullMsg;
  },

  // ==============================================================
  // CERTIFICADOS E AUTENTICIDADE
  // ==============================================================
  async verifyCertificate(code: string): Promise<Certificate | null> {
    assertDatabaseAvailable();
    const cleanCode = code.trim().toUpperCase();

    if (isRenderEnvironment) {
      try {
        const res = await getPgPool().query(
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
        if (isRenderEnvironment) throw err;
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
    if (isRenderEnvironment) {
      try {
        const res = await getPgPool().query(
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
        if (isRenderEnvironment) throw err;
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
    const validDisciplineIds = new Set(DISCIPLINES.map((d) => d.id));
    const approvedCount = new Set(
      approvals
        .filter((a) => validDisciplineIds.has(a.disciplineId) && isDisciplineApprovalValid(a))
        .map((a) => a.disciplineId)
    ).size;

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
      try {
        await getPgPool().query(
          `INSERT INTO certificates (id, validation_code, user_id, course_title, total_hours, completion_date, status, issued_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [cert.id, cert.validationCode, cert.userId, cert.courseTitle, cert.totalHours, cert.completionDate, cert.status, cert.issuedAt]
        );
      } catch (err) {
        if (isRenderEnvironment) throw err;
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
    const validDisciplineIds = new Set(DISCIPLINES.map((d) => d.id));
    const approvedCount = new Set(
      approvals
        .filter((a) => validDisciplineIds.has(a.disciplineId) && isDisciplineApprovalValid(a))
        .map((a) => a.disciplineId)
    ).size;

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
    if (isRenderEnvironment) {
      try {
        const res = await getPgPool().query(
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
        if (isRenderEnvironment) throw err;
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

    if (isRenderEnvironment) {
      try {
        const res = await getPgPool().query(
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
        if (isRenderEnvironment) throw err;
        console.warn('⚠️ [DB] Erro ao consultar estudantes no PostgreSQL:', err);
      }
    }

    if (studentsList.length === 0) {
      studentsList = Array.from(memoryStore.users.values()).filter((u) => u.role === 'aluno');
    }

    const result = [];
    for (const student of studentsList) {
      const progress = await this.getUserProgress(student.id);
      const approvals = await this.getUserApprovals(student.id);
      const cert = await this.getUserCertificate(student.id);
      const summary = computeAcademicProgressSummary(progress, approvals);

      result.push({
        id: student.id,
        name: student.name,
        email: student.email,
        registrationNumber: student.registration_number,
        role: student.role,
        createdAt: student.created_at,
        completedDisciplinesCount: summary.completedDisciplinesCount,
        overallPercent: summary.overallPercent,
        hoursCompleted: summary.hoursCompleted,
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
    const summary = computeAcademicProgressSummary(progress, approvals);

    const disciplinesProgress = summary.disciplines.map((d) => ({
      disciplineId: d.disciplineId,
      code: d.code,
      title: d.title,
      moduleId: d.moduleId,
      hours: d.hours,
      approved: d.approved,
      finalGrade: d.finalGrade !== undefined ? d.finalGrade : null,
      completedSteps: d.completedStepsCount,
      totalSteps: d.totalStepsCount,
      percent: d.percent,
    }));

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
      approvedDisciplinesCount: summary.completedDisciplinesCount,
      totalDisciplinesCount: summary.totalDisciplinesCount,
      hoursCompleted: summary.hoursCompleted,
      overallPercent: summary.overallPercent,
      certificate,
    };
  },

  // ==============================================================
  // ORIENTADOR VOCACIONAL IA - HISTÓRICO ISOLADO DO TUTOR IA E POR ALUNO
  // ==============================================================
  async getLatestVocationalSession(
    userId: string
  ): Promise<{ session: VocationalSession; messages: VocationalMessage[] } | null> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      try {
        await ensureVocationalTablesOnPostgres();
        const sessionRes = await getPgPool().query(
          `SELECT id, user_id, status, current_stage, diagnosis_json, created_at, updated_at
           FROM vocational_sessions
           WHERE user_id = $1
           ORDER BY updated_at DESC, created_at DESC
           LIMIT 1`,
          [userId]
        );
        if (sessionRes.rows[0]) {
          const row = sessionRes.rows[0];
          const session: VocationalSession = {
            id: row.id,
            userId: row.user_id,
            status: row.status,
            currentStage: Number(row.current_stage),
            diagnosis: row.diagnosis_json || null,
            createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
            updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(row.updated_at).toISOString(),
          };
          const msgRes = await getPgPool().query(
            `SELECT id, session_id, role, content, stage, is_diagnosis, diagnosis_json, created_at
             FROM vocational_messages
             WHERE session_id = $1 AND user_id = $2
             ORDER BY created_at ASC`,
            [session.id, userId]
          );
          const messages: VocationalMessage[] = msgRes.rows.map((m) => ({
            id: m.id,
            sessionId: m.session_id,
            role: m.role,
            content: m.content,
            stage: Number(m.stage),
            isDiagnosis: Boolean(m.is_diagnosis),
            diagnosis: m.diagnosis_json || null,
            timestamp: typeof m.created_at === 'string' ? m.created_at : new Date(m.created_at).toISOString(),
          }));
          return { session, messages };
        }
      } catch (err) {
        if (isRenderEnvironment) throw err;
        console.warn('⚠️ [DB] Erro ao consultar sessão vocacional no PostgreSQL:', err);
      }
    }

    const userSessions = Array.from(memoryStore.vocationalSessions.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    if (userSessions.length === 0) return null;
    const latest = userSessions[0];
    const messages = memoryStore.vocationalMessages
      .filter((m) => m.sessionId === latest.id && m.userId === userId)
      .map(({ userId: _uid, ...msg }) => msg);
    return { session: latest, messages };
  },

  async getVocationalSessionById(
    sessionId: string,
    userId: string
  ): Promise<{ session: VocationalSession; messages: VocationalMessage[] } | null> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      try {
        await ensureVocationalTablesOnPostgres();
        const sessionRes = await getPgPool().query(
          `SELECT id, user_id, status, current_stage, diagnosis_json, created_at, updated_at
           FROM vocational_sessions
           WHERE id = $1 AND user_id = $2
           LIMIT 1`,
          [sessionId, userId]
        );
        if (sessionRes.rows[0]) {
          const row = sessionRes.rows[0];
          const session: VocationalSession = {
            id: row.id,
            userId: row.user_id,
            status: row.status,
            currentStage: Number(row.current_stage),
            diagnosis: row.diagnosis_json || null,
            createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
            updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(row.updated_at).toISOString(),
          };
          const msgRes = await getPgPool().query(
            `SELECT id, session_id, role, content, stage, is_diagnosis, diagnosis_json, created_at
             FROM vocational_messages
             WHERE session_id = $1 AND user_id = $2
             ORDER BY created_at ASC`,
            [session.id, userId]
          );
          const messages: VocationalMessage[] = msgRes.rows.map((m) => ({
            id: m.id,
            sessionId: m.session_id,
            role: m.role,
            content: m.content,
            stage: Number(m.stage),
            isDiagnosis: Boolean(m.is_diagnosis),
            diagnosis: m.diagnosis_json || null,
            timestamp: typeof m.created_at === 'string' ? m.created_at : new Date(m.created_at).toISOString(),
          }));
          return { session, messages };
        }
        return null;
      } catch (err) {
        if (isRenderEnvironment) throw err;
        console.warn('⚠️ [DB] Erro ao consultar sessão vocacional por ID no PostgreSQL:', err);
      }
    }

    const session = memoryStore.vocationalSessions.get(sessionId);
    if (!session || session.userId !== userId) return null;
    const messages = memoryStore.vocationalMessages
      .filter((m) => m.sessionId === session.id && m.userId === userId)
      .map(({ userId: _uid, ...msg }) => msg);
    return { session, messages };
  },

  async createVocationalSession(
    userId: string,
    initialGreeting: string
  ): Promise<{ session: VocationalSession; messages: VocationalMessage[] }> {
    assertDatabaseAvailable();
    const now = new Date().toISOString();
    const session: VocationalSession = {
      id: crypto.randomUUID(),
      userId,
      status: 'in_progress',
      currentStage: 1,
      diagnosis: null,
      createdAt: now,
      updatedAt: now,
    };

    const greetingMsg: StoredVocationalMessage = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      userId,
      role: 'assistant',
      content: initialGreeting,
      stage: 1,
      isDiagnosis: false,
      diagnosis: null,
      timestamp: now,
    };

    if (isRenderEnvironment) {
      try {
        await ensureVocationalTablesOnPostgres();
        await getPgPool().query(
          `INSERT INTO vocational_sessions (id, user_id, status, current_stage, diagnosis_json, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NULL, $5, $5)`,
          [session.id, userId, session.status, session.currentStage, now]
        );
        await getPgPool().query(
          `INSERT INTO vocational_messages (id, session_id, user_id, role, content, stage, is_diagnosis, diagnosis_json, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, false, NULL, $7)`,
          [greetingMsg.id, session.id, userId, greetingMsg.role, greetingMsg.content, greetingMsg.stage, now]
        );
      } catch (err) {
        if (isRenderEnvironment) throw err;
        console.warn('⚠️ [DB] Erro ao criar sessão vocacional no PostgreSQL:', err);
      }
    }

    memoryStore.vocationalSessions.set(session.id, session);
    memoryStore.vocationalMessages.push(greetingMsg);

    const { userId: _uid, ...publicGreeting } = greetingMsg;
    return { session, messages: [publicGreeting] };
  },

  async addVocationalMessage(params: {
    sessionId: string;
    userId: string;
    role: 'user' | 'assistant';
    content: string;
    stage: number;
    isDiagnosis?: boolean;
    diagnosis?: VocationalDiagnosis | null;
  }): Promise<VocationalMessage> {
    assertDatabaseAvailable();
    const now = new Date().toISOString();
    const msg: StoredVocationalMessage = {
      id: crypto.randomUUID(),
      sessionId: params.sessionId,
      userId: params.userId,
      role: params.role,
      content: params.content,
      stage: params.stage,
      isDiagnosis: Boolean(params.isDiagnosis),
      diagnosis: params.diagnosis || null,
      timestamp: now,
    };

    if (isRenderEnvironment) {
      try {
        await ensureVocationalTablesOnPostgres();
        await getPgPool().query(
          `INSERT INTO vocational_messages (id, session_id, user_id, role, content, stage, is_diagnosis, diagnosis_json, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            msg.id,
            msg.sessionId,
            msg.userId,
            msg.role,
            msg.content,
            msg.stage,
            msg.isDiagnosis,
            msg.diagnosis ? JSON.stringify(msg.diagnosis) : null,
            now,
          ]
        );
        await getPgPool().query(
          `UPDATE vocational_sessions SET current_stage = $1, updated_at = $2 WHERE id = $3 AND user_id = $4`,
          [params.stage, now, params.sessionId, params.userId]
        );
      } catch (err) {
        if (isRenderEnvironment) throw err;
        console.warn('⚠️ [DB] Erro ao salvar mensagem vocacional no PostgreSQL:', err);
      }
    }

    memoryStore.vocationalMessages.push(msg);
    const existingSession = memoryStore.vocationalSessions.get(params.sessionId);
    if (existingSession && existingSession.userId === params.userId) {
      existingSession.currentStage = params.stage;
      existingSession.updatedAt = now;
    }

    const { userId: _uid, ...publicMsg } = msg;
    return publicMsg;
  },

  async completeVocationalSession(
    sessionId: string,
    userId: string,
    diagnosis: VocationalDiagnosis
  ): Promise<VocationalSession | null> {
    assertDatabaseAvailable();
    const now = new Date().toISOString();

    if (isRenderEnvironment) {
      try {
        await ensureVocationalTablesOnPostgres();
        const updated = await getPgPool().query(
          `UPDATE vocational_sessions
           SET status = 'completed', current_stage = 7, diagnosis_json = $1, updated_at = $2
           WHERE id = $3 AND user_id = $4
           RETURNING id, user_id, status, current_stage, diagnosis_json, created_at, updated_at`,
          [JSON.stringify(diagnosis), now, sessionId, userId]
        );
        if (!updated.rows[0]) return null;
        const row = updated.rows[0];
        return {
          id: row.id,
          userId: row.user_id,
          status: row.status,
          currentStage: Number(row.current_stage),
          diagnosis: row.diagnosis_json || null,
          createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
          updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(row.updated_at).toISOString(),
        } as VocationalSession;
      } catch (err) {
        if (isRenderEnvironment) throw err;
        console.warn('⚠️ [DB] Erro ao concluir sessão vocacional no PostgreSQL:', err);
      }
    }

    const session = memoryStore.vocationalSessions.get(sessionId);
    if (session && session.userId === userId) {
      session.status = 'completed';
      session.currentStage = 7;
      session.diagnosis = diagnosis;
      session.updatedAt = now;
      return session;
    }
    return null;
  },

  async logAudit(
    userId: string | undefined,
    action: string,
    resource: string,
    ip?: string,
    details?: any
  ) {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      await getPgPool().query(
        `INSERT INTO audit_logs (user_id, action, resource, ip_address, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId || null, action, resource, ip || null,
          details == null ? null : JSON.stringify(details)]
      );
      return;
    }
    memoryStore.auditLogs.push({
      id: crypto.randomUUID(), userId, action, resource, ip, details,
      timestamp: new Date().toISOString(),
    });
  },
};