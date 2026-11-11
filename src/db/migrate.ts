
import pg from 'pg';
import type { PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import {
  DISCIPLINES,
  getDisciplineLessons
} from './seed-data.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const isRenderEnvironment = Boolean(
  process.env.RENDER === 'true' ||
  process.env.RENDER_SERVICE_ID ||
  process.env.IS_RENDER === 'true'
);

const migrationSqlPath = path.join(
  __dirname,
  'migrations',
  '001_initial_schema.sql'
);

const requiredTables = [
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
  'discipline_approvals'
];

export async function runMigrations() {
  console.log('🔄 [Migrate] Iniciando verificação do PostgreSQL Render...');

  if (!isRenderEnvironment) {
    throw new Error(
      'Migrações permitidas exclusivamente no ambiente Render.'
    );
  }

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL não está configurada no serviço Render.'
    );
  }

  if (!fs.existsSync(migrationSqlPath)) {
    throw new Error(
      `Arquivo SQL não encontrado: ${migrationSqlPath}`
    );
  }

  const migrationSql = fs.readFileSync(
    migrationSqlPath,
    'utf8'
  );

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    max: 3
  });

  let client: PoolClient | undefined;

  try {
    client = await pool.connect();

    console.log('✅ [Migrate] Conexão com PostgreSQL estabelecida.');

    const databaseInfo = await client.query(`
      SELECT
        current_database() AS database,
        current_schema() AS schema
    `);

    console.log(
      `📍 [Migrate] Banco: ${databaseInfo.rows[0].database}`
    );

    await client.query('SET search_path TO public');

    await client.query('BEGIN');

    // Criação das 13 tabelas e respectivos índices.
    await client.query(migrationSql);

    console.log('✅ [Migrate] Arquivo SQL 001 aplicado.');

    // Verifica se todas as tabelas obrigatórias existem.
    const tableResult = await client.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name = ANY($1::text[])
      `,
      [requiredTables]
    );

    const existingTables = new Set(
      tableResult.rows.map(row => row.table_name)
    );

    const missingTables = requiredTables.filter(
      table => !existingTables.has(table)
    );

    if (missingTables.length > 0) {
      throw new Error(
        `Tabelas não criadas: ${missingTables.join(', ')}`
      );
    }

    console.log('✅ [Migrate] As 13 tabelas foram verificadas.');

    // Atualiza os 20 componentes curriculares.
    for (const discipline of DISCIPLINES) {
      await client.query(
        `
          INSERT INTO disciplines (
            id,
            order_num,
            code,
            module_id,
            title,
            hours,
            summary,
            competencies,
            local_material_path
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (id) DO UPDATE SET
            order_num = EXCLUDED.order_num,
            code = EXCLUDED.code,
            module_id = EXCLUDED.module_id,
            title = EXCLUDED.title,
            hours = EXCLUDED.hours,
            summary = EXCLUDED.summary,
            competencies = EXCLUDED.competencies,
            local_material_path = EXCLUDED.local_material_path
        `,
        [
          discipline.id,
          discipline.order,
          discipline.code,
          discipline.moduleId,
          discipline.title,
          discipline.hours,
          discipline.summary,
          JSON.stringify(discipline.competencies),
          discipline.localMaterialPath
        ]
      );

      // Insere ou atualiza as aulas sem excluir aulas existentes.
      const lessons = getDisciplineLessons(discipline.id);

      for (const lesson of lessons) {
        await client.query(
          `
            INSERT INTO lessons (
              id,
              discipline_id,
              order_num,
              title,
              summary,
              steps_config
            )
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (id) DO UPDATE SET
              order_num = EXCLUDED.order_num,
              title = EXCLUDED.title,
              summary = EXCLUDED.summary,
              steps_config = EXCLUDED.steps_config
          `,
          [
            lesson.id,
            discipline.id,
            lesson.order,
            lesson.title,
            lesson.summary,
            JSON.stringify(lesson.steps)
          ]
        );
      }
    }

    await client.query('COMMIT');

    console.log(
      '🎓 [Migrate] Migração concluída: 20 componentes curriculares.'
    );

    return {
      success: true,
      database: databaseInfo.rows[0].database,
      tablesVerified: requiredTables.length,
      disciplinesSeeded: DISCIPLINES.length
    };

  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        console.error('⚠️ [Migrate] Não foi possível executar ROLLBACK.');
      }
    }

    console.error('❌ [Migrate] Falha na migração:', error);

    throw error;

  } finally {
    client?.release();
    await pool.end();
  }
}

// Execução direta pelo comando npm run migrate.
const isDirectExecution = Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  runMigrations()
    .then(result => {
      console.log('✅ Resultado:', result);
      process.exitCode = 0;
    })
    .catch(error => {
      console.error('❌ Migração não concluída:', error.message);
      process.exitCode = 1;
    });
}
