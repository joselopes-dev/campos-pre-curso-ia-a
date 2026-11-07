import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db.ts';

export const adminRouter = Router();

/**
 * Middleware estrito de controle de acesso (RBAC):
 * Garante que apenas usuários com papel 'professor' ou 'administrador' acessem os recursos.
 * Alunos que tentarem acessar receberão HTTP 403 Forbidden.
 */
async function requireStaffRole(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies['lms_session'];
    if (!token) {
      return res.status(401).json({ error: 'Acesso não autorizado: autenticação obrigatória.' });
    }

    const user = await db.getSession(token);
    if (!user) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    if (user.role !== 'professor' && user.role !== 'administrador') {
      return res.status(403).json({
        error: 'Acesso negado: este módulo administrativo é estritamente restrito a professores e administradores institucionais.',
        role: user.role,
      });
    }

    (req as any).user = user;
    next();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

// Aplica o middleware a todas as rotas administrativas
adminRouter.use(requireStaffRole);

/**
 * 1. Listagem de estudantes cadastrados com progresso consolidado
 */
adminRouter.get('/students', async (req: Request, res: Response) => {
  try {
    const students = await db.listAllStudents();
    return res.json({
      students,
      total: students.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 2. Prontuário acadêmico detalhado de um estudante específico
 */
adminRouter.get('/students/:id/academic-record', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'ID do estudante não informado.' });
    }

    const record = await db.getStudentDetailedAcademicRecord(id);
    if (!record) {
      return res.status(404).json({ error: 'Estudante não localizado na base de registros acadêmicos.' });
    }

    return res.json(record);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 3. Consulta de todos os certificados emitidos na instituição
 */
adminRouter.get('/certificates', async (req: Request, res: Response) => {
  try {
    const certificates = await db.listAllCertificates();
    return res.json({
      certificates,
      total: certificates.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
