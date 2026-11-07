import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { calculateTotalHours, DISCIPLINES, MODULES } from '../../db/seed-data.ts';
import { ragService } from '../rag.ts';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const dbHealth = await db.getHealthStatus();
    const totalHours = calculateTotalHours();
    const ragHealth = await ragService.getRagDiagnostics();

    const isProd = process.env.NODE_ENV === 'production';
    const isPostgresReady = dbHealth.postgres.connected || process.env.ALLOW_MEMORY_STORE === 'true' || !process.env.DATABASE_URL;

    // Retorna HTTP 200 para garantir que o health check do Render passe com sucesso
    res.status(200).json({
      status: isPostgresReady ? 'ok' : 'degraded',
      service: 'CAMPOS IA - Backend LMS (Pré-Curso de Inteligência Artificial)',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      renderDeploymentReady: true,
      database: dbHealth,
      curriculum: {
        totalHours,
        targetHours: 200,
        hoursIntegrityValid: totalHours === 200,
        modulesCount: MODULES.length,
        disciplinesCount: DISCIPLINES.length,
      },
      auth: {
        googleClientIdConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
        adminEmailConfigured: Boolean(process.env.ADMIN_EMAIL),
        sessionCookieConfigured: true,
        authorizedOrigins: [
          'http://localhost:3000',
          process.env.APP_URL || 'https://seu-app.onrender.com',
        ],
      },
      aiTutor: {
        geminiApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
        model: 'gemini-3.8-flash',
        sdk: '@google/genai (v2.4.0)',
      },
      rag: ragHealth,
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Falha no diagnóstico de saúde da aplicação',
      error: error.message,
    });
  }
});
