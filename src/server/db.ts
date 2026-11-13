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

// Detecção do ambiente de execução Render.com.
const isRenderEnvironment = Boolean(
  process.env.RENDER === 'true' ||
  Boolean(process.env.RENDER_SERVICE_ID) ||
  process.env.IS_RENDER === 'true' ||
  process.env.FORCE_DB_CONNECT === 'true'
);

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';
const requiresSsl = Boolean(
  isProduction ||
  connectionString?.includes('render.com') ||
  connectionString?.includes('sslmode=require')
);

const REQUIRED_TABLES = [
  'users',
  'external_identities',
  'sessions',
  'disciplines',
  'lessons',
  'student_progress',
  'quizzes',
  'quiz_questions',
  'quiz_attempts',
  'certificates',
  'chat_messages',
  'audit_logs',
  'discipline_approvals',
] as const;

let pgPool: pg.Pool | null = null;
let connectionError: string | null = null;

// O PostgreSQL é inicializado exclusivamente no Render.
// Em produção, não existe fallback silencioso para armazenamento em memória.
if (isRenderEnvironment) {
  if (!connectionString || connectionString.includes('localhost:5432/lms_ia')) {
    connectionError = 'DATABASE_URL não configurada para o PostgreSQL do Render.';
    console.error(`❌ [DB] ${connectionError}`);
  } else {
    console.log('🚀 [DB] Render detectado. Inicializando Render PostgreSQL pela DATABASE_URL...');

    pgPool = new pg.Pool({
      connectionString,
      ssl: requiresSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
    });

    pgPool.on('error', (error) => {
      connectionError = error.message;
      console.error('❌ [DB] Erro inesperado no pool PostgreSQL:', error.message);
    });

    // Verificação inicial assíncrona. As operações não dependem desta flag:
    // elas consultam o pool e aguardam a resposta real do PostgreSQL.
    void pgPool.query('SELECT 1')
      .then(() => {
        connectionError = null;
        console.log('✅ [DB] Conexão validada com Render PostgreSQL.');
      })
      .catch((error: Error) => {
          connectionError = error.message;
        console.error('❌ [DB] Não foi possível validar o PostgreSQL:', error.message);
      });
  }
} else {
  console.log('ℹ️ [DB] Ambiente local: usando armazenamento em memória para desenvolvimento/testes.');
}

function assertDatabaseAvailable() {
  if (!isRenderEnvironment) return;

  if (!connectionString || !pgPool) {
    const error: any = new Error(
      'PostgreSQL do Render indisponível. Configure DATABASE_URL com a Internal Database URL do banco Render.'
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
        engine: 'Armazenamento em Memória (Desenvolvimento/Testes)',
        productionSafe: false,
        connectOnlyOnRender: true,
        isRenderEnvironment: false,
        postgres: {
          configured: Boolean(connectionString),
          connected: false,
          activeOnRenderOnly: true,
          provider: 'Render PostgreSQL (aguardando execução no Render)',
          latencyMs: null,
          error: null,
          sslEnabled: false,
          schemaReady: false,
          missingTables: [...REQUIRED_TABLES],
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

    let connected = false;
    let latencyMs: number | null = null;
    let missingTables: string[] = [...REQUIRED_TABLES];
    let stats = {
      totalDisciplines: 0,
      totalModules: 0,
      totalHoursItemized: 0,
      targetHours: 200,
      registeredUsers: 0,
    };

    try {
      const pool = getPgPool();
      const startedAt = Date.now();

      await pool.query('SELECT 1');
      connected = true;
      connectionError = null;
      latencyMs = Date.now() - startedAt;

      const tableResult = await pool.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type = 'BASE TABLE'
           AND table_name = ANY($1::text[])`,
        [[...REQUIRED_TABLES]]
      );

      const existingTables = new Set(
        tableResult.rows.map((row: { table_name: string }) => row.table_name)
      );
      missingTables = REQUIRED_TABLES.filter((table) => !existingTables.has(table));

      if (missingTables.length === 0) {
        const statsResult = await pool.query(`
          SELECT
            (SELECT COUNT(*)::int FROM disciplines) AS total_disciplines,
            (SELECT COUNT(DISTINCT module_id)::int FROM disciplines) AS total_modules,
            (SELECT COALESCE(SUM(hours), 0)::int FROM disciplines) AS total_hours,
            (SELECT COUNT(*)::int FROM users) AS registered_users
        `);

        const row = statsResult.rows[0];
        stats = {
          totalDisciplines: Number(row.total_disciplines),
          totalModules: Number(row.total_modules),
          totalHoursItemized: Number(row.total_hours),
          targetHours: 200,
          registeredUsers: Number(row.registered_users),
        };
      }
    } catch (error: any) {
      connected = false;
      connectionError = error?.message || 'Falha ao consultar PostgreSQL.';
    }

    const schemaReady = connected && missingTables.length === 0;
    const healthError = !connected
      ? connectionError
      : missingTables.length > 0
        ? `Esquema incompleto. Tabelas ausentes: ${missingTables.join(', ')}`
        : null;

    return {
      status: schemaReady ? 'ok' : 'degraded',
      engine: connected ? 'Render PostgreSQL' : 'Render PostgreSQL indisponível',
      productionSafe: schemaReady,
      connectOnlyOnRender: true,
      isRenderEnvironment: true,
      postgres: {
        configured: Boolean(connectionString),
        connected,
        provider: 'Render PostgreSQL (Internal Database URL)',
        latencyMs,
        error: healthError,
        sslEnabled: requiresSsl,
        schemaReady,
        missingTables,
      },
      stats,
    };
  },

  async findUserById(id: string): Promise<User | null> {
    assertDatabaseAvailable();

    if (isRenderEnvironment) {
      const result = await getPgPool().query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0] || null;
    }

    return memoryStore.users.get(id) || null;
  },

  async findUserByEmail(email: string): Promise<User | null> {
    assertDatabaseAvailable();
    const cleanEmail = email.trim().toLowerCase();

    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        'SELECT * FROM users WHERE LOWER(email) = $1',
        [cleanEmail]
      );
      return result.rows[0] || null;
    }

    for (const user of memoryStore.users.values()) {
      if (user.email.toLowerCase() === cleanEmail) return user;
    }
    return null;
  },

  async findUserByGoogleSub(googleSub: string): Promise<User | null> {
    assertDatabaseAvailable();

    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT u.*
         FROM users u
         INNER JOIN external_identities e ON e.user_id = u.id
         WHERE e.provider = 'google' AND e.provider_id = $1
         LIMIT 1`,
        [googleSub]
      );
      return result.rows[0] || null;
    }

    const identity = memoryStore.externalIdentities.get(`google:${googleSub}`);
    if (!identity) return null;
    return memoryStore.users.get(identity.user_id) || null;
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
    const isAdmin = cleanEmail === adminEmail;
    const targetRole: UserRole = isAdmin ? 'administrador' : 'aluno';

    // No Render, usuário e identidade Google são gravados no PostgreSQL
    // dentro da mesma transação. Nenhum dado de autenticação fica só na memória.
    if (isRenderEnvironment) {
      const client = await getPgPool().connect();
      let transactionStarted = false;

      try {
        await client.query('BEGIN');
        transactionStarted = true;

        const existingBySub = await client.query(
          `SELECT u.*
           FROM users u
           INNER JOIN external_identities e ON e.user_id = u.id
           WHERE e.provider = 'google' AND e.provider_id = $1
           LIMIT 1
           FOR UPDATE OF u`,
          [profile.googleSub]
        );

        let userRow: User;

        if (existingBySub.rows[0]) {
          const current = existingBySub.rows[0];

          const updated = await client.query(
            `UPDATE users
             SET name = COALESCE(NULLIF($2, ''), name),
                 avatar_url = COALESCE($3, avatar_url),
                 role = CASE WHEN $4 THEN 'administrador' ELSE role END,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [current.id, profile.name, profile.picture || null, isAdmin]
          );

          await client.query(
            `UPDATE external_identities
             SET email = $2
             WHERE provider = 'google' AND provider_id = $1`,
            [profile.googleSub, cleanEmail]
          );

          userRow = updated.rows[0] as User;
        } else {
          const existingByEmail = await client.query(
            'SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1 FOR UPDATE',
            [cleanEmail]
          );

          if (existingByEmail.rows[0]) {
            const current = existingByEmail.rows[0];

            const updated = await client.query(
              `UPDATE users
               SET name = COALESCE(NULLIF($2, ''), name),
                   avatar_url = COALESCE($3, avatar_url),
                   role = CASE WHEN $4 THEN 'administrador' ELSE role END,
                   updated_at = NOW()
               WHERE id = $1
               RETURNING *`,
              [current.id, profile.name, profile.picture || null, isAdmin]
            );

            userRow = updated.rows[0] as User;
          } else {
            const registrationNumber =
              `IF-IA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

            const inserted = await client.query(
              `INSERT INTO users (
                 email, name, avatar_url, role, registration_number
               )
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *`,
              [
                cleanEmail,
                profile.name || cleanEmail,
                profile.picture || null,
                targetRole,
                registrationNumber,
              ]
            );

            userRow = inserted.rows[0] as User;
          }

          await client.query(
            `INSERT INTO external_identities (
               user_id, provider, provider_id, email
             )
             VALUES ($1, 'google', $2, $3)
             ON CONFLICT (provider, provider_id) DO NOTHING`,
            [userRow.id, profile.googleSub, cleanEmail]
          );

          // Confirma que o identificador Google não ficou vinculado a outra conta.
          const linkedIdentity = await client.query(
            `SELECT u.*
             FROM users u
             INNER JOIN external_identities e ON e.user_id = u.id
             WHERE e.provider = 'google' AND e.provider_id = $1
             LIMIT 1`,
            [profile.googleSub]
          );

          if (!linkedIdentity.rows[0] || linkedIdentity.rows[0].id !== userRow.id) {
            throw new Error('A identidade Google já está vinculada a outra conta.');
          }

          userRow = linkedIdentity.rows[0] as User;
        }

        await client.query('COMMIT');
        transactionStarted = false;
        return userRow;
      } catch (error) {
        if (transactionStarted) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            console.error('⚠️ [DB] Falha ao reverter transação de usuário:', rollbackError);
          }
        }
        console.error('❌ [DB] Não foi possível persistir usuário Google no Render:', error);
        throw error;
      } finally {
        client.release();
      }
    }

    // Armazenamento em memória exclusivamente no ambiente local.
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
        id: crypto.randomUUID(),
        user_id: existingByEmail.id,
        provider: 'google',
        provider_id: profile.googleSub,
        email: cleanEmail,
        created_at: new Date().toISOString(),
      };

      memoryStore.externalIdentities.set(`google:${profile.googleSub}`, identity);

      if (isAdmin) existingByEmail.role = 'administrador';
      existingByEmail.avatar_url = profile.picture || existingByEmail.avatar_url;
      existingByEmail.updated_at = new Date().toISOString();
      return existingByEmail;
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email: cleanEmail,
      name: profile.name || cleanEmail,
      avatar_url: profile.picture,
      role: targetRole,
      registration_number: `IF-IA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryStore.users.set(newUser.id, newUser);

    const identity: ExternalIdentity = {
      id: crypto.randomUUID(),
      user_id: newUser.id,
      provider: 'google',
      provider_id: profile.googleSub,
      email: cleanEmail,
      created_at: new Date().toISOString(),
    };

    memoryStore.externalIdentities.set(`google:${profile.googleSub}`, identity);
    return newUser;
  },

  async createSession(userId: string, ip?: string, userAgent?: string): Promise<string> {
    assertDatabaseAvailable();

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    if (isRenderEnvironment) {
      await getPgPool().query(
        `INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [token, userId, expiresAt, ip || null, userAgent || null]
      );
      return token;
    }

    memoryStore.sessions.set(token, {
      id: token,
      userId,
      expiresAt,
      ipAddress: ip,
      userAgent,
    });

    return token;
  },

  async getSession(token: string): Promise<User | null> {
    assertDatabaseAvailable();

    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT u.*
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.id = $1
           AND s.expires_at > NOW()
         LIMIT 1`,
        [token]
      );

      if (result.rows[0]) return result.rows[0] as User;

      // Limpa apenas a sessão expirada consultada.
      await getPgPool().query(
        'DELETE FROM sessions WHERE id = $1 AND expires_at <= NOW()',
        [token]
      );

      return null;
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
    assertDatabaseAvailable();

    if (isRenderEnvironment) {
      await getPgPool().query('DELETE FROM sessions WHERE id = $1', [token]);
      return;
    }

    memoryStore.sessions.delete(token);
  },

  async getUserProgress(userId: string): Promise<StudentProgress[]> {
    assertDatabaseAvailable();

    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT user_id, discipline_id, lesson_id, step_number, completed, quiz_score, completed_at
         FROM student_progress
         WHERE user_id = $1
         ORDER BY discipline_id, lesson_id, step_number`,
        [userId]
      );

      return result.rows.map((row) => ({
        userId: row.user_id,
        disciplineId: row.discipline_id,
        lessonId: row.lesson_id,
        stepNumber: Number(row.step_number),
        completed: row.completed,
        completedAt: typeof row.completed_at === 'string'
          ? row.completed_at
          : new Date(row.completed_at).toISOString(),
        quizScore: row.quiz_score != null ? Number(row.quiz_score) : undefined,
      }));
    }

    const results: StudentProgress[] = [];
    for (const [key, progress] of memoryStore.progress.entries()) {
      if (key.startsWith(`${userId}:`)) results.push(progress);
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

    if (stepNumber < 1 || stepNumber > 5) {
      return {
        success: false,
        message: 'Passo inválido (deve ser entre 1 e 5).',
        unlockedNextStep: null,
      };
    }

    if (stepNumber === 4 && (quizScore === undefined || quizScore < 7.0)) {
      return {
        success: false,
        message: `Aprovação não concedida: nota obtida (${quizScore?.toFixed(1) || '0.0'}) é inferior ao mínimo exigido de 7.0.`,
        unlockedNextStep: null,
      };
    }

    if (isRenderEnvironment) {
      const client = await getPgPool().connect();

      try {
        await client.query('BEGIN');

        if (stepNumber > 1) {
          const previous = await client.query(
            `SELECT completed
             FROM student_progress
             WHERE user_id = $1
               AND discipline_id = $2
               AND lesson_id = $3
               AND step_number = $4
             FOR UPDATE`,
            [userId, disciplineId, lessonId, stepNumber - 1]
          );

          if (!previous.rows[0]?.completed) {
            await client.query('ROLLBACK');
            return {
              success: false,
              message: `Desbloqueio não autorizado: você precisa concluir a etapa anterior (Etapa ${stepNumber - 1}) primeiro.`,
              unlockedNextStep: null,
            };
          }
        }

        await client.query(
          `INSERT INTO student_progress (
             user_id, discipline_id, lesson_id, step_number,
             completed, quiz_score, completed_at
           )
           VALUES ($1, $2, $3, $4, TRUE, $5, NOW())
           ON CONFLICT (user_id, discipline_id, lesson_id, step_number)
           DO UPDATE SET
             completed = TRUE,
             quiz_score = EXCLUDED.quiz_score,
             completed_at = NOW()`,
          [userId, disciplineId, lessonId, stepNumber, quizScore ?? null]
        );

        await client.query('COMMIT');
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {}
        console.error('❌ [DB] Falha ao gravar progresso no PostgreSQL:', error);
        throw error;
      } finally {
        client.release();
      }
    } else {
      if (stepNumber > 1) {
        const previousKey = `${userId}:${disciplineId}:${lessonId}:${stepNumber - 1}`;
        const previousStep = memoryStore.progress.get(previousKey);

        if (!previousStep || !previousStep.completed) {
          return {
            success: false,
            message: `Desbloqueio não autorizado: você precisa concluir a etapa anterior (Etapa ${stepNumber - 1}) primeiro.`,
            unlockedNextStep: null,
          };
        }
      }

      const progressKey = `${userId}:${disciplineId}:${lessonId}:${stepNumber}`;
      memoryStore.progress.set(progressKey, {
        userId,
        disciplineId,
        lessonId,
        stepNumber,
        completed: true,
        completedAt: new Date().toISOString(),
        quizScore,
      });
    }

    const unlockedNext = stepNumber < 5 ? stepNumber + 1 : null;

    return {
      success: true,
      message: stepNumber === 5
        ? 'Aula concluída com sucesso! Avaliação Final da disciplina liberada.'
        : `Etapa ${stepNumber} validada e concluída.`,
      unlockedNextStep: unlockedNext,
    };
  },

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

    const lessons = getDisciplineLessons(disciplineId);

    if (isRenderEnvironment) {
      const completedResult = await getPgPool().query(
        `SELECT COUNT(DISTINCT lesson_id)::int AS completed_lessons
         FROM student_progress
         WHERE user_id = $1
           AND discipline_id = $2
           AND step_number = 5
           AND completed = TRUE`,
        [userId, disciplineId]
      );

      const completedLessons = Number(completedResult.rows[0]?.completed_lessons || 0);

      if (completedLessons < lessons.length) {
        const error: any = new Error(
          `Pré-requisito pendente: Para realizar a Avaliação Final, todas as aulas de ${disciplineId} devem estar integralmente concluídas (Passos 1 a 5).`
        );
        error.status = 403;
        throw error;
      }
    } else {
      for (const lesson of lessons) {
        const step5Key = `${userId}:${disciplineId}:${lesson.id}:5`;
        const step5 = memoryStore.progress.get(step5Key);

        if (!step5 || !step5.completed) {
          const error: any = new Error(
            `Pré-requisito pendente: Para realizar a Avaliação Final, todas as aulas de ${disciplineId} devem estar integralmente concluídas (Passos 1 a 5).`
          );
          error.status = 403;
          throw error;
        }
      }
    }

    if (!Array.isArray(answers) || answers.length !== 10) {
      const error: any = new Error('A avaliação final requer exatamente 10 respostas preenchidas.');
      error.status = 400;
      throw error;
    }

    const officialKeys = FINAL_EXAM_ANSWERS_SERVER[disciplineId] || FINAL_EXAM_ANSWERS_SERVER.default;
    let correctCount = 0;

    for (let index = 0; index < 10; index++) {
      if (answers[index] === officialKeys[index]) correctCount++;
    }

    const score = Number(correctCount.toFixed(1));
    const passed = score >= 7.0;
    const attemptId = crypto.randomUUID();
    const attemptedAt = new Date().toISOString();

    if (!isRenderEnvironment) {
      const attempt: FinalExamAttempt = {
        id: attemptId,
        userId,
        disciplineId,
        score,
        passed,
        answers,
        attemptedAt,
      };
      memoryStore.finalExamAttempts.push(attempt);
    }

    if (passed) {
      if (isRenderEnvironment) {
        await getPgPool().query(
          `INSERT INTO discipline_approvals (
             user_id, discipline_id, approved, final_grade, approved_at
           )
           VALUES ($1, $2, TRUE, $3, NOW())
           ON CONFLICT (user_id, discipline_id)
           DO UPDATE SET
             approved = TRUE,
             final_grade = EXCLUDED.final_grade,
             approved_at = NOW()`,
          [userId, disciplineId, score]
        );
      } else {
        const approvalRecord: DisciplineApproval = {
          userId,
          disciplineId,
          approved: true,
          finalGrade: score,
          approvedAt: attemptedAt,
        };
        memoryStore.disciplineApprovals.set(`${userId}:${disciplineId}`, approvalRecord);
      }
    }

    // O esquema atual não possui tabela específica de tentativas da avaliação final.
    // Registramos a tentativa no log de auditoria persistente sem inventar uma tabela.
    await this.logAudit(userId, 'SUBMIT_FINAL_EXAM', 'academic', undefined, {
      disciplineId,
      score,
      passed,
      attemptId,
      answers,
      attemptedAt,
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

    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT user_id, discipline_id, approved, final_grade, approved_at
         FROM discipline_approvals
         WHERE user_id = $1 AND discipline_id = $2`,
        [userId, disciplineId]
      );

      const row = result.rows[0];
      if (!row) return null;

      return {
        userId: row.user_id,
        disciplineId: row.discipline_id,
        approved: row.approved,
        finalGrade: Number(row.final_grade),
        approvedAt: typeof row.approved_at === 'string'
          ? row.approved_at
          : new Date(row.approved_at).toISOString(),
      };
    }

    return memoryStore.disciplineApprovals.get(`${userId}:${disciplineId}`) || null;
  },

  async getUserApprovals(userId: string): Promise<DisciplineApproval[]> {
    assertDatabaseAvailable();

    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT user_id, discipline_id, approved, final_grade, approved_at
         FROM discipline_approvals
         WHERE user_id = $1
         ORDER BY approved_at`,
        [userId]
      );

      return result.rows.map((row) => ({
        userId: row.user_id,
        disciplineId: row.discipline_id,
        approved: row.approved,
        finalGrade: Number(row.final_grade),
        approvedAt: typeof row.approved_at === 'string'
          ? row.approved_at
          : new Date(row.approved_at).toISOString(),
      }));
    }

    const approvals: DisciplineApproval[] = [];
    for (const [key, approval] of memoryStore.disciplineApprovals.entries()) {
      if (key.startsWith(`${userId}:`)) approvals.push(approval);
    }
    return approvals;
  },

  async getChatHistory(userId: string, disciplineId?: string): Promise<ChatMessage[]> {
    assertDatabaseAvailable();

    if (isRenderEnvironment) {
      const params: any[] = [userId];
      let query = 'SELECT * FROM chat_messages WHERE user_id = $1';

      if (disciplineId) {
        query += ' AND discipline_id = $2';
        params.push(disciplineId);
      }

      query += ' ORDER BY created_at ASC';

      const result = await getPgPool().query(query, params);

      return result.rows.map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        sources: typeof row.sources === 'string'
          ? JSON.parse(row.sources)
          : row.sources || [],
        timestamp: typeof row.created_at === 'string'
          ? row.created_at
          : new Date(row.created_at).toISOString(),
        disciplineId: row.discipline_id || undefined,
        lessonId: row.lesson_id || undefined,
      }));
    }

    return memoryStore.chatMessages
      .filter((message) =>
        message.userId === userId &&
        (!disciplineId || message.disciplineId === disciplineId)
      )
      .map(({ userId: _userId, ...message }) => message);
  },

  async addChatMessage(
    msg: Omit<ChatMessage, 'id' | 'timestamp'> & { userId: string }
  ): Promise<ChatMessage> {
    assertDatabaseAvailable();

    const fullMsg: StoredChatMessage = {
      id: crypto.randomUUID(),
      userId: msg.userId,
      role: msg.role,
      content: msg.content,
      disciplineId: msg.disciplineId,
      lessonId: msg.lessonId,
      sources: msg.sources,
      timestamp: new Date().toISOString(),
    };

    if (isRenderEnvironment) {
      await getPgPool().query(
        `INSERT INTO chat_messages (
           id, user_id, discipline_id, lesson_id, role, content, sources
         )
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
    } else {
      memoryStore.chatMessages.push(fullMsg);
    }

    const { userId: _userId, ...publicMessage } = fullMsg;
    return publicMessage;
  },

  async verifyCertificate(code: string): Promise<Certificate | null> {
    assertDatabaseAvailable();
    const cleanCode = code.trim().toUpperCase();

    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT c.*, u.name AS user_name
         FROM certificates c
         INNER JOIN users u ON u.id = c.user_id
         WHERE UPPER(c.validation_code) = $1
           AND c.status = 'valido'
         LIMIT 1`,
        [cleanCode]
      );

      const row = result.rows[0];
      if (!row) return null;

      return {
        id: row.id,
        validationCode: row.validation_code,
        userId: row.user_id,
        userName: row.user_name || 'Estudante Certificado',
        courseTitle: row.course_title,
        totalHours: Number(row.total_hours),
        completionDate: typeof row.completion_date === 'string'
          ? row.completion_date
          : new Date(row.completion_date).toISOString().split('T')[0],
        status: row.status,
        issuedAt: row.issued_at,
      };
    }

    for (const certificate of memoryStore.certificates.values()) {
      if (
        certificate.validationCode.toUpperCase() === cleanCode &&
        certificate.status === 'valido'
      ) {
        return certificate;
      }
    }

    return null;
  },

  async getUserCertificate(userId: string): Promise<Certificate | null> {
    assertDatabaseAvailable();

    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT c.*, u.name AS user_name
         FROM certificates c
         INNER JOIN users u ON u.id = c.user_id
         WHERE c.user_id = $1
           AND c.status = 'valido'
         ORDER BY c.issued_at DESC
         LIMIT 1`,
        [userId]
      );

      const row = result.rows[0];
      if (!row) return null;

      return {
        id: row.id,
        validationCode: row.validation_code,
        userId: row.user_id,
        userName: row.user_name || 'Estudante',
        courseTitle: row.course_title,
        totalHours: Number(row.total_hours),
        completionDate: typeof row.completion_date === 'string'
          ? row.completion_date
          : new Date(row.completion_date).toISOString().split('T')[0],
        status: row.status,
        issuedAt: row.issued_at,
      };
    }

    for (const certificate of memoryStore.certificates.values()) {
      if (certificate.userId === userId && certificate.status === 'valido') {
        return certificate;
      }
    }

    return null;
  },

  async issueCertificate(
    userId: string
  ): Promise<{ success: boolean; certificate?: Certificate; reason?: string }> {
    assertDatabaseAvailable();

    const user = await this.findUserById(userId);
    if (!user) return { success: false, reason: 'Usuário não localizado.' };

    const existing = await this.getUserCertificate(userId);
    if (existing) return { success: true, certificate: existing };

    const approvals = await this.getUserApprovals(userId);
    const approvedCount = approvals.filter((approval) => {
      const grade = Number(approval.finalGrade);
      return approval.approved === true && Number.isFinite(grade) && grade >= 7.0;
    }).length;

    if (approvedCount < DISCIPLINES.length) {
      return {
        success: false,
        reason: `Requisitos acadêmicos incompletos: ${approvedCount} de ${DISCIPLINES.length} componentes aprovados com nota mínima 7,0.`,
      };
    }

    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const validationCode = `IFIA-2026-${randomHex}`;
    const completionDate = new Date().toISOString().split('T')[0];
    const issuedAt = new Date().toISOString();

    const certificate: Certificate = {
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
      await getPgPool().query(
        `INSERT INTO certificates (
           id, validation_code, user_id, course_title,
           total_hours, completion_date, status, issued_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          certificate.id,
          certificate.validationCode,
          certificate.userId,
          certificate.courseTitle,
          certificate.totalHours,
          certificate.completionDate,
          certificate.status,
          certificate.issuedAt,
        ]
      );
    } else {
      memoryStore.certificates.set(certificate.id, certificate);
    }

    await this.logAudit(
      userId,
      'CERTIFICATE_ISSUED',
      `certificate:${validationCode}`,
      undefined,
      { studentName: user.name, validationCode }
    );

    return { success: true, certificate };
  },

  async issueCertificateIfEligible(userId: string, allowOfficialIssuance = false): Promise<{ eligible: boolean; certificate?: Certificate; reason?: string }> {
    assertDatabaseAvailable();
    const user = await this.findUserById(userId);
    if (!user) return { eligible: false, reason: 'Usuário não localizado.' };

    // 1. Auditoria dos 20 componentes aprovados
    const approvals = await this.getUserApprovals(userId);
    const approvedCount = approvals.filter((approval) => {
      const grade = Number(approval.finalGrade);
      return approval.approved === true && Number.isFinite(grade) && grade >= 7.0;
    }).length;

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
      const result = await getPgPool().query(
        `SELECT c.*, u.name AS user_name
         FROM certificates c
         INNER JOIN users u ON u.id = c.user_id
         ORDER BY c.issued_at DESC`
      );

      return result.rows.map((row) => ({
        id: row.id,
        validationCode: row.validation_code,
        userId: row.user_id,
        userName: row.user_name || 'Estudante',
        courseTitle: row.course_title,
        totalHours: Number(row.total_hours),
        completionDate: typeof row.completion_date === 'string'
          ? row.completion_date
          : new Date(row.completion_date).toISOString().split('T')[0],
        status: row.status,
        issuedAt: row.issued_at,
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
    assertDatabaseAvailable();

    let studentsList: User[];

    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT id, name, email, registration_number, role, created_at, updated_at
         FROM users
         WHERE role = 'aluno'
         ORDER BY name ASC`
      );

      studentsList = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        registration_number: row.registration_number,
        role: row.role,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })) as User[];
    } else {
      studentsList = Array.from(memoryStore.users.values())
        .filter((user) => user.role === 'aluno');
    }

    const totalCurriculumSteps = DISCIPLINES.reduce(
      (total, discipline) =>
        total + getDisciplineLessons(discipline.id).length * 5,
      0
    );

    const result = [];

    for (const student of studentsList) {
      const progress = await this.getUserProgress(student.id);
      const approvals = await this.getUserApprovals(student.id);
      const certificate = await this.getUserCertificate(student.id);

      const approvedCount = approvals.filter(
        (approval) =>
          approval.approved &&
          (approval.finalGrade === undefined || approval.finalGrade >= 7.0)
      ).length;

      const completedSteps = progress.filter((step) => step.completed).length;
      const overallPercent = totalCurriculumSteps > 0
        ? Math.min(100, Math.round((completedSteps / totalCurriculumSteps) * 100))
        : 0;

      result.push({
        id: student.id,
        name: student.name,
        email: student.email,
        registrationNumber: student.registration_number,
        role: student.role,
        createdAt: typeof student.created_at === 'string'
          ? student.created_at
          : new Date(student.created_at).toISOString(),
        completedDisciplinesCount: approvedCount,
        overallPercent,
        hasCertificate: Boolean(certificate),
        certificateCode: certificate?.validationCode,
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
        `INSERT INTO audit_logs (
           user_id, action, resource, ip_address, details
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId || null,
          action,
          resource,
          ip || null,
          details == null ? null : JSON.stringify(details),
        ]
      );
      return;
    }

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