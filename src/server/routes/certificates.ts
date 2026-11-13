import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { DISCIPLINES } from '../../db/seed-data.ts';
import { generateCertificatePDF } from '../certificate-generator.ts';

export const certificatesRouter = Router();

function getPublicBaseUrl(req: Request): string {
  const configuredUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = (Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto?.split(',')[0]?.trim()) || req.protocol || 'http';
  const host = req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`.replace(/\/+$/, '');
}

function getSessionToken(req: Request): string | undefined {
  return req.cookies?.lms_session;
}

function countValidApprovals(approvals: Array<{ approved: boolean; finalGrade?: number }>): number {
  return approvals.filter((approval) => {
    const grade = Number(approval.finalGrade);
    return approval.approved === true && Number.isFinite(grade) && grade >= 7.0;
  }).length;
}

/** 1. Verificação pública de autenticidade. */
certificatesRouter.get('/verify/:code', async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '').trim();
    if (!code) {
      return res.status(400).json({ valid: false, error: 'Código de autenticidade não informado.' });
    }

    const cert = await db.verifyCertificate(code);
    if (!cert) {
      return res.status(404).json({
        valid: false,
        message: 'Código de autenticidade não localizado na base de registros acadêmicos.',
      });
    }

    return res.json({
      valid: cert.status === 'valido',
      certificate: {
        validationCode: cert.validationCode,
        userName: cert.userName,
        courseTitle: cert.courseTitle,
        totalHours: 200,
        completionDate: cert.completionDate,
        status: cert.status,
        issuedAt: cert.issuedAt,
      },
      institution: 'CAMPOS IA - Plataforma Educacional',
    });
  } catch (error: unknown) {
    console.error('[CERTIFICATES] Falha na verificação pública:', error);
    return res.status(500).json({ valid: false, error: 'Não foi possível verificar o certificado neste momento.' });
  }
});

/** 2. Consulta de certificado e elegibilidade do estudante autenticado. */
certificatesRouter.get('/my', async (req: Request, res: Response) => {
  try {
    const token = getSessionToken(req);
    if (!token) return res.status(401).json({ error: 'Autenticação necessária.' });

    const user = await db.getSession(token);
    if (!user) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });

    const [existingCert, approvals] = await Promise.all([
      db.getUserCertificate(user.id),
      db.getUserApprovals(user.id),
    ]);
    const approvedCount = countValidApprovals(approvals);
    const isEligible = approvedCount >= DISCIPLINES.length;

    return res.json({
      hasCertificate: Boolean(existingCert),
      certificate: existingCert || null,
      eligible: isEligible,
      approvedDisciplinesCount: approvedCount,
      totalDisciplinesCount: DISCIPLINES.length,
      courseTitle: 'Pré-Curso de Inteligência Artificial',
      totalHours: 200,
      studentName: user.name,
      registrationNumber: user.registration_number,
      requirements: [
        'Carga horária total de 200 horas distribuída nos 3 módulos',
        'Aprovação nos 20 componentes curriculares com nota mínima 7,0',
        'Cumprimento das práticas supervisionadas e avaliações finais registradas no servidor',
      ],
    });
  } catch (error: unknown) {
    console.error('[CERTIFICATES] Falha ao consultar certificado do aluno:', error);
    return res.status(500).json({ error: 'Não foi possível consultar os dados do certificado.' });
  }
});

/** 3. Emissão do certificado após validação acadêmica no backend. */
certificatesRouter.post('/issue', async (req: Request, res: Response) => {
  try {
    const token = getSessionToken(req);
    if (!token) return res.status(401).json({ error: 'Autenticação necessária para emitir o certificado.' });

    const user = await db.getSession(token);
    if (!user) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });

    // A função do banco verifica as 20 aprovações com nota mínima 7,0.
    const result = await db.issueCertificate(user.id);
    if (!result.success || !result.certificate) {
      return res.status(400).json({
        success: false,
        error: result.reason || 'Requisitos acadêmicos incompletos para emissão do certificado.',
      });
    }

    return res.json({
      success: true,
      certificate: { ...result.certificate, totalHours: 200 },
      message: 'Certificado emitido e registrado com sucesso!',
    });
  } catch (error: unknown) {
    console.error('[CERTIFICATES] Falha ao emitir certificado:', error);
    return res.status(500).json({ error: 'Não foi possível emitir o certificado neste momento.' });
  }
});

/** 4. Download do PDF: proprietário ou equipe autorizada. */
certificatesRouter.get('/download/:code', async (req: Request, res: Response) => {
  try {
    const token = getSessionToken(req);
    if (!token) return res.status(401).json({ error: 'Autenticação necessária para acessar o documento.' });

    const user = await db.getSession(token);
    if (!user) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });

    const code = String(req.params.code || '').trim();
    if (!code) return res.status(400).json({ error: 'Código de certificado não fornecido.' });

    const cert = await db.verifyCertificate(code);
    if (!cert) return res.status(404).json({ error: 'Certificado não localizado na base de registros acadêmicos.' });

    const isOwner = cert.userId === user.id;
    const isStaff = user.role === 'professor' || user.role === 'administrador';
    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: 'Acesso negado: você não tem permissão para acessar este certificado.' });
    }

    const certStudent = await db.findUserById(cert.userId);
    if (!certStudent) return res.status(404).json({ error: 'Estudante vinculado ao certificado não localizado.' });

    const pdfBuffer = await generateCertificatePDF({
      certificate: { ...cert, totalHours: 200 },
      studentRegistrationNumber: certStudent.registration_number,
      baseUrl: getPublicBaseUrl(req),
    });

    const safeCode = cert.validationCode.replace(/[^a-zA-Z0-9_-]/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Certificado-CAMPOS-IA-${safeCode}.pdf"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(pdfBuffer);
  } catch (error: unknown) {
    console.error('[CERTIFICATES] Falha ao gerar/baixar PDF:', error);
    return res.status(500).json({ error: 'Não foi possível gerar o PDF do certificado neste momento.' });
  }
});
