import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { DISCIPLINES } from '../../db/seed-data.ts';
import { generateCertificatePDF } from '../certificate-generator.ts';

export const certificatesRouter = Router();

/**
 * 1. Verificação pública de autenticidade de certificado (acessível sem autenticação)
 */
certificatesRouter.get('/verify/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code || !code.trim()) {
      return res.status(400).json({ valid: false, error: 'Código de autenticidade não informado.' });
    }

    const cert = await db.verifyCertificate(code.trim());
    if (!cert) {
      return res.status(404).json({
        valid: false,
        message: 'Código de autenticidade não localizado na base oficial de registros acadêmicos.',
      });
    }

    return res.json({
      valid: cert.status === 'valido',
      certificate: {
        validationCode: cert.validationCode,
        userName: cert.userName,
        courseTitle: cert.courseTitle,
        totalHours: cert.totalHours,
        completionDate: cert.completionDate,
        status: cert.status,
        issuedAt: cert.issuedAt,
      },
      institution: 'Instituto Federal de Educação, Ciência e Tecnologia - Pré-Curso de IA',
    });
  } catch (error: any) {
    return res.status(500).json({ valid: false, error: error.message });
  }
});

/**
 * 2. Consulta de certificados e elegibilidade do aluno autenticado
 */
certificatesRouter.get('/my', async (req: Request, res: Response) => {
  try {
    const token = req.cookies['lms_session'];
    if (!token) {
      return res.status(401).json({ error: 'Autenticação necessária.' });
    }

    const user = await db.getSession(token);
    if (!user) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    // Busca certificado existente (se já tiver sido emitido)
    const existingCert = await db.getUserCertificate(user.id);

    // Consulta aprovações para calcular elegibilidade
    const approvals = await db.getUserApprovals(user.id);
    const approvedCount = approvals.filter(
      (a) => a.approved && (a.finalGrade === undefined || a.finalGrade >= 7.0)
    ).length;

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
        'Carga horária total de 200 horas distribuída nos 3 módulos (10h por disciplina)',
        'Aprovação nos 20 componentes curriculares com nota mínima 7,0',
        'Cumprimento das práticas supervisionadas e avaliações finais no servidor',
      ],
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 3. Emissão oficial do certificado PDF pelo estudante autenticado
 * Validação rigorosa no backend: exige aprovação nos 20 componentes com nota mínima 7,0
 */
certificatesRouter.post('/issue', async (req: Request, res: Response) => {
  try {
    const token = req.cookies['lms_session'];
    if (!token) {
      return res.status(401).json({ error: 'Autenticação necessária para emitir o certificado.' });
    }

    const user = await db.getSession(token);
    if (!user) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    // Tenta emitir o certificado pelo backend
    const result = await db.issueCertificate(user.id);

    if (!result.success || !result.certificate) {
      return res.status(400).json({
        success: false,
        error: result.reason || 'Requisitos acadêmicos incompletos para emissão do certificado.',
      });
    }

    return res.json({
      success: true,
      certificate: result.certificate,
      message: 'Certificado de Conclusão emitido com sucesso e registrado na base acadêmica institucional!',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 4. Download / visualização do arquivo PDF oficial do certificado
 * Apenas o proprietário do certificado ou professores/administradores têm autorização.
 */
certificatesRouter.get('/download/:code', async (req: Request, res: Response) => {
  try {
    const token = req.cookies['lms_session'];
    if (!token) {
      return res.status(401).json({ error: 'Autenticação necessária para acessar o documento.' });
    }

    const user = await db.getSession(token);
    if (!user) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ error: 'Código de certificado não fornecido.' });
    }

    const cert = await db.verifyCertificate(code);
    if (!cert) {
      return res.status(404).json({ error: 'Certificado não localizado na base de registros acadêmicos.' });
    }

    // Controle de acesso: o estudante só pode baixar o seu próprio certificado
    const isOwner = cert.userId === user.id;
    const isStaff = user.role === 'professor' || user.role === 'administrador';

    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: 'Acesso negado: você não tem permissão para acessar o certificado de outro estudante.' });
    }

    const certStudent = await db.findUserById(cert.userId);
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const pdfBuffer = await generateCertificatePDF({
      certificate: cert,
      studentRegistrationNumber: certStudent?.registration_number || user.registration_number,
      baseUrl,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Certificado-IA-${cert.validationCode}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    return res.send(pdfBuffer);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
