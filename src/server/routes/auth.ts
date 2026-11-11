
import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db.ts';

export const authRouter = Router();

const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
const oauth2Client = googleClientId
  ? new OAuth2Client(googleClientId)
  : null;

const isProduction = process.env.NODE_ENV === 'production';
const allowDevLogin =
  !isProduction && process.env.ALLOW_DEV_LOGIN === 'true';

const SESSION_COOKIE_NAME = 'lms_session';

function setSessionCookie(
  req: Request,
  res: Response,
  sessionToken: string
) {
  res.cookie(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: isProduction || req.secure,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/',
  });
}

function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction || req.secure,
    sameSite: 'lax',
    path: '/',
  });
}

function sendAuthError(
  res: Response,
  error: any,
  defaultMessage: string
) {
  const status = Number(error?.status) || 500;

  return res.status(status).json({
    success: false,
    error: defaultMessage,
    code: error?.code || 'AUTHENTICATION_ERROR',
    message: isProduction
      ? 'Não foi possível concluir a autenticação.'
      : error?.message || defaultMessage,
  });
}

// ======================================================
// 1. LOGIN COM GOOGLE — PRODUÇÃO
// ======================================================

authRouter.post('/google', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body || {};

    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Credencial Google não fornecida.',
      });
    }

    if (!oauth2Client || !googleClientId) {
      return res.status(503).json({
        success: false,
        error: 'Login Google não configurado no servidor.',
        code: 'GOOGLE_CLIENT_ID_MISSING',
      });
    }

    // Validação criptográfica real do token Google.
    // Não aceitar JWT apenas decodificado.
    const ticket = await oauth2Client.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({
        success: false,
        error: 'Identidade Google inválida ou incompleta.',
      });
    }

    if (payload.email_verified !== true) {
      return res.status(401).json({
        success: false,
        error: 'O Google não confirmou a verificação deste e-mail.',
      });
    }

    const email = payload.email.trim().toLowerCase();

    // Recupera ou cadastra o usuário no PostgreSQL.
    const user = await db.upsertGoogleUser({
      googleSub: payload.sub,
      email,
      name: payload.name || email.split('@')[0],
      picture: payload.picture,
    });

    if (!user?.id) {
      throw new Error('Não foi possível recuperar ou cadastrar o usuário.');
    }

    // Cria sessão persistente.
    const sessionToken = await db.createSession(
      user.id,
      req.ip || req.socket.remoteAddress,
      req.headers['user-agent']
    );

    if (!sessionToken) {
      throw new Error('Não foi possível criar a sessão do usuário.');
    }

    await db.logAudit(
      user.id,
      'LOGIN_GOOGLE',
      'auth',
      req.ip,
      {
        email: user.email,
        role: user.role,
      }
    );

    setSessionCookie(req, res, sessionToken);

    return res.status(200).json({
      success: true,
      authenticated: true,
      user,
      message: 'Login realizado com sucesso.',
    });

  } catch (error: any) {
    console.error(
      '[AUTH] Falha no login Google:',
      error?.message || 'Erro desconhecido'
    );

    return sendAuthError(
      res,
      error,
      'Não foi possível validar sua conta Google.'
    );
  }
});

// ======================================================
// 2. LOGIN SOMENTE POR E-MAIL
// Não autentica identidade: bloqueado em produção.
// ======================================================

authRouter.post('/login', async (_req: Request, res: Response) => {
  return res.status(403).json({
    success: false,
    error: 'O acesso por e-mail sem validação de identidade está desativado.',
    code: 'EMAIL_ONLY_LOGIN_DISABLED',
    message: 'Utilize o botão Continuar com Google.',
  });
});

// ======================================================
// 3. LOGIN DE DESENVOLVIMENTO
// Disponível somente fora da produção e com autorização.
// ======================================================

authRouter.post('/dev-login', async (req: Request, res: Response) => {
  try {
    if (!allowDevLogin) {
      return res.status(403).json({
        success: false,
        error: 'Login de desenvolvimento desativado.',
      });
    }

    const { role } = req.body || {};

    if (!['aluno', 'professor', 'administrador'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Perfil de desenvolvimento inválido.',
      });
    }

    const emailByRole: Record<string, string> = {
      administrador: process.env.ADMIN_EMAIL || '',
      professor: 'professor@camposia.edu.br',
      aluno: 'aluno@camposia.edu.br',
    };

    const email = emailByRole[role].trim().toLowerCase();

    if (!email) {
      return res.status(503).json({
        success: false,
        error: 'E-mail de administrador não configurado.',
      });
    }

    let user = await db.findUserByEmail(email);

    if (!user) {
      user = await db.upsertGoogleUser({
        googleSub: `dev-${role}-${email}`,
        email,
        name: `Usuário de teste ${role}`,
      });
    }

    if (!user?.id) {
      throw new Error('Não foi possível criar o usuário de teste.');
    }

    const sessionToken = await db.createSession(
      user.id,
      req.ip || req.socket.remoteAddress,
      req.headers['user-agent']
    );

    await db.logAudit(
      user.id,
      'LOGIN_DEV_SESSION',
      'auth',
      req.ip,
      { role: user.role }
    );

    setSessionCookie(req, res, sessionToken);

    return res.json({
      success: true,
      authenticated: true,
      user,
    });

  } catch (error: any) {
    console.error('[AUTH] Erro no login de desenvolvimento:', error);

    return sendAuthError(
      res,
      error,
      'Não foi possível iniciar a sessão de desenvolvimento.'
    );
  }
});

// ======================================================
// 4. RECUPERAR USUÁRIO DA SESSÃO
// ======================================================

authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        authenticated: false,
        user: null,
      });
    }

    const user = await db.getSession(token);

    if (!user) {
      clearSessionCookie(req, res);

      return res.status(401).json({
        authenticated: false,
        user: null,
      });
    }

    return res.json({
      authenticated: true,
      user,
    });

  } catch (error: any) {
    console.error('[AUTH] Erro ao recuperar sessão:', error);

    return sendAuthError(
      res,
      error,
      'Não foi possível recuperar a sessão.'
    );
  }
});

// ======================================================
// 5. ENCERRAR SESSÃO
// ======================================================

authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];

    if (token) {
      await db.deleteSession(token);
    }

    clearSessionCookie(req, res);

    return res.json({
      success: true,
      message: 'Sessão encerrada com sucesso.',
    });

  } catch (error: any) {
    console.error('[AUTH] Erro ao encerrar sessão:', error);

    return sendAuthError(
      res,
      error,
      'Não foi possível encerrar a sessão.'
    );
  }
});

