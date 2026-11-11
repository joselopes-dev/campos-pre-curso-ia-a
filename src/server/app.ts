
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

  // Configuração necessária para HTTPS atrás do proxy do Render
  app.set('trust proxy', 1);

  // Segurança básica
  app.disable('x-powered-by');

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Parsers
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // Log seguro
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (
      process.env.NODE_ENV !== 'production' &&
      !req.url.startsWith('/@') &&
      !req.url.includes('.')
    ) {
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path}`
      );
    }

    next();
  });

  // Saúde
  app.use('/api/health', healthRouter);

  // Autenticação
  app.use('/api/v1/auth', authRouter);

  // APIs da plataforma
  app.use('/api/v1/curriculum', curriculumRouter);
  app.use('/api/v1/progress', progressRouter);
  app.use('/api/v1/tutor', tutorRouter);
  app.use('/api/v1/certificates', certificatesRouter);
  app.use('/api/v1/admin', adminRouter);

  // Status
  app.get('/api/v1/system/status', (_req: Request, res: Response) => {
    res.json({
      online: true,
      stage: 'Modo de Produção Oficial — Plataforma Educacional CAMPOS IA (200 horas)',
      version: '2.0.0',
    });
  });

  // Erros centralizados
  app.use((
    err: any,
    req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    const status = err.status || err.statusCode || 500;

    console.error(
      `❌ [Server Error] ${req.method} ${req.path}:`,
      err.message
    );

    res.status(status).json({
      error: 'Ocorreu um erro no servidor ao processar sua solicitação.',
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Erro interno do servidor'
          : err.message,
    });
  });

  return app;
}
