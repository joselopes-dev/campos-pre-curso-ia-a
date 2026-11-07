# Guia de Configuração e Validação do Google OAuth / OIDC (Etapa 2)

Este documento descreve o fluxo de autenticação via **Google Identity Services (GIS)** e **OpenID Connect (OIDC)** implementado na **Plataforma Educacional do Curso Técnico de Nível Médio em Inteligência Artificial**, garantindo conformidade com os requisitos de segurança e implantação no Render.com.

---

## 1. Visão Geral do Fluxo de Autenticação

A aplicação utiliza o SDK oficial **Google Identity Services** no frontend e a biblioteca **`google-auth-library`** no backend (Express):

```
┌─────────────────┐         ┌─────────────────────────┐         ┌───────────────────┐
│   Navegador     │         │      Servidor LMS       │         │   Google OAuth    │
│   (Frontend)    │         │      (Node/Express)     │         │   (Google Cloud)  │
└────────┬────────┘         └────────────┬────────────┘         └─────────┬─────────┘
         │                               │                                │
         │  1. Renderiza Google Button   │                                │
         │───────────────────────────────┼───────────────────────────────>│
         │                               │                                │
         │  2. Usuário seleciona conta   │                                │
         │<──────────────────────────────┼────────────────────────────────│
         │  (Recebe JWT ID Token)        │                                │
         │                               │                                │
         │  3. POST /api/v1/auth/google  │                                │
         │     { credential: "<JWT>" }   │                                │
         │──────────────────────────────>│                                │
         │                               │  4. verifyIdToken (Chave Púb)  │
         │                               │───────────────────────────────>│
         │                               │<───────────────────────────────│
         │                               │                                │
         │                               │  5. Valida sub, exp, aud, iss  │
         │                               │  6. Upsert na tabela 'users'   │
         │                               │  7. Registra sessão 'sessions' │
         │  8. Retorna Sessão            │                                │
         │     Set-Cookie: lms_session   │                                │
         │     (HttpOnly, Secure, Lax)   │                                │
         │<──────────────────────────────│                                │
```

---

## 2. Configuração no Google Cloud Console

Para obter as credenciais reais e habilitar o login em produção:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie ou selecione o projeto do curso (ex: `lms-curso-tecnico-ia`).
3. Vá em **APIs e Serviços** > **Tela de consentimento OAuth**:
   - Tipo de Usuário: **Externo** (ou Interno se possuir Google Workspace institucional).
   - Nome do Aplicativo: `Plataforma Educacional Curso Técnico de IA`.
   - E-mail de suporte e dados de contato do desenvolvedor.
   - Escopos básicos: `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.
4. Vá em **APIs e Serviços** > **Credenciais** > **Criar Credenciais** > **ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Nome: `LMS Curso Técnico IA - Web Client`.

### Origens JavaScript Autorizadas (Crucial para GIS / One Tap)
Adicione as seguintes origens autorizadas (sem barra no final):
- **Desenvolvimento Local:** `http://localhost:3000`
- **Ambiente de Prévia AI Studio:** `https://ais-dev-ftlubsiw2qso7xj6sp3kge-26437322542.us-west1.run.app`
- **Ambiente de Produção Render.com:** `https://seu-servico-lms.onrender.com` (substitua pela URL gerada no painel do Render)
- **Domínio Personalizado:** `https://ia.sua-escola.if.edu.br` (se houver)

### URIs de Redirecionamento Autorizados
Se utilizar o fluxo de redirecionamento ou biblioteca cliente externa:
- `http://localhost:3000/api/v1/auth/google/callback`
- `https://seu-servico-lms.onrender.com/api/v1/auth/google/callback`

---

## 3. Variáveis de Ambiente no Render.com

No painel de controle do serviço web no Render.com (**Environment**), adicione:

| Variável | Valor de Exemplo | Descrição |
| :--- | :--- | :--- |
| `GOOGLE_CLIENT_ID` | `123456789-abcdef.apps.googleusercontent.com` | ID do Cliente público gerado no Google Cloud Console |
| `ADMIN_EMAIL` | `josel6449@gmail.com` | E-mail institucional do Administrador com permissões completas |
| `ALLOW_DEV_LOGIN` | `false` | Em produção, deve ser estritamente `false` para impedir login sem autenticação real |

---

## 4. Regras de Segurança Implementadas no Servidor

1. **Prevenção de Elevação de Privilégios:**
   - Todo usuário que realiza cadastro via Google recebe o perfil padrão estrito de **`aluno`**.
   - O perfil de **`administrador`** só é concedido se o e-mail verificado for rigorosamente idêntico à variável de ambiente `ADMIN_EMAIL`.
2. **Cookies de Sessão Seguros:**
   - O identificador de sessão é armazenado em um cookie `lms_session` com flags `HttpOnly`, `SameSite=Lax` e `Secure=true` (quando em produção), prevenindo ataques XSS.
3. **Identificador Imutável (`sub`):**
   - A identidade é ancorada no identificador numérico imutável `sub` do Google, e não exclusivamente no e-mail, prevenindo sequestro de contas por alteração de alias.
4. **Desativação em Produção sem Credenciais:**
   - Em produção (`NODE_ENV=production`), se `GOOGLE_CLIENT_ID` não estiver definido, o backend rejeita tentativas com erro HTTP 503 claro, impedindo qualquer simulação enganosa.
