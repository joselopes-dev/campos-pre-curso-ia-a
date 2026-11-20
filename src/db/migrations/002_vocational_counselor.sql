-- =====================================================================
-- MIGRAÇÃO 002: ORIENTADOR VOCACIONAL IA (TABELAS INDEPENDENTES)
-- Aditiva e idempotente: preserva integralmente tabelas e registros existentes.
-- =====================================================================

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
