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

export async function runMigrations() {
  console.log('🔄 [Migrate] Iniciando migrações do banco de dados...');

  if (!connectionString) {
    console.warn('⚠️ [Migrate] DATABASE_URL não definida. Migração em PostgreSQL ignorada.');
    return { success: false, reason: 'DATABASE_URL_NOT_SET' };
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' || connectionString.includes('render.com')
      ? { rejectUnauthorized: false }
      : false,
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

      // Seed das aulas de cada disciplina
      const lessons = getDisciplineLessons(d.id);
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
