import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { DISCIPLINES, MODULES, getDisciplineLessons } from './seed-data.ts';
import { INITIAL_ACADEMIC_WORKS } from './academic-works-seed.ts';

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

    // Executa arquivo SQL 002 (Orientador Vocacional IA - aditivo e não destrutivo)
    const migration002Path = path.join(__dirname, 'migrations', '002_vocational_counselor.sql');
    if (fs.existsSync(migration002Path)) {
      const sql002 = fs.readFileSync(migration002Path, 'utf8');
      await client.query(sql002);
      console.log('✅ [Migrate] 002_vocational_counselor.sql aplicado.');
    }

    // Executa arquivo SQL 003 (Trabalhos Acadêmicos - aditivo e não destrutivo)
    const migration003Path = path.join(__dirname, 'migrations', '003_academic_works.sql');
    if (fs.existsSync(migration003Path)) {
      const sql003 = fs.readFileSync(migration003Path, 'utf8');
      await client.query(sql003);
      console.log('✅ [Migrate] 003_academic_works.sql aplicado.');

      // Seed inicial único (apenas se nunca foi semeado e tabela está vazia, preservando exclusões/edições futuras)
      const seedCheck = await client.query('SELECT id FROM academic_works_seed_state WHERE id = 1');
      if (seedCheck.rows.length === 0) {
        const countRes = await client.query('SELECT COUNT(*)::int AS total FROM academic_works');
        if ((countRes.rows[0]?.total ?? 0) === 0) {
          for (const item of INITIAL_ACADEMIC_WORKS) {
            await client.query(
              `INSERT INTO academic_works (id, title, authors, description, work_url, cover_image_url, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
               ON CONFLICT (id) DO NOTHING`,
              [item.id, item.title, item.authors, item.description, item.workUrl, item.coverImageUrl, item.createdAt]
            );
          }
          console.log(`✅ [Migrate] Seed inicial de ${INITIAL_ACADEMIC_WORKS.length} trabalhos acadêmicos inserido.`);
        }
        await client.query('INSERT INTO academic_works_seed_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
      }
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

