import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/health.ts';
import { authRouter } from './routes/auth.ts';
import { curriculumRouter } from './routes/curriculum.ts';
import { progressRouter } from './routes/progress.ts';
import { tutorRouter } from './routes/tutor.ts';
import { certificatesRouter } from './routes/certificates.ts';
import { adminRouter } from './routes/admin.ts';

export function createExpressApp(): Express {
  const app = express();

  // Cabeçalhos de Segurança Básicos
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Parsers de Body e Cookies
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // Log de requisições seguro (sem exibir tokens ou payloads sensíveis)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    if (process.env.NODE_ENV !== 'production' && !req.url.startsWith('/@') && !req.url.includes('.')) {
      console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${req.ip || 'local'}`);
    }
    next();
  });

  // 1. Endpoint de Saúde
  app.use('/api/health', healthRouter);

  // 2. Rotas Versionadas da API v1
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/curriculum', curriculumRouter);
  app.use('/api/v1/progress', progressRouter);
  app.use('/api/v1/tutor', tutorRouter);
  app.use('/api/v1/certificates', certificatesRouter);
  app.use('/api/v1/admin', adminRouter);

  // Status resumido do sistema
  app.get('/api/v1/system/status', (_req: Request, res: Response) => {
    res.json({
      online: true,
      stage: 'Modo de Produção Oficial — Plataforma Educacional CAMPOS IA (200 horas)',
      version: '2.0.0',
    });
  });

  // Tratamento Centralizado de Erros
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || 500;
    console.error(`❌ [Server Error] ${req.method} ${req.url}:`, err.message);

    res.status(status).json({
      error: 'Ocorreu um erro no servidor ao processar sua solicitação.',
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor' : err.message,
    });
  });

  return app;
}
