import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createExpressApp } from './src/server/app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Garante apenas a existência da pasta raiz pública para arquivos estáticos
  // NENHUM arquivo falso (PDF, MP4 ou texto) é criado automaticamente pelo servidor
  const coursesDir = path.resolve(__dirname, 'public/cursos');
  if (!fs.existsSync(coursesDir)) {
    fs.mkdirSync(coursesDir, { recursive: true });
  }

  const app = createExpressApp();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Servir materiais didáticos reais (/cursos) estaticamente
  app.use(
    '/cursos',
    express.static(coursesDir, {
      dotfiles: 'ignore',
      etag: true,
      index: false,
      maxAge: isProd ? '1d' : 0,
    })
  );

  if (!isProd) {
    // Em desenvolvimento: Vite SPA middleware mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('⚡ [Vite] Middleware de desenvolvimento integrado ao Express.');
  } else {
    // Em produção (Render.com): serve arquivos construídos de /dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // Se for uma rota de API ou de arquivo não encontrada, responde 404 JSON ao invés da página HTML
      if (req.path.startsWith('/api/') || req.path.startsWith('/cursos/')) {
        return res.status(404).json({ error: 'Recurso não encontrado no servidor.' });
      }
      const indexPath = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(503).send('Aplicação em inicialização ou compilação pendente. Execute npm run build.');
      }
    });
    console.log(`📦 [Prod] Servindo build estático a partir de: ${distPath}`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎓 CAMPOS IA ativa em http://0.0.0.0:${PORT}`);
    console.log(`🩺 Endpoint de saúde disponível em http://0.0.0.0:${PORT}/api/health`);
    console.log(`📂 Acervo didático local servido a partir de: ${coursesDir}`);
  });
}

startServer().catch((err) => {
  console.error('❌ Falha fatal ao iniciar o servidor:', err);
  process.exit(1);
});
