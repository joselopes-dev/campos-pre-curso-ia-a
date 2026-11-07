-- =====================================================================
-- MIGRAÇÃO 001: ESQUEMA INICIAL DA PLATAFORMA EDUCACIONAL DE IA
-- Compatível com PostgreSQL 14+ (Render.com PostgreSQL gerenciado)
-- =====================================================================

-- Extensão para geração de identificadores UUID caso não exista
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(32) NOT NULL DEFAULT 'aluno' CHECK (role IN ('aluno', 'professor', 'administrador')),
    registration_number VARCHAR(64) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. IDENTIDADES EXTERNAS (GOOGLE OAUTH / OIDC)
CREATE TABLE IF NOT EXISTS external_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL DEFAULT 'google',
    provider_id VARCHAR(255) NOT NULL, -- Identificador estável do Google ('sub')
    email VARCHAR(255) NOT NULL,
    raw_profile_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_provider_external_id UNIQUE(provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_ext_identities_user ON external_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_ext_identities_provider ON external_identities(provider, provider_id);

-- 3. SESSÕES SEGURAS
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) PRIMARY KEY, -- Token de sessão assinado / hash
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 4. MATRIZ CURRICULAR - DISCIPLINAS
CREATE TABLE IF NOT EXISTS disciplines (
    id VARCHAR(64) PRIMARY KEY,
    order_num INTEGER NOT NULL UNIQUE,
    code VARCHAR(32) NOT NULL UNIQUE,
    module_id INTEGER NOT NULL CHECK (module_id IN (1, 2, 3)),
    title VARCHAR(255) NOT NULL,
    hours INTEGER NOT NULL,
    summary TEXT NOT NULL,
    competencies JSONB DEFAULT '[]'::jsonb,
    local_material_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disciplines_module ON disciplines(module_id);
CREATE INDEX IF NOT EXISTS idx_disciplines_order ON disciplines(order_num);

-- 5. AULAS DAS DISCIPLINAS
CREATE TABLE IF NOT EXISTS lessons (
    id VARCHAR(64) PRIMARY KEY,
    discipline_id VARCHAR(64) NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
    order_num INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    steps_config JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_discipline_lesson_order UNIQUE(discipline_id, order_num)
);

CREATE INDEX IF NOT EXISTS idx_lessons_discipline ON lessons(discipline_id);

-- 6. PROGRESSO SEQUENCIAL DO ALUNO
-- Etapas obrigatórias:
-- 1 = Vídeo, 2 = Slides, 3 = PDF, 4 = Teste de Fixação, 5 = Conclusão da Aula
CREATE TABLE IF NOT EXISTS student_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discipline_id VARCHAR(64) NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
    lesson_id VARCHAR(64) NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL CHECK (step_number BETWEEN 1 AND 5),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    quiz_score NUMERIC(4, 2),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_progress_step UNIQUE(user_id, discipline_id, lesson_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_student_progress_user ON student_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_lookup ON student_progress(user_id, discipline_id, lesson_id);

-- 7. AVALIAÇÕES E TESTES DE FIXAÇÃO
CREATE TABLE IF NOT EXISTS quizzes (
    id VARCHAR(64) PRIMARY KEY,
    discipline_id VARCHAR(64) NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
    lesson_id VARCHAR(64) REFERENCES lessons(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    passing_score NUMERIC(4, 2) NOT NULL DEFAULT 7.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id VARCHAR(64) PRIMARY KEY,
    quiz_id VARCHAR(64) NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array com as opções de resposta
    correct_option_index INTEGER NOT NULL, -- Mantido exclusivamente no backend
    explanation TEXT
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id VARCHAR(64) NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    score NUMERIC(4, 2) NOT NULL,
    passed BOOLEAN NOT NULL,
    answers_submitted JSONB NOT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz ON quiz_attempts(user_id, quiz_id);

-- 8. CERTIFICADOS COM CÓDIGO DE AUTENTICIDADE
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_code VARCHAR(32) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    course_title VARCHAR(255) NOT NULL DEFAULT 'Pré-Curso de Inteligência Artificial',
    total_hours INTEGER NOT NULL DEFAULT 200,
    completion_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'valido' CHECK (status IN ('valido', 'revogado')),
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_certificates_validation_code ON certificates(validation_code);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

-- 9. HISTÓRICO DO TUTOR IA
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discipline_id VARCHAR(64) REFERENCES disciplines(id) ON DELETE SET NULL,
    lesson_id VARCHAR(64) REFERENCES lessons(id) ON DELETE SET NULL,
    role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id, created_at);

-- 10. LOGS DE AUDITORIA E SEGURANÇA
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    resource VARCHAR(128) NOT NULL,
    ip_address VARCHAR(64),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- 11. APROVAÇÕES FINAIS POR COMPONENTE CURRICULAR
CREATE TABLE IF NOT EXISTS discipline_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discipline_id VARCHAR(64) NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
    approved BOOLEAN NOT NULL DEFAULT TRUE,
    final_grade NUMERIC(4, 2) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_discipline_approval UNIQUE(user_id, discipline_id)
);

CREATE INDEX IF NOT EXISTS idx_discipline_approvals_user ON discipline_approvals(user_id);

