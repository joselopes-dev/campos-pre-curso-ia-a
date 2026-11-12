import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { MODULES, DISCIPLINES, getDisciplineLessons } from '../../db/seed-data.ts';
import { getDisciplineQuiz } from '../../db/fixation-quizzes.ts';

export const curriculumRouter = Router();

// Listar Módulos Acadêmicos
curriculumRouter.get('/modules', (_req: Request, res: Response) => {
  res.json({
    modules: MODULES,
    totalHours: 200,
    modulesBreakdown: {
      modulo1: 60,
      modulo2: 60,
      modulo3: 80,
      sum: 60 + 60 + 80,
    },
  });
});

// Listar 20 Componentes Curriculares em ordem oficial
curriculumRouter.get('/disciplines', (_req: Request, res: Response) => {
  res.json({
    count: DISCIPLINES.length,
    disciplines: DISCIPLINES,
  });
});

// Helper para resolução flexível por ID (disc-01), código (INF-101) ou pasta (01-fundamentos)
function resolveDiscipline(idOrSlug: string) {
  if (!idOrSlug) return undefined;
  const normalized = idOrSlug.trim().toLowerCase();
  return DISCIPLINES.find(
    (d) =>
      d.id.toLowerCase() === normalized ||
      d.code.toLowerCase() === normalized ||
      d.localMaterialPath.toLowerCase().endsWith('/' + normalized) ||
      d.localMaterialPath.toLowerCase().includes(normalized)
  );
}

// Detalhes de um Componente Curricular específico
curriculumRouter.get('/disciplines/:id', (req: Request, res: Response) => {
  const discipline = resolveDiscipline(req.params.id);
  if (!discipline) {
    return res.status(404).json({ error: 'Componente curricular não localizado.' });
  }

  const lessons = getDisciplineLessons(discipline.id);

  // Retorna detalhes protegendo gabaritos
  return res.json({
    discipline,
    lessons,
    module: MODULES.find((m) => m.id === discipline.moduleId),
  });
});

// Aulas de um Componente Curricular
curriculumRouter.get('/disciplines/:id/lessons', (req: Request, res: Response) => {
  const discipline = resolveDiscipline(req.params.id);
  if (!discipline) {
    return res.status(404).json({ error: 'Componente curricular não localizado.' });
  }

  const lessons = getDisciplineLessons(discipline.id);
  return res.json({ lessons });
});

// ==============================================================
// ARQUIVOS INDIVIDUAIS DA DISCIPLINA (ACERVO FÍSICO LOCAL)
// ==============================================================
curriculumRouter.get('/disciplines/:id/files', (req: Request, res: Response) => {
  const discipline = resolveDiscipline(req.params.id);
  if (!discipline) {
    return res.status(404).json({ error: 'Componente curricular não localizado.' });
  }

  const folderPath = path.resolve(process.cwd(), 'public' + discipline.localMaterialPath);
  if (!fs.existsSync(folderPath)) {
    return res.json({
      disciplineId: discipline.id,
      disciplineCode: discipline.code,
      disciplineTitle: discipline.title,
      files: [],
    });
  }

  try {
    const fileNames = fs.readdirSync(folderPath);
    const files = fileNames
      .filter((name) => !name.startsWith('.'))
      .map((name) => {
        const fullFilePath = path.join(folderPath, name);
        const stats = fs.statSync(fullFilePath);
        const ext = path.extname(name).toLowerCase();

        let type: 'pdf' | 'text' | 'markdown' | 'video' = 'text';
        if (ext === '.pdf') type = 'pdf';
        else if (ext === '.md') type = 'markdown';
        else if (ext === '.txt') type = 'text';
        else if (ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.mkv') type = 'video';

        // Título amigável e descrição pedagógica
        let label = name;
        let description = 'Arquivo técnico disponível no acervo acadêmico.';

        if (ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.mkv') {
          label = `Vídeo-Aula (${name})`;
          description = 'Arquivo de vídeo oficial da aula para reprodução multimídia direta.';
        } else if (name.startsWith('slides-') && ext === '.pdf') {
          label = `Slides de Apresentação (${name.replace('.pdf', '')} — PDF)`;
          description = 'Lâminas conceituais, diagramas de fluxo e esquemas visuais da aula.';
        } else if ((name.startsWith('apostila-aula-') || name.startsWith('apostila-d')) && ext === '.pdf') {
          label = `Apostila Didática da Aula (${name.replace('.pdf', '')} — PDF)`;
          description = 'Fundamentação teórica, tutoriais de código e exercícios práticos da aula.';
        } else if ((name.startsWith('apostila-aula-') || name.startsWith('apostila-d')) && ext === '.txt') {
          label = `Apostila em Texto Integral (${name.replace('.txt', '')} — TXT)`;
          description = 'Versão textual pura formatada para leitura direta no navegador e acessibilidade.';
        } else if (name.startsWith('apostila-') && ext === '.pdf') {
          label = `Livro Técnico Completo da Disciplina (${discipline.code} — PDF)`;
          description = `Compêndio pedagógico integral com todas as seções e bibliografia de ${discipline.title}.`;
        } else if (name.startsWith('material-estudo') && ext === '.txt') {
          label = 'Material Oficial de Estudo (TXT)';
          description = 'Anotações conceituais estruturadas, objetivos pedagógicos e resumo temático da disciplina.';
        } else if (name === 'README.md') {
          label = 'Ementa & Plano de Ensino Oficial (Markdown)';
          description = 'Diretrizes curriculares, competências técnicas e plano instrucional.';
        }

        const formattedSize =
          stats.size > 1024 * 1024
            ? `${(stats.size / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.round(stats.size / 1024)} KB`;

        return {
          name,
          url: `${discipline.localMaterialPath}/${name}`,
          downloadUrl: `/api/v1/curriculum/disciplines/${discipline.id}/download?filename=${encodeURIComponent(name)}`,
          size: stats.size,
          formattedSize,
          type,
          label,
          description,
        };
      })
      .sort((a, b) => {
        // Ordena: Vídeos, Slides, Apostila da Aula (PDF), Apostila da Aula (TXT), Livro Completo, Materiais e README
        const getWeight = (file: { name: string; type: string }) => {
          if (file.type === 'video') return 0;
          if (file.name.startsWith('slides-')) return 1;
          if ((file.name.startsWith('apostila-aula-') || file.name.startsWith('apostila-d')) && file.name.endsWith('.pdf')) return 2;
          if ((file.name.startsWith('apostila-aula-') || file.name.startsWith('apostila-d')) && file.name.endsWith('.txt')) return 3;
          if (file.name.startsWith('apostila-') && file.name.endsWith('.pdf')) return 4;
          if (file.name.startsWith('material-estudo')) return 5;
          return 6;
        };

        const weightA = getWeight(a);
        const weightB = getWeight(b);
        if (weightA !== weightB) return weightA - weightB;
        return a.name.localeCompare(b.name);
      });

    return res.json({
      disciplineId: discipline.id,
      disciplineCode: discipline.code,
      disciplineTitle: discipline.title,
      localMaterialPath: discipline.localMaterialPath,
      totalFiles: files.length,
      files,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao inspecionar arquivos da disciplina: ' + err.message });
  }
});

// ==============================================================
// DOWNLOAD DIRETO DE ARQUIVO DA DISCIPLINA
// ==============================================================
curriculumRouter.get('/disciplines/:id/download', (req: Request, res: Response) => {
  const discipline = resolveDiscipline(req.params.id);
  if (!discipline) {
    return res.status(404).json({ error: 'Componente curricular não localizado.' });
  }

  const rawFilename = (req.query.filename || req.query.file) as string;
  if (!rawFilename) {
    return res.status(400).json({ error: 'Parâmetro filename obrigatório.' });
  }

  // Prevenção de Path Traversal
  const safeFilename = path.basename(rawFilename);
  const folderPath = path.resolve(process.cwd(), 'public' + discipline.localMaterialPath);
  const fullFilePath = path.join(folderPath, safeFilename);

  if (!fullFilePath.startsWith(folderPath) || !fs.existsSync(fullFilePath)) {
    return res.status(404).json({ error: `Arquivo '${safeFilename}' não encontrado no acervo da disciplina.` });
  }

  // Força download com Content-Disposition attachment e nome correto do arquivo
  return res.download(fullFilePath, safeFilename, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: 'Erro ao transferir arquivo: ' + err.message });
    }
  });
});

// ==============================================================
// LEITURA DO CONTEÚDO DE ARQUIVO TEXTUAL/MARKDOWN DA DISCIPLINA
// ==============================================================
curriculumRouter.get('/disciplines/:id/file-content', (req: Request, res: Response) => {
  const discipline = resolveDiscipline(req.params.id);
  if (!discipline) {
    return res.status(404).json({ error: 'Componente curricular não localizado.' });
  }

  const rawFilename = req.query.filename as string;
  if (!rawFilename) {
    return res.status(400).json({ error: 'Parâmetro filename obrigatório.' });
  }

  // Prevenção de Path Traversal
  const safeFilename = path.basename(rawFilename);
  const folderPath = path.resolve(process.cwd(), 'public' + discipline.localMaterialPath);
  const fullFilePath = path.join(folderPath, safeFilename);

  if (!fullFilePath.startsWith(folderPath) || !fs.existsSync(fullFilePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado no acervo da disciplina.' });
  }

  const ext = path.extname(safeFilename).toLowerCase();
  const fileUrl = `${discipline.localMaterialPath}/${safeFilename}`;

  if (ext === '.pdf') {
    return res.json({
      filename: safeFilename,
      url: fileUrl,
      type: 'pdf',
      isBinary: true,
    });
  }

  try {
    const content = fs.readFileSync(fullFilePath, 'utf8');
    const lines = content.split('\n');
    return res.json({
      filename: safeFilename,
      url: fileUrl,
      type: ext === '.md' ? 'markdown' : 'text',
      content,
      linesCount: lines.length,
      charactersCount: content.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao ler arquivo: ' + err.message });
  }
});

// ==============================================================
// QUESTÕES DE FIXAÇÃO PERSONALIZADAS PARA QUALQUER AULA
// ==============================================================
curriculumRouter.get('/disciplines/:id/lessons/:lessonId/quiz', (req: Request, res: Response) => {
  const discipline = DISCIPLINES.find((d) => d.id === req.params.id);
  if (!discipline) {
    return res.status(404).json({ error: 'Componente curricular não localizado.' });
  }

  const lessons = getDisciplineLessons(discipline.id);
  const currentLesson = lessons.find((l) => l.id === req.params.lessonId) || lessons[0];

  const questions = getLessonQuizQuestions(discipline, currentLesson);

  return res.json({
    disciplineId: discipline.id,
    lessonId: currentLesson.id,
    lessonTitle: currentLesson.title,
    questions,
  });
});

function getLessonQuizQuestions(discipline: any, lesson: any) {
  const quiz = getDisciplineQuiz(discipline?.id) || getDisciplineQuiz(discipline?.code) || getDisciplineQuiz(lesson?.id);
  if (quiz && quiz.questions && quiz.questions.length > 0) {
    return quiz.questions;
  }

  // Fallback seguro caso não localizado
  return [
    {
      question: `1. No contexto do componente ${discipline.title}, qual é o princípio orientador fundamental da organização modular e estruturada?`,
      options: [
        'Garantir desacoplamento dos módulos, reprodutibilidade técnica e manutenção escalável dos modelos.',
        'Eliminar a necessidade de validação e testes dos dados.',
        'Tornar o pipeline dependente estritamente de uma única ferramenta proprietária.',
      ],
    },
    {
      question: `2. Considerando as competências técnicas da ${lesson?.title || discipline.title}, qual a diretriz mandatória de segurança e integridade operacional?`,
      options: [
        'Executar todas as chamadas críticas no servidor com tratamento rigoroso de exceções e credenciais protegidas.',
        'Expor credenciais de banco e chaves de APIs no cliente frontend.',
        'Permitir que agentes de IA alterem estados do sistema sem controle de acesso.',
      ],
    },
    {
      question: `3. Por que a verificação de requisitos e progressão acadêmica é implementada no backend da plataforma CAMPOS IA?`,
      options: [
        'Para assegurar a integridade do percurso formativo e impedir bypass de etapas no cliente.',
        'Apenas para aumentar a latência de rede nas requisições HTTP.',
        'Porque os navegadores não suportam verificação condicional de regras.',
      ],
    },
  ];
}

