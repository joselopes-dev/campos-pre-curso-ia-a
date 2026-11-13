import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Certificate } from '../types/index.ts';

export interface GenerateCertificateOptions {
  certificate: Certificate;
  studentRegistrationNumber?: string;
  baseUrl?: string;
}

/** Gera o certificado PDF A4 paisagem com QR Code de validação pública. */
export async function generateCertificatePDF(options: GenerateCertificateOptions): Promise<Buffer> {
  const { certificate, studentRegistrationNumber } = options;
  const configuredBaseUrl = options.baseUrl || process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
  const baseUrl = configuredBaseUrl.replace(/\/+$/, '');
  const validationCode = encodeURIComponent(certificate.validationCode);
  const verifyUrl = `${baseUrl}/api/v1/certificates/verify/${validationCode}`;
  const qrCodeBuffer = await QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: 'H', margin: 1, width: 140,
    color: { dark: '#004d25', light: '#ffffff' },
  });

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        layout: 'landscape', size: 'A4',
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        info: {
          Title: `Certificado de Conclusão - ${certificate.userName}`,
          Author: 'CAMPOS IA',
          Subject: certificate.courseTitle,
          Keywords: 'Certificado, Inteligência Artificial, CAMPOS IA',
          CreationDate: certificate.issuedAt ? new Date(certificate.issuedAt) : new Date(),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = 841.89;
      const pageHeight = 595.28;
      const totalHours = 200;

      // 1. Fundo e moldura.
      doc.rect(20, 20, pageWidth - 40, pageHeight - 40).lineWidth(3).strokeColor('#004d25').stroke();
      doc.rect(26, 26, pageWidth - 52, pageHeight - 52).lineWidth(1).strokeColor('#b48c36').stroke();
      [
        { x: 30, y: 30 }, { x: pageWidth - 45, y: 30 },
        { x: 30, y: pageHeight - 45 }, { x: pageWidth - 45, y: pageHeight - 45 },
      ].forEach((corner) => doc.rect(corner.x, corner.y, 15, 15).fillColor('#004d25').fill());

      // 2. Cabeçalho mantido conforme o modelo fornecido.
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#004d25')
        .text('REPÚBLICA FEDERATIVA DO BRASIL', { align: 'center', characterSpacing: 1.5 });
      doc.font('Helvetica').fontSize(8.5).fillColor('#333333')
        .text('MINISTÉRIO DA EDUCAÇÃO', { align: 'center', characterSpacing: 1 });
      doc.font('Helvetica').fontSize(8).fillColor('#555555')
        .text('REDE FEDERAL DE EDUCAÇÃO PROFISSIONAL, CIENTÍFICA E TECNOLÓGICA', { align: 'center' });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#004d25')
        .text('INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA', { align: 'center' });

      doc.moveDown(0.5);
      doc.moveTo(180, doc.y).lineTo(pageWidth - 180, doc.y).lineWidth(1).strokeColor('#b48c36').stroke();
      doc.moveDown(0.9);
      doc.font('Helvetica-Bold').fontSize(24).fillColor('#004d25')
        .text('CERTIFICADO DE CONCLUSÃO', { align: 'center', characterSpacing: 2 });
      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#b48c36')
        .text('HABILITAÇÃO PROFISSIONAL TÉCNICA DE NÍVEL MÉDIO', { align: 'center', characterSpacing: 1 });

      // 3. Corpo: carga horária do curso mantida em 200 horas.
      doc.moveDown(1.1);
      const regText = studentRegistrationNumber
        ? `sob a Matrícula Institucional nº ${studentRegistrationNumber}`
        : `código de cadastro nº ${certificate.userId.slice(0, 12)}`;
      const completionDateFormatted = (() => {
        const rawDate = String(certificate.completionDate || '');
        const parts = rawDate.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        const parsed = new Date(rawDate);
        return Number.isNaN(parsed.getTime()) ? rawDate : parsed.toLocaleDateString('pt-BR');
      })();
      const paragraph = `Certificamos que, para os devidos fins, o(a) estudante ${certificate.userName.toUpperCase()}, portador(a) do registro acadêmico ${regText}, concluiu com aproveitamento os 20 componentes curriculares do ${certificate.courseTitle.toUpperCase()}, perfazendo uma carga horária de ${totalHours.toLocaleString('pt-BR')} horas.`;
      doc.font('Helvetica').fontSize(12).fillColor('#222222')
        .text(paragraph, 80, doc.y, { align: 'justify', lineGap: 4, width: pageWidth - 160 });

      // 4. QR Code e dados de autenticação.
      const bottomY = pageHeight - 160;
      doc.image(qrCodeBuffer, 80, bottomY - 5, { width: 95, height: 95 });
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#004d25')
        .text('AUTENTICIDADE REGISTRADA', 185, bottomY + 5);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#222222')
        .text('Chave: ', 185, bottomY + 20, { continued: true })
        .font('Courier-Bold').fillColor('#004d25').text(certificate.validationCode);
      doc.font('Helvetica').fontSize(7.5).fillColor('#555555')
        .text(`Data de Emissão: ${completionDateFormatted}`, 185, bottomY + 33)
        .text('Consulte a verificação pública apontando', 185, bottomY + 45)
        .text('a câmera para o QR Code ou acesse:', 185, bottomY + 55)
        .font('Helvetica-Oblique').fontSize(6.5).fillColor('#004d25')
        .text(verifyUrl, 185, bottomY + 67, { width: 205, ellipsis: true });

      // 5. Linhas de assinatura do modelo original.
      const sigLineY = bottomY + 45;
      const sigCol1X = 400;
      const sigCol2X = 610;
      const sigLineWidth = 180;
      doc.moveTo(sigCol1X, sigLineY).lineTo(sigCol1X + sigLineWidth, sigLineY)
        .lineWidth(0.8).strokeColor('#555555').stroke();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#222222')
        .text('Coordenação do Curso', sigCol1X, sigLineY + 6, { width: sigLineWidth, align: 'center' });
      doc.font('Helvetica').fontSize(6.5).fillColor('#666666')
        .text('Pré-Curso de Inteligência Artificial', sigCol1X, sigLineY + 16, { width: sigLineWidth, align: 'center' })
        .text('Assinatura / Designação', sigCol1X, sigLineY + 26, { width: sigLineWidth, align: 'center' });

      doc.moveTo(sigCol2X, sigLineY).lineTo(sigCol2X + sigLineWidth, sigLineY)
        .lineWidth(0.8).strokeColor('#555555').stroke();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#222222')
        .text('Responsável pelo Registro', sigCol2X, sigLineY + 6, { width: sigLineWidth, align: 'center' });
      doc.font('Helvetica').fontSize(6.5).fillColor('#666666')
        .text('Controle e Registro Acadêmico', sigCol2X, sigLineY + 16, { width: sigLineWidth, align: 'center' })
        .text('Assinatura / Designação', sigCol2X, sigLineY + 26, { width: sigLineWidth, align: 'center' });

      // 6. Rodapé sem declarar assinatura digital inexistente.
      doc.font('Helvetica').fontSize(6.5).fillColor('#888888')
        .text(
          `Documento gerado pela plataforma CAMPOS IA. Validação pública pela chave ${certificate.validationCode}.`,
          40, pageHeight - 33, { align: 'center', width: pageWidth - 80 }
        );
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
