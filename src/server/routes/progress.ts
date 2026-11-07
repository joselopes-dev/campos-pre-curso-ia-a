import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db.ts';
import { DISCIPLINES, getDisciplineLessons } from '../../db/seed-data.ts';
import { User } from '../../types/index.ts';

export const progressRouter = Router();

// Middleware de autenticação obrigatória
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies['lms_session'];
  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado: faça login para acessar seu progresso.' });
  }
  const user = await db.getSession(token);
  if (!user) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida.' });
  }
  (req as any).user = user;
  next();
}

progressRouter.use(requireAuth);

// ==============================================================
// 1. VISÃO GERAL DO PROGRESSO DO ALUNO AUTENTICADO
// ==============================================================
progressRouter.get('/', async (req: Request, res: Response) => {
  try {
    const user: User = (req as any).user;
    const progressList = await db.getUserProgress(user.id);
    const approvals = await db.getUserApprovals(user.id);

    let totalCompletedSteps = 0;
    let totalPossibleSteps = 0;
    let completedDisciplinesCount = 0;
    let inProgressDisciplinesCount = 0;

    const disciplinesProgress = DISCIPLINES.map((d, index) => {
      const lessons = getDisciplineLessons(d.id);
      const disciplinePossibleSteps = lessons.length * 5; // 5 etapas por aula
      totalPossibleSteps += disciplinePossibleSteps;

      // Filtra os passos concluídos para esta disciplina
      const completedSteps = progressList.filter(
        (p) => p.disciplineId === d.id && p.completed
      );
      const completedCount = completedSteps.length;
      totalCompletedSteps += completedCount;

      const percent = Math.min(100, Math.round((completedCount / disciplinePossibleSteps) * 100));

      // Verifica se possui aprovação formal na Avaliação Final de 10 Questões
      const approval = approvals.find((a) => a.disciplineId === d.id && a.approved);

      let status: 'bloqueado' | 'em_andamento' | 'concluido' = 'bloqueado';
      if (approval) {
        status = 'concluido';
        completedDisciplinesCount++;
      } else if (index === 0 || completedCount > 0) {
        status = 'em_andamento';
        inProgressDisciplinesCount++;
      }

      // Verifica se todas as aulas foram concluídas para liberar a Avaliação Final
      const allLessonsCompleted = lessons.every((l) =>
        Boolean(progressList.find((p) => p.lessonId === l.id && p.stepNumber === 5 && p.completed))
      );

      return {
        disciplineId: d.id,
        code: d.code,
        title: d.title,
        moduleId: d.moduleId,
        hours: d.hours,
        status,
        percent,
        completedStepsCount: completedCount,
        totalStepsCount: disciplinePossibleSteps,
        totalLessons: lessons.length,
        allLessonsCompleted,
        finalExamApproved: Boolean(approval),
        finalGrade: approval ? approval.finalGrade : undefined,
      };
    });

    // Cálculo sincronizado com a carga horária de 10h por disciplina (200h totais)
    const hoursCompletedExact = disciplinesProgress.reduce((sum, d) => {
      if (d.status === 'concluido') return sum + d.hours;
      return sum + ((d.completedStepsCount / (d.totalStepsCount || 1)) * d.hours);
    }, 0);

    const hoursCompleted = Math.min(200, Math.round(hoursCompletedExact));
    const overallPercent = Math.min(100, Math.round((hoursCompleted / 200) * 100));

    const activeDiscipline = disciplinesProgress.find((dp) => dp.status === 'em_andamento') || disciplinesProgress[0];

    return res.json({
      overallPercent,
      totalHoursItemized: 200,
      targetHoursOfficial: 200,
      hoursCompleted,
      completedDisciplinesCount,
      inProgressDisciplinesCount,
      totalDisciplinesCount: DISCIPLINES.length,
      nextToResume: {
        disciplineId: activeDiscipline.disciplineId,
        disciplineTitle: activeDiscipline.title,
      },
      disciplines: disciplinesProgress,
      rawProgress: progressList,
      approvals,
    });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
});

// ==============================================================
// 2. CONCLUIR ETAPA DA AULA (COM VERIFICAÇÃO RÍGIDA DE DEPENDÊNCIA)
// ==============================================================
progressRouter.post('/step', async (req: Request, res: Response) => {
  try {
    const user: User = (req as any).user;
    const { disciplineId, lessonId, stepNumber } = req.body;

    if (!disciplineId || !lessonId || !stepNumber) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes: disciplineId, lessonId, stepNumber.' });
    }

    const stepNum = Number(stepNumber);
    const result = await db.completeStep(user.id, disciplineId, lessonId, stepNum);

    if (!result.success) {
      return res.status(403).json(result);
    }

    await db.logAudit(user.id, 'COMPLETE_STEP', 'progress', req.ip, { disciplineId, lessonId, stepNumber: stepNum });

    return res.json(result);
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
});

// ==============================================================
// 3. SUBMETER TESTE DE FIXAÇÃO POR AULA (CORREÇÃO NO SERVIDOR)
// ==============================================================
progressRouter.post('/quiz', async (req: Request, res: Response) => {
  try {
    const user: User = (req as any).user;
    const { disciplineId, lessonId, answers } = req.body;

    if (!disciplineId || !lessonId || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes: disciplineId, lessonId, answers.' });
    }

    const grading = await db.gradeQuiz(user.id, disciplineId, lessonId, answers);

    await db.logAudit(user.id, 'SUBMIT_QUIZ', 'quiz', req.ip, {
      disciplineId,
      lessonId,
      score: grading.score,
      passed: grading.passed,
    });

    return res.json({
      score: grading.score,
      passed: grading.passed,
      minRequiredScore: 7.0,
      feedback: grading.passed
        ? `Parabéns! Você atingiu a nota ${grading.score.toFixed(1)} e liberou a próxima etapa.`
        : `Nota ${grading.score.toFixed(1)} insuficiente (mínimo exigido: 7.0). Revise o material didático e tente novamente.`,
      explanation: grading.explanation,
    });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
});

// ==============================================================
// 4. OBTER QUESTÕES DA AVALIAÇÃO FINAL DO COMPONENTE (10 QUESTÕES)
// ==============================================================
progressRouter.get('/final-exam/:disciplineId', async (req: Request, res: Response) => {
  try {
    const user: User = (req as any).user;
    const { disciplineId } = req.params;

    // Verifica pré-requisito: todas as aulas da disciplina devem estar concluídas
    const lessons = getDisciplineLessons(disciplineId);
    const progressList = await db.getUserProgress(user.id);

    const allLessonsCompleted = lessons.every((l) =>
      Boolean(progressList.find((p) => p.lessonId === l.id && p.stepNumber === 5 && p.completed))
    );

    if (!allLessonsCompleted) {
      return res.status(403).json({
        error: 'Pré-requisitos pendentes: A Avaliação Final de 10 Questões só é liberada após a conclusão integral de todas as aulas desta disciplina.',
        unlocked: false,
      });
    }

    const questions = await db.getDisciplineFinalExamQuestions(disciplineId);
    const approval = await db.getDisciplineApproval(user.id, disciplineId);

    return res.json({
      unlocked: true,
      disciplineId,
      totalQuestions: questions.length,
      passingScore: 7.0,
      approval,
      questions,
    });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
});

// ==============================================================
// 5. SUBMETER AVALIAÇÃO FINAL DO COMPONENTE (CORREÇÃO NO SERVIDOR)
// ==============================================================
progressRouter.post('/final-exam/:disciplineId', async (req: Request, res: Response) => {
  try {
    const user: User = (req as any).user;
    const { disciplineId } = req.params;
    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length !== 10) {
      return res.status(400).json({ error: 'A avaliação final exige exatamente 10 respostas preenchidas.' });
    }

    const result = await db.gradeFinalExam(user.id, disciplineId, answers);
    return res.json(result);
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message });
  }
});
