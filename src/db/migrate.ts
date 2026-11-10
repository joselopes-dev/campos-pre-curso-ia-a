import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { DISCIPLINES, MODULES, getDisciplineLessons } from './seed-data.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega .env
dotenv.config();

const connectionString = process.env.DATABASE_URL;

// Detecção do ambiente de execução Render.com
const isRenderEnvironment = Boolean(
  process.env.RENDER === 'true' ||
  Boolean(process.env.RENDER_SERVICE_ID) ||
  process.env.IS_RENDER === 'true' ||
  process.env.FORCE_MIGRATE === 'true'
);

export async function runMigrations() {
  console.log('🔄 [Migrate] Verificando ambiente para migrações do banco...');

  // Conectar e executar migração de banco exclusivamente no Render
  if (!isRenderEnvironment) {
    console.log('ℹ️ [Migrate] Ambiente local detectado. O banco de dados PostgreSQL é conectado exclusivamente no Render. Migração ignorada no ambiente local.');
    return { success: true, reason: 'LOCAL_SKIP_MIGRATE_RENDER_ONLY' };
  }

  if (!connectionString || connectionString.includes('localhost:5432/lms_ia')) {
    console.warn('⚠️ [Migrate] Executando no Render, porém DATABASE_URL não foi definida. Migração ignorada.');
    return { success: false, reason: 'DATABASE_URL_NOT_SET' };
  }

  console.log('🚀 [Migrate] Ambiente Render detectado. Iniciando conexão e migrações no PostgreSQL...');

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Render PostgreSQL exige SSL com rejectUnauthorized: false
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();

  try {
    console.log('🔌 [Migrate] Conectado ao PostgreSQL com sucesso.');
    await client.query('BEGIN');

    // Executa arquivo SQL 001
    const migrationSqlPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
    if (fs.existsSync(migrationSqlPath)) {
      const sql = fs.readFileSync(migrationSqlPath, 'utf8');
      await client.query(sql);
      console.log('✅ [Migrate] 001_initial_schema.sql aplicado.');
    }

    // Seed dos 20 componentes curriculares
    for (const d of DISCIPLINES) {
      await client.query(
        `INSERT INTO disciplines (id, order_num, code, module_id, title, hours, summary, competencies, local_material_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           order_num = EXCLUDED.order_num,
           code = EXCLUDED.code,
           module_id = EXCLUDED.module_id,
           title = EXCLUDED.title,
           hours = EXCLUDED.hours,
           summary = EXCLUDED.summary,
           competencies = EXCLUDED.competencies,
           local_material_path = EXCLUDED.local_material_path`,
        [
          d.id,
          d.order,
          d.code,
          d.moduleId,
          d.title,
          d.hours,
          d.summary,
          JSON.stringify(d.competencies),
          d.localMaterialPath,
        ]
      );

      // Seed das aulas de cada disciplina (apenas a Aula 01)
      const lessons = getDisciplineLessons(d.id);
      await client.query('DELETE FROM lessons WHERE discipline_id = $1 AND order_num > $2', [d.id, lessons.length]);
      for (const lesson of lessons) {
        await client.query(
          `INSERT INTO lessons (id, discipline_id, order_num, title, summary, steps_config)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             order_num = EXCLUDED.order_num,
             title = EXCLUDED.title,
             summary = EXCLUDED.summary,
             steps_config = EXCLUDED.steps_config`,
          [
            lesson.id,
            d.id,
            lesson.order,
            lesson.title,
            lesson.summary,
            JSON.stringify(lesson.steps),
          ]
        );
      }
    }

    await client.query('COMMIT');
    console.log('✅ [Migrate] Seed dos 20 componentes curriculares e aulas concluído com sucesso.');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [Migrate] Erro ao executar migração:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Execução direta via CLI (npm run migrate)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}