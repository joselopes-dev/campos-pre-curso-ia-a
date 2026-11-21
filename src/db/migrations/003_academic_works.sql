-- =====================================================================
-- MIGRAÇÃO 003: TRABALHOS ACADÊMICOS (TABELAS INDEPENDENTES)
-- Aditiva e idempotente: preserva integralmente tabelas e registros existentes.
-- =====================================================================

CREATE TABLE IF NOT EXISTS academic_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    authors TEXT NOT NULL,
    description TEXT,
    work_url TEXT NOT NULL,
    cover_image_url TEXT,
    cover_image_data BYTEA,
    cover_image_mime VARCHAR(64),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_academic_works_created_at ON academic_works(created_at DESC);

CREATE TABLE IF NOT EXISTS academic_works_seed_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    seeded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
