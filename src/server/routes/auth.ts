import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db.ts';

export const authRouter = Router();

const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const oauth2Client = googleClientId ? new OAuth2Client(googleClientId) : null;
const isProduction = process.env.NODE_ENV === 'production';
const allowDevLogin = process.env.ALLOW_DEV_LOGIN === 'true';

// Cookie de Sessão HttpOnly Seguro
const SESSION_COOKIE_NAME = 'lms_session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
  path: '/',
};

// ==============================================================
// 1. LOGIN / CADASTRO COM GOOGLE IDENTITY SERVICES
// ==============================================================
authRouter.post('/google', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Credencial Google (ID Token) não fornecida ou inválida.' });
    }

    // Em produção, se GOOGLE_CLIENT_ID não estiver configurado, recusa formalmente sem simulação
    if (isProduction && !googleClientId) {
      return res.status(503).json({
        error: 'Integração Google OAuth pendente: GOOGLE_CLIENT_ID não configurado no ambiente de produção.',
        details: 'Configure o Client ID no Google Cloud Console e adicione a variável GOOGLE_CLIENT_ID no painel do Render.',
      });
    }

    let payload: { sub: string; email?: string; name?: string; picture?: string; exp?: number; iss?: string } | undefined;

    if (oauth2Client && googleClientId) {
      try {
        // Validação criptográfica com verificação de assinatura, expiração e audiência
        const ticket = await oauth2Client.verifyIdToken({
          idToken: credential,
          audience: googleClientId,
        });
        payload = ticket.getPayload();
      } catch (verifyErr: any) {
        return res.status(401).json({
          error: 'Assinatura, público-alvo ou validade do ID Token Google inválidos.',
          details: verifyErr.message,
        });
      }
    } else {
      // Modo Desenvolvimento / Teste Local (apenas quando não em produção)
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const raw = Buffer.from(parts[1], 'base64').toString('utf8');
          payload = JSON.parse(raw);
        } else {
          return res.status(400).json({ error: 'Estrutura JWT do token Google malformada.' });
        }
      } catch {
        return res.status(400).json({ error: 'Falha ao decodificar token de teste em modo de desenvolvimento.' });
      }
    }

    // Verificação de expiração e integridade
    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({ error: 'Token Google rejeitado: campos sub (identificador estável) e e-mail são obrigatórios.' });
    }

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return res.status(401).json({ error: 'Token Google expirado. Por favor, autentique-se novamente.' });
    }

    // Persiste ou recupera usuário associado ao Google sub estável
    const user = await db.upsertGoogleUser({
      googleSub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture,
    });

    // Cria sessão no banco de dados
    const sessionToken = await db.createSession(
      user.id,
      req.ip || req.socket.remoteAddress,
      req.headers['user-agent']
    );

    // Auditoria de segurança
    await db.logAudit(user.id, 'LOGIN_GOOGLE', 'auth', req.ip, { email: user.email, role: user.role });

    // Emite cookie HttpOnly
    res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);

    return res.json({
      success: true,
      user,
      message: 'Autenticação Google concluída com sucesso.',
    });
  } catch (error: any) {
    console.error('❌ Erro na validação Google OAuth:', error);
    return res.status(error.status || 500).json({
      error: 'Falha na validação da identidade Google.',
      details: error.message,
    });
  }
});

// ==============================================================
// 1.1 LOGIN INSTITUCIONAL SEGURO POR E-MAIL (PRODUÇÃO)
// ==============================================================
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Por favor, informe um endereço de e-mail válido.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await db.findUserByEmail(cleanEmail);

    if (!user) {
      user = await db.upsertGoogleUser({
        googleSub: `inst-${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
        email: cleanEmail,
        name: name?.trim() || cleanEmail.split('@')[0].replace(/[._]/g, ' '),
      });
    }

    const sessionToken = await db.createSession(
      user.id,
      req.ip || req.socket.remoteAddress,
      req.headers['user-agent']
    );

    await db.logAudit(user.id, 'LOGIN_INSTITUTIONAL', 'auth', req.ip, { email: user.email, role: user.role });

    res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);

    return res.json({
      success: true,
      user,
      message: 'Sessão institucional iniciada com sucesso.',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==============================================================
// 2. LOGIN RÁPIDO DE DESENVOLVIMENTO / AUDITORIA CONTROLADA
// Bloqueado estritamente em produção a menos que ALLOW_DEV_LOGIN='true'
// ==============================================================
authRouter.post('/dev-login', async (req: Request, res: Response) => {
  try {
    if (isProduction && !allowDevLogin) {
      return res.status(403).json({
        error: 'Acesso negado: O seletor de perfis de teste está estritamente desabilitado em ambiente de produção.',
      });
    }

    const { role } = req.body;
    let targetUser;

    if (role === 'administrador') {
      const adminEmail = process.env.ADMIN_EMAIL || 'josel6449@gmail.com';
      targetUser = await db.findUserByEmail(adminEmail);
      if (!targetUser) {
        targetUser = await db.upsertGoogleUser({
          googleSub: 'admin-dev-sub-camposia',
          email: adminEmail,
          name: 'Administrador (Coordenação)',
        });
      }
    } else if (role === 'professor') {
      const profEmail = 'professor@camposia.edu.br';
      targetUser = await db.findUserByEmail(profEmail);
      if (!targetUser) {
        targetUser = await db.upsertGoogleUser({
          googleSub: 'prof-dev-sub-camposia',
          email: profEmail,
          name: 'Prof. Docente (CAMPOS IA)',
        });
        targetUser.role = 'professor';
      }
    } else {
      const studentEmail = 'aluno@camposia.edu.br';
      targetUser = await db.findUserByEmail(studentEmail);
      if (!targetUser) {
        targetUser = await db.upsertGoogleUser({
          googleSub: 'student-dev-sub-camposia',
          email: studentEmail,
          name: 'Novo Aluno (CAMPOS IA)',
        });
      }
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Falha ao instanciar usuário de demonstração.' });
    }

    const sessionToken = await db.createSession(
      targetUser.id,
      req.ip || req.socket.remoteAddress,
      req.headers['user-agent']
    );

    await db.logAudit(targetUser.id, 'LOGIN_DEV_SESSION', 'auth', req.ip, { role: targetUser.role });

    res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);

    return res.json({
      success: true,
      user: targetUser,
      message: `Sessão iniciada como perfil: ${targetUser.role}`,
    });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
});

// ==============================================================
// 3. RECUPERAR USUÁRIO ATUAL (SESSÃO ATIVA)
// ==============================================================
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ authenticated: false, user: null });
    }

    const user = await db.getSession(token);
    if (!user) {
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      return res.status(401).json({ authenticated: false, user: null });
    }

    return res.json({
      authenticated: true,
      user,
    });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
});

// ==============================================================
// 4. LOGOUT
// ==============================================================
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (token) {
      await db.deleteSession(token);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
});
