import pg from 'pg';
import crypto from 'crypto';
import { DISCIPLINES, getDisciplineLessons } from '../db/seed-data.ts';
import { ALL_FIXATION_QUIZZES } from '../db/fixation-quizzes.ts';
import {
  User,
  UserRole,
  ExternalIdentity,
  StudentProgress,
  Certificate,
  ChatMessage,
  DisciplineApproval,
} from '../types/index.ts';

const isRenderEnvironment = Boolean(
  process.env.RENDER === 'true' ||
  process.env.RENDER_SERVICE_ID ||
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
  'users', 'external_identities', 'sessions', 'disciplines', 'lessons',
  'student_progress', 'quizzes', 'quiz_questions', 'quiz_attempts',
  'certificates', 'chat_messages', 'audit_logs', 'discipline_approvals',
] as const;

let pgPool: pg.Pool | null = null;
let connectionError: string | null = null;

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
      connectionError = error.message;
      console.error('[DB] Erro inesperado no pool PostgreSQL:', error.message);
    });

    void pgPool.query('SELECT 1')
      .then(() => {
        connectionError = null;
        console.log('[DB] PostgreSQL do Render conectado.');
      })
      .catch((error: Error) => {
        connectionError = error.message;
        console.error('[DB] Falha na conexão inicial:', error.message);
      });
  }
} else {
  console.log('[DB] Desenvolvimento local: armazenamento em memória habilitado.');
}

function assertDatabaseAvailable(): void {
  // Memória é permitida somente fora do Render e fora da produção.
  if (!isRenderEnvironment && isProduction) {
    const error: any = new Error(
      'PostgreSQL obrigatório em produção. Configure DATABASE_URL.'
    );
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

function validApproval(approval: DisciplineApproval | any): boolean {
  const grade = Number(approval?.finalGrade);
  return approval?.approved === true && Number.isFinite(grade) && grade >= 7;
}

function mapProgress(row: any): StudentProgress {
  return {
    userId: row.user_id,
    disciplineId: row.discipline_id,
    lessonId: row.lesson_id,
    stepNumber: Number(row.step_number),
    completed: Boolean(row.completed),
    completedAt: row.completed_at
      ? (typeof row.completed_at === 'string'
        ? row.completed_at
        : new Date(row.completed_at).toISOString())
      : undefined,
    quizScore: row.quiz_score == null ? undefined : Number(row.quiz_score),
  } as StudentProgress;
}

function mapApproval(row: any): DisciplineApproval {
  return {
    userId: row.user_id,
    disciplineId: row.discipline_id,
    approved: Boolean(row.approved),
    finalGrade: Number(row.final_grade),
    approvedAt: row.approved_at
      ? (typeof row.approved_at === 'string'
        ? row.approved_at
        : new Date(row.approved_at).toISOString())
      : undefined,
  } as DisciplineApproval;
}

function mapCertificate(row: any): Certificate {
  return {
    id: row.id,
    validationCode: row.validation_code,
    userId: row.user_id,
    userName: row.user_name || row.userName || 'Estudante',
    courseTitle: row.course_title,
    totalHours: Number(row.total_hours),
    completionDate: typeof row.completion_date === 'string'
      ? row.completion_date
      : new Date(row.completion_date).toISOString().slice(0, 10),
    status: row.status,
    issuedAt: typeof row.issued_at === 'string'
      ? row.issued_at
      : new Date(row.issued_at).toISOString(),
  } as Certificate;
}

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
  externalIdentities: new Map<string, ExternalIdentity>(),
  sessions: new Map<string, SessionRecord>(),
  progress: new Map<string, StudentProgress>(),
  chatMessages: [] as StoredChatMessage[],
  certificates: new Map<string, Certificate>(),
  disciplineApprovals: new Map<string, DisciplineApproval>(),
  auditLogs: [] as Array<any>,
};

function progressKey(userId: string, disciplineId: string, lessonId: string, step: number) {
  return `${userId}:${disciplineId}:${lessonId}:${step}`;
}

function curriculumDisciplineIds(): Set<string> {
  return new Set(DISCIPLINES.map((discipline) => discipline.id));
}

/**
 * Resumo acadêmico calculado a partir do progresso e das aprovações persistidas.
 * Mantém os nomes de propriedades utilizados pela interface e pelas rotas.
 */
export function computeAcademicProgressSummary(
  progressList: StudentProgress[],
  approvals: DisciplineApproval[]
) {
  const validIds = curriculumDisciplineIds();
  const validApprovals = new Map<string, DisciplineApproval>();

  for (const approval of approvals || []) {
    if (validIds.has(approval.disciplineId) && validApproval(approval)) {
      validApprovals.set(approval.disciplineId, approval);
    }
  }

  const disciplines = DISCIPLINES.map((discipline) => {
    const lessons = getDisciplineLessons(discipline.id);
    const rows = (progressList || []).filter(
      (item) => item.disciplineId === discipline.id && lessons.some((lesson: any) => lesson.id === item.lessonId)
    );
    const uniqueCompleted = new Set(
      rows.filter((item) => item.completed && item.stepNumber >= 1 && item.stepNumber <= 5)
        .map((item) => `${item.lessonId}:${item.stepNumber}`)
    );
    const totalSteps = lessons.length * 5;
    const completedSteps = Math.min(totalSteps, uniqueCompleted.size);
    const approval = validApprovals.get(discipline.id);
    const percent = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
      disciplineId: discipline.id,
      code: discipline.code,
      title: discipline.title,
      hours: discipline.hours,
      completedSteps,
      totalSteps,
      percent,
      approved: Boolean(approval),
      finalGrade: approval?.finalGrade ?? null,
      status: approval ? 'completed' : completedSteps ? 'in_progress' : 'blocked',
    };
  });

  const completedDisciplinesCount = validApprovals.size;
  const totalHoursItemized = DISCIPLINES.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  const hoursCompleted = DISCIPLINES.reduce(
    (sum, item) => sum + (validApprovals.has(item.id) ? Number(item.hours || 0) : 0), 0
  );
  const totalSteps = disciplines.reduce((sum, item) => sum + item.totalSteps, 0);
  const completedSteps = disciplines.reduce((sum, item) => sum + item.completedSteps, 0);
  const nextToResume = disciplines.find((item) => !item.approved);

  return {
    disciplines,
    completedDisciplinesCount,
    totalDisciplinesCount: DISCIPLINES.length,
    approvedDisciplinesCount: completedDisciplinesCount,
    overallPercent: totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0,
    hoursCompleted,
    totalHoursItemized,
    totalHours: totalHoursItemized,
    targetHours: 200,
    finalExamApproved: completedDisciplinesCount === DISCIPLINES.length,
    nextToResume: nextToResume ? {
      disciplineId: nextToResume.disciplineId,
      title: nextToResume.title,
    } : null,
    certificateEligible:
      completedDisciplinesCount === DISCIPLINES.length && totalHoursItemized === 200,
  };
}

export const db = {
  async getHealthStatus() {
    if (!isRenderEnvironment) {
      const safeLocal = !isProduction;
      return {
        status: safeLocal ? 'ok' : 'degraded',
        engine: safeLocal ? 'Memória (desenvolvimento)' : 'PostgreSQL obrigatório',
        productionSafe: false,
        connectOnlyOnRender: true,
        isRenderEnvironment: false,
        postgres: {
          configured: Boolean(connectionString),
          connected: false,
          provider: 'Render PostgreSQL',
          latencyMs: null,
          error: isProduction ? 'DATABASE_URL ausente no ambiente de produção.' : null,
          sslEnabled: false,
          schemaReady: false,
          missingTables: [...REQUIRED_TABLES],
        },
        stats: {
          totalDisciplines: DISCIPLINES.length,
          totalModules: 3,
          totalHoursItemized: DISCIPLINES.reduce((s, d) => s + Number(d.hours || 0), 0),
          targetHours: 200,
          registeredUsers: memoryStore.users.size,
        },
      };
    }

    let connected = false;
    let latencyMs: number | null = null;
    let missingTables: string[] = [...REQUIRED_TABLES];
    let stats = {
      totalDisciplines: 0, totalModules: 0, totalHoursItemized: 0,
      targetHours: 200, registeredUsers: 0,
    };

    try {
      const pool = getPgPool();
      const start = Date.now();
      await pool.query('SELECT 1');
      connected = true;
      connectionError = null;
      latencyMs = Date.now() - start;

      const tableResult = await pool.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type = 'BASE TABLE'
           AND table_name = ANY($1::text[])`,
        [[...REQUIRED_TABLES]]
      );
      const existing = new Set(tableResult.rows.map((row: any) => row.table_name));
      missingTables = REQUIRED_TABLES.filter((name) => !existing.has(name));

      if (!missingTables.length) {
        const result = await pool.query(`
          SELECT
            (SELECT COUNT(*)::int FROM disciplines) AS total_disciplines,
            (SELECT COUNT(DISTINCT module_id)::int FROM disciplines) AS total_modules,
            (SELECT COALESCE(SUM(hours), 0)::int FROM disciplines) AS total_hours,
            (SELECT COUNT(*)::int FROM users) AS registered_users
        `);
        const row = result.rows[0];
        stats = {
          totalDisciplines: Number(row.total_disciplines),
          totalModules: Number(row.total_modules),
          totalHoursItemized: Number(row.total_hours),
          targetHours: 200,
          registeredUsers: Number(row.registered_users),
        };
      }
    } catch (error: any) {
      connectionError = error?.message || 'Falha ao consultar PostgreSQL.';
    }

    const schemaReady = connected && missingTables.length === 0;
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
        error: !connected ? connectionError :
          missingTables.length ? `Tabelas ausentes: ${missingTables.join(', ')}` : null,
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
        'SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1', [cleanEmail]
      );
      return result.rows[0] || null;
    }
    return [...memoryStore.users.values()].find(
      (user) => user.email.toLowerCase() === cleanEmail
    ) || null;
  },

  async findUserByGoogleSub(googleSub: string): Promise<User | null> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT u.* FROM users u
         JOIN external_identities e ON e.user_id = u.id
         WHERE e.provider = 'google' AND e.provider_id = $1 LIMIT 1`,
        [googleSub]
      );
      return result.rows[0] || null;
    }
    const identity = memoryStore.externalIdentities.get(`google:${googleSub}`);
    return identity ? memoryStore.users.get(identity.user_id) || null : null;
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
      const result = await getPgPool().query(
        `SELECT user_id, discipline_id, lesson_id, step_number, completed, quiz_score, completed_at
         FROM student_progress WHERE user_id = $1
         ORDER BY discipline_id, lesson_id, step_number`,
        [userId]
      );
      return result.rows.map(mapProgress);
    }
    return [...memoryStore.progress.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, value]) => value);
  },

  /**
   * Etapa 4 nunca pode ser concluída por esta função/rota.
   * Somente gradeQuiz(), após correção do gabarito no servidor, grava a etapa 4.
   */
  async completeStep(
    userId: string,
    disciplineId: string,
    lessonId: string,
    stepNumber: number,
    quizScore?: number
  ): Promise<{ success: boolean; message: string; unlockedNextStep: number | null }> {
    assertDatabaseAvailable();

    if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 5) {
      return { success: false, message: 'Etapa inválida.', unlockedNextStep: null };
    }
    if (stepNumber === 4) {
      return {
        success: false,
        message: 'A Etapa 4 só pode ser registrada após a correção do Teste de Fixação.',
        unlockedNextStep: null,
      };
    }

    const lessons = getDisciplineLessons(disciplineId);
    if (!curriculumDisciplineIds().has(disciplineId) ||
        !lessons.some((lesson: any) => lesson.id === lessonId)) {
      return { success: false, message: 'Disciplina ou aula inválida.', unlockedNextStep: null };
    }

    if (isRenderEnvironment) {
      const client = await getPgPool().connect();
      try {
        await client.query('BEGIN');

        if (stepNumber > 1) {
          const previous = await client.query(
            `SELECT completed, quiz_score FROM student_progress
             WHERE user_id = $1 AND discipline_id = $2
               AND lesson_id = $3 AND step_number = $4 FOR UPDATE`,
            [userId, disciplineId, lessonId, stepNumber - 1]
          );
          if (!previous.rows[0]?.completed) {
            await client.query('ROLLBACK');
            return {
              success: false,
              message: `Conclua a Etapa ${stepNumber - 1} antes de continuar.`,
              unlockedNextStep: null,
            };
          }
          if (stepNumber === 5 &&
              Number(previous.rows[0].quiz_score) < 7) {
            await client.query('ROLLBACK');
            return {
              success: false,
              message: 'A Etapa 5 exige aprovação no Teste de Fixação com nota mínima 7,0.',
              unlockedNextStep: null,
            };
          }
        }

        await client.query(
          `INSERT INTO student_progress
             (user_id, discipline_id, lesson_id, step_number, completed, quiz_score, completed_at)
           VALUES ($1, $2, $3, $4, TRUE, NULL, NOW())
           ON CONFLICT (user_id, discipline_id, lesson_id, step_number)
           DO UPDATE SET completed = TRUE, completed_at = NOW()`,
          [userId, disciplineId, lessonId, stepNumber]
        );

        if (stepNumber === 5) {
          const quizResult = await client.query(
            `SELECT completed, quiz_score FROM student_progress
             WHERE user_id = $1 AND discipline_id = $2
               AND lesson_id = $3 AND step_number = 4 FOR UPDATE`,
            [userId, disciplineId, lessonId]
          );
          if (!quizResult.rows[0]?.completed || Number(quizResult.rows[0].quiz_score) < 7) {
            await client.query('ROLLBACK');
            return {
              success: false,
              message: 'Aprovação não encontrada. Realize e aprove o Teste de Fixação.',
              unlockedNextStep: null,
            };
          }

          // Há uma aula por disciplina. A aprovação e a conclusão são atômicas.
          const grade = Number(quizResult.rows[0].quiz_score);
          await client.query(
            `INSERT INTO discipline_approvals
               (user_id, discipline_id, approved, final_grade, approved_at)
             VALUES ($1, $2, TRUE, $3, NOW())
             ON CONFLICT (user_id, discipline_id)
             DO UPDATE SET approved = TRUE, final_grade = EXCLUDED.final_grade,
                           approved_at = NOW()`,
            [userId, disciplineId, grade]
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    } else {
      if (stepNumber > 1) {
        const previous = memoryStore.progress.get(
          progressKey(userId, disciplineId, lessonId, stepNumber - 1)
        );
        if (!previous?.completed) {
          return {
            success: false,
            message: `Conclua a Etapa ${stepNumber - 1} antes de continuar.`,
            unlockedNextStep: null,
          };
        }
        if (stepNumber === 5 && Number(previous.quizScore) < 7) {
          return {
            success: false,
            message: 'A Etapa 5 exige nota mínima 7,0 no teste.',
            unlockedNextStep: null,
          };
        }
      }
      if (stepNumber === 5) {
        const quiz = memoryStore.progress.get(progressKey(userId, disciplineId, lessonId, 4));
        if (!quiz?.completed || Number(quiz.quizScore) < 7) {
          return {
            success: false,
            message: 'Aprovação não encontrada. Realize o teste.',
            unlockedNextStep: null,
          };
        }
        memoryStore.disciplineApprovals.set(`${userId}:${disciplineId}`, {
          userId, disciplineId, approved: true,
          finalGrade: Number(quiz.quizScore), approvedAt: new Date().toISOString(),
        } as DisciplineApproval);
      }

      memoryStore.progress.set(progressKey(userId, disciplineId, lessonId, stepNumber), {
        userId, disciplineId, lessonId, stepNumber, completed: true,
        completedAt: new Date().toISOString(),
      } as StudentProgress);
    }

    return {
      success: true,
      message: stepNumber === 5
        ? 'Aula concluída e aprovação da disciplina registrada com sucesso.'
        : `Etapa ${stepNumber} concluída.`,
      unlockedNextStep: stepNumber < 5 ? stepNumber + 1 : null,
    };
  },

  async gradeQuiz(
    userId: string,
    disciplineId: string,
    lessonId: string,
    answers: number[]
  ): Promise<{ score: number; passed: boolean; explanation: string }> {
    assertDatabaseAvailable();

    if (!Array.isArray(answers) || answers.length !== 3 ||
        answers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 2)) {
      throw httpError('O Teste de Fixação exige exatamente 3 respostas válidas (índices 0, 1 ou 2).', 400);
    }

    if (!curriculumDisciplineIds().has(disciplineId)) {
      throw httpError('Disciplina inválida.', 400);
    }

    const lesson = getDisciplineLessons(disciplineId)
      .find((item: any) => item.id === lessonId);
    if (!lesson) throw httpError('A aula informada não pertence à disciplina.', 400);

    const quiz = ALL_FIXATION_QUIZZES[disciplineId];
    if (!quiz || quiz.disciplineId !== disciplineId || quiz.lessonId !== lessonId ||
        !Array.isArray(quiz.correctAnswers) || quiz.correctAnswers.length !== 3 ||
        quiz.correctAnswers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 2)) {
      throw httpError('Gabarito oficial do Teste de Fixação não encontrado ou inválido.', 500);
    }

    if (isRenderEnvironment) {
      const client = await getPgPool().connect();
      try {
        await client.query('BEGIN');
        const step3 = await client.query(
          `SELECT completed FROM student_progress
           WHERE user_id = $1 AND discipline_id = $2
             AND lesson_id = $3 AND step_number = 3 FOR UPDATE`,
          [userId, disciplineId, lessonId]
        );
        if (!step3.rows[0]?.completed) {
          await client.query('ROLLBACK');
          throw httpError('Conclua a Etapa 3 antes de realizar o Teste de Fixação.', 403);
        }

        const correctCount = answers.reduce(
          (count, answer, index) => count + (answer === quiz.correctAnswers[index] ? 1 : 0), 0
        );
        const score = Number(((correctCount / 3) * 10).toFixed(1));
        const passed = correctCount === 3;

        // Uma tentativa reprovada não apaga uma aprovação anterior já registrada.
        await client.query(
          `INSERT INTO student_progress
             (user_id, discipline_id, lesson_id, step_number, completed, quiz_score, completed_at)
           VALUES ($1, $2, $3, 4, $4, $5, CASE WHEN $4 THEN NOW() ELSE NULL END)
           ON CONFLICT (user_id, discipline_id, lesson_id, step_number)
           DO UPDATE SET
             completed = CASE WHEN student_progress.completed THEN TRUE ELSE EXCLUDED.completed END,
             quiz_score = CASE WHEN student_progress.completed THEN student_progress.quiz_score ELSE EXCLUDED.quiz_score END,
             completed_at = CASE WHEN student_progress.completed THEN student_progress.completed_at ELSE EXCLUDED.completed_at END`,
          [userId, disciplineId, lessonId, passed, score]
        );

        await client.query('COMMIT');
        return { score, passed, explanation: quiz.explanation };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    const step3 = memoryStore.progress.get(progressKey(userId, disciplineId, lessonId, 3));
    if (!step3?.completed) {
      throw httpError('Conclua a Etapa 3 antes de realizar o Teste de Fixação.', 403);
    }
    const correctCount = answers.reduce(
      (count, answer, index) => count + (answer === quiz.correctAnswers[index] ? 1 : 0), 0
    );
    const score = Number(((correctCount / 3) * 10).toFixed(1));
    const passed = correctCount === 3;
    const key = progressKey(userId, disciplineId, lessonId, 4);
    const previous = memoryStore.progress.get(key);
    if (!previous?.completed) {
      memoryStore.progress.set(key, {
        userId, disciplineId, lessonId, stepNumber: 4,
        completed: passed, quizScore: score,
        completedAt: passed ? new Date().toISOString() : undefined,
      } as StudentProgress);
    }
    return { score, passed, explanation: quiz.explanation };
  },

  // Compatibilidade temporária: a avaliação final de 10 questões foi desativada.
  async getDisciplineFinalExamQuestions(_disciplineId: string): Promise<any[]> {
    throw httpError('A avaliação final separada foi desativada. A aprovação ocorre pelo Teste de Fixação e pela Etapa 5.', 410);
  },

  async gradeFinalExam(
    _userId: string, _disciplineId: string, _answers: number[]
  ): Promise<any> {
    throw httpError('A avaliação final separada de 10 questões não é mais utilizada no CAMPOS IA.', 410);
  },

  async getDisciplineApproval(userId: string, disciplineId: string): Promise<DisciplineApproval | null> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT user_id, discipline_id, approved, final_grade, approved_at
         FROM discipline_approvals WHERE user_id = $1 AND discipline_id = $2`,
        [userId, disciplineId]
      );
      return result.rows[0] ? mapApproval(result.rows[0]) : null;
    }
    return memoryStore.disciplineApprovals.get(`${userId}:${disciplineId}`) || null;
  },

  async getUserApprovals(userId: string): Promise<DisciplineApproval[]> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT user_id, discipline_id, approved, final_grade, approved_at
         FROM discipline_approvals WHERE user_id = $1 ORDER BY approved_at`,
        [userId]
      );
      return result.rows.map(mapApproval);
    }
    return [...memoryStore.disciplineApprovals.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, value]) => value);
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
      return result.rows.map((row: any) => ({
        id: row.id, role: row.role, content: row.content,
        sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources || [],
        timestamp: typeof row.created_at === 'string'
          ? row.created_at : new Date(row.created_at).toISOString(),
        disciplineId: row.discipline_id || undefined,
        lessonId: row.lesson_id || undefined,
      }));
    }
    return memoryStore.chatMessages
      .filter((item) => item.userId === userId && (!disciplineId || item.disciplineId === disciplineId))
      .map(({ userId: _userId, ...message }) => message);
  },

  async addChatMessage(
    msg: Omit<ChatMessage, 'id' | 'timestamp'> & { userId: string }
  ): Promise<ChatMessage> {
    assertDatabaseAvailable();
    const full: StoredChatMessage = {
      id: crypto.randomUUID(), userId: msg.userId, role: msg.role,
      content: msg.content, disciplineId: msg.disciplineId, lessonId: msg.lessonId,
      sources: msg.sources, timestamp: new Date().toISOString(),
    };
    if (isRenderEnvironment) {
      await getPgPool().query(
        `INSERT INTO chat_messages (id, user_id, discipline_id, lesson_id, role, content, sources)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [full.id, full.userId, full.disciplineId || null, full.lessonId || null,
          full.role, full.content, JSON.stringify(full.sources || [])]
      );
    } else {
      memoryStore.chatMessages.push(full);
    }
    const { userId: _userId, ...publicMessage } = full;
    return publicMessage;
  },

  async verifyCertificate(code: string): Promise<Certificate | null> {
    assertDatabaseAvailable();
    const clean = code.trim().toUpperCase();
    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT c.*, u.name AS user_name FROM certificates c
         JOIN users u ON u.id = c.user_id
         WHERE UPPER(c.validation_code) = $1 AND c.status = 'valido' LIMIT 1`,
        [clean]
      );
      return result.rows[0] ? mapCertificate(result.rows[0]) : null;
    }
    return [...memoryStore.certificates.values()].find(
      (item) => item.validationCode.toUpperCase() === clean && item.status === 'valido'
    ) || null;
  },

  async getUserCertificate(userId: string): Promise<Certificate | null> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT c.*, u.name AS user_name FROM certificates c
         JOIN users u ON u.id = c.user_id
         WHERE c.user_id = $1 AND c.status = 'valido'
         ORDER BY c.issued_at DESC LIMIT 1`,
        [userId]
      );
      return result.rows[0] ? mapCertificate(result.rows[0]) : null;
    }
    return [...memoryStore.certificates.values()].find(
      (item) => item.userId === userId && item.status === 'valido'
    ) || null;
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
    const validIds = curriculumDisciplineIds();
    const approved = new Map<string, DisciplineApproval>();
    for (const item of approvals) {
      if (validIds.has(item.disciplineId) && validApproval(item)) {
        approved.set(item.disciplineId, item);
      }
    }

    if (approved.size !== DISCIPLINES.length) {
      return {
        success: false,
        reason: `Requisitos incompletos: ${approved.size} de ${DISCIPLINES.length} disciplinas aprovadas com nota mínima 7,0.`,
      };
    }

    const totalHours = DISCIPLINES.reduce((sum, item) => sum + Number(item.hours || 0), 0);
    if (totalHours !== 200) {
      throw httpError(`Carga horária curricular inconsistente: ${totalHours}h. Emissão bloqueada.`, 500);
    }

    const now = new Date();
    const certificate: Certificate = {
      id: crypto.randomUUID(),
      validationCode: `IFIA-2026-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      userId: user.id,
      userName: user.name,
      courseTitle: 'Pré-Curso de Inteligência Artificial',
      totalHours: 200,
      completionDate: now.toISOString().slice(0, 10),
      status: 'valido',
      issuedAt: now.toISOString(),
    } as Certificate;

    if (isRenderEnvironment) {
      // Falha no INSERT é propagada; nunca retornar certificado não persistido.
      await getPgPool().query(
        `INSERT INTO certificates
           (id, validation_code, user_id, course_title, total_hours, completion_date, status, issued_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [certificate.id, certificate.validationCode, certificate.userId,
          certificate.courseTitle, certificate.totalHours, certificate.completionDate,
          certificate.status, certificate.issuedAt]
      );
    } else {
      memoryStore.certificates.set(certificate.id, certificate);
    }

    await this.logAudit(userId, 'CERTIFICATE_ISSUED',
      `certificate:${certificate.validationCode}`, undefined,
      { studentName: user.name, validationCode: certificate.validationCode });
    return { success: true, certificate };
  },

  async issueCertificateIfEligible(
    userId: string, allowOfficialIssuance = false
  ): Promise<{ eligible: boolean; certificate?: Certificate; reason?: string }> {
    const user = await this.findUserById(userId);
    if (!user) return { eligible: false, reason: 'Usuário não localizado.' };

    const approvals = await this.getUserApprovals(userId);
    const validIds = curriculumDisciplineIds();
    const approved = new Set(
      approvals
        .filter((item) => validIds.has(item.disciplineId) && validApproval(item))
        .map((item) => item.disciplineId)
    );

    if (approved.size !== DISCIPLINES.length) {
      return {
        eligible: false,
        reason: `Requisitos incompletos: ${approved.size} de ${DISCIPLINES.length} disciplinas aprovadas com nota mínima 7,0.`,
      };
    }

    if (!allowOfficialIssuance) {
      return { eligible: true, reason: 'Aluno elegível para emissão do certificado.' };
    }

    const result = await this.issueCertificate(userId);
    return { eligible: result.success, certificate: result.certificate, reason: result.reason };
  },

  async listAllCertificates(): Promise<Certificate[]> {
    assertDatabaseAvailable();
    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT c.*, u.name AS user_name FROM certificates c
         JOIN users u ON u.id = c.user_id ORDER BY c.issued_at DESC`
      );
      return result.rows.map(mapCertificate);
    }
    return [...memoryStore.certificates.values()].sort(
      (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
    );
  },

  async listAllStudents(): Promise<Array<{
    id: string; name: string; email: string; registrationNumber?: string;
    role: string; createdAt: string; completedDisciplinesCount: number;
    overallPercent: number; hasCertificate: boolean; certificateCode?: string;
  }>> {
    assertDatabaseAvailable();
    let students: User[];
    if (isRenderEnvironment) {
      const result = await getPgPool().query(
        `SELECT id, name, email, registration_number, role, created_at, updated_at
         FROM users WHERE role = 'aluno' ORDER BY name ASC`
      );
      students = result.rows as User[];
    } else {
      students = [...memoryStore.users.values()].filter((user) => user.role === 'aluno');
    }

    const output = [];
    for (const student of students) {
      const progress = await this.getUserProgress(student.id);
      const approvals = await this.getUserApprovals(student.id);
      const summary = computeAcademicProgressSummary(progress, approvals);
      const certificate = await this.getUserCertificate(student.id);
      output.push({
        id: student.id, name: student.name, email: student.email,
        registrationNumber: student.registration_number, role: student.role,
        createdAt: typeof student.created_at === 'string'
          ? student.created_at : new Date(student.created_at).toISOString(),
        completedDisciplinesCount: summary.completedDisciplinesCount,
        overallPercent: summary.overallPercent,
        hasCertificate: Boolean(certificate),
        certificateCode: certificate?.validationCode,
      });
    }
    return output;
  },

  async getStudentDetailedAcademicRecord(studentId: string): Promise<any> {
    assertDatabaseAvailable();
    const student = await this.findUserById(studentId);
    if (!student) return null;
    const progress = await this.getUserProgress(studentId);
    const approvals = await this.getUserApprovals(studentId);
    const certificate = await this.getUserCertificate(studentId);
    const summary = computeAcademicProgressSummary(progress, approvals);
    return {
      student: {
        id: student.id, name: student.name, email: student.email,
        registrationNumber: student.registration_number, role: student.role,
        createdAt: student.created_at,
      },
      disciplines: summary.disciplines,
      approvedDisciplinesCount: summary.completedDisciplinesCount,
      totalDisciplinesCount: DISCIPLINES.length,
      totalHours: 200,
      hoursCompleted: summary.hoursCompleted,
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