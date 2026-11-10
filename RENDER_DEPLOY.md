Guia de Implantação no Render.com (Produção 100% Funcional)
Este documento orienta a implantação completa, sem erros e segura da CAMPOS IA — Plataforma Educacional do Pré-Curso de Inteligência Artificial (200 Horas) no Render.com.
A aplicação utiliza uma arquitetura unificada full-stack: o backend Express (server.ts) atende os endpoints da API (/api/v1/*), o endpoint de integridade (/api/health), serve os materiais didáticos (/cursos/*) e entrega a Single Page Application (SPA) React compilada em /dist.
1. Arquitetura e Componentes no Render
Componente	Tipo no Render	Configuração / Execução
Web Service Full-Stack	Web Service (Node.js)	Executa server.ts via tsx, servindo a API Express e a SPA React compilada na mesma porta (10000 ou PORT).
Banco de Dados Relacional	Render Postgres / PostgreSQL	Instância PostgreSQL conectada exclusivamente no Render (RENDER=true), garantindo que o ambiente local/preview funcione sem falhas em memória.
Armazenamento Resiliente	Memória (Local) / PostgreSQL (Render)	Em ambiente local e preview, opera em memória sem travar nem tentar conexões de rede. No Render, conecta automaticamente ao PostgreSQL.
Migrações e Seeds	Pre-deploy / CLI no Render	Script src/db/migrate.ts (npm run migrate) que roda no pre-deploy do Render aplicando schemas e os 20 componentes curriculares (10h cada).
Tutor IA & Motor RAG	Módulo Servidor	SDK @google/genai (gemini-3.8-flash e gemini-embedding-2-preview) indexando as 20 disciplinas.
Autenticação	Google Identity & JWT	Validação criptográfica do token ID no backend via google-auth-library e sessões HttpOnly seguras.
2. Comandos Oficiais de Build, Migração e Execução
Comando de Build (Build Command):
Bash
npm install && npm run build
Instala dependências e compila os assets de produção com Vite para a pasta dist/.
Comando de Migração (Pre-deploy Command):
Bash
npm run migrate
Aplica o esquema inicial 001_initial_schema.sql e realiza o seed idempotente (ON CONFLICT) dos 20 componentes curriculares e aulas. Não falha o deploy caso DATABASE_URL ainda não tenha sido preenchida.
Comando de Inicialização (Start Command):
Bash
npm run start
Inicia o servidor Express escutando em 0.0.0.0:${PORT}.
Caminho de Verificação de Saúde (Health Check Path):
Code
/api/health
Retorna HTTP 200 com diagnóstico detalhado em JSON para garantir que o Render aprove a inicialização do container.
3. Matriz de Variáveis de Ambiente no Render
Cadastre as variáveis abaixo na seção Environment do seu Web Service no painel do Render:
Variável	Obrigatória	Valor / Exemplo	Finalidade / Segurança
NODE_ENV	Sim	production	Ativa o modo de produção e otimizações de entrega estática.
PORT	Sim	10000	Porta em que o Express escutará (process.env.PORT).
ALLOW_MEMORY_STORE	Sim	true	Garante que a aplicação funcione imediatamente mesmo antes de conectar o banco PostgreSQL.
DATABASE_URL	Recomendada	postgresql://user:pass@ep-xxxx.neon.tech/neondb?sslmode=require	String de conexão do Neon PostgreSQL ou Render Postgres para persistência definitiva.
ADMIN_EMAIL	Sim	josel6449@gmail.com	E-mail do administrador/coordenador homologado para acesso ao painel de gestão acadêmica.
SESSION_SECRET	Sim	String aleatória (ou generateValue: true)	Chave criptográfica para assinatura de cookies de sessão.
APP_URL	Sim	https://lms-pre-curso-ia.onrender.com	URL pública da sua aplicação no Render.
GOOGLE_CLIENT_ID	Opcional	xxxxxxxxxx.apps.googleusercontent.com	Client ID Web do Google Cloud Console para login via Google.
GEMINI_API_KEY	Recomendada	Chave de API do Google AI Studio	Habilita o Tutor IA com Gemini 3.8 Flash e respostas com contexto RAG.
4. Passo a Passo para Implantação no Render (Em 2 Minutos)
Opção 1 — Usando o Arquivo render.yaml (Blueprint Automático)
Conecte seu repositório no Render.
No menu lateral, clique em Blueprints > New Blueprint Instance.
Selecione o repositório do projeto. O Render lerá o arquivo render.yaml automaticamente, configurando todas as rotas, comandos e variáveis com 1 clique!
Opção 2 — Criando o Web Service Manualmente
No Render Dashboard, clique em New + e selecione Web Service.
Conecte o repositório Git do projeto.
Configure os seguintes campos:
Name: lms-pre-curso-ia
Runtime: Node
Branch: main
Build Command: npm install && npm run build
Pre-deploy Command: npm run migrate
Start Command: npm run start
Plan: Free ou Starter
Clique em Advanced e defina:
Health Check Path: /api/health
Adicione as variáveis de ambiente descritas na tabela da Seção 3.
Clique em Deploy Web Service.
5. Validação da Saúde Pós-Deploy
Após a conclusão da implantação, acesse no navegador:
Code
https://seu-servico.onrender.com/api/health
A resposta JSON esperada:
JSON
{
  "status": "ok",
  "service": "CAMPOS IA - Backend LMS (Pré-Curso de Inteligência Artificial)",
  "environment": "production",
  "renderDeploymentReady": true,
  "database": {
    "status": "ok",
    "engine": "Camada de Dados Relacional Resiliente (Produção)",
    "productionSafe": true,
    "postgres": {
      "configured": true,
      "connected": true,
      "provider": "Neon",
      "sslEnabled": true
    }
  },
  "curriculum": {
    "totalHours": 200,
    "targetHours": 200,
    "hoursIntegrityValid": true,
    "modulesCount": 3,
    "disciplinesCount": 20
  },
  "rag": {
    "configuredEmbeddingModel": "gemini-embedding-2-preview",
    "totalDisciplinesWithMaterials": 20
  }
}