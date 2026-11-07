import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Certificate } from '../types/index.ts';

export interface GenerateCertificateOptions {
  certificate: Certificate;
  studentRegistrationNumber?: string;
  baseUrl?: string;
}

/**
 * Gera um arquivo PDF vetorial padrão institucional para o Certificado de Conclusão de Curso.
 * Utiliza formato Paisagem (A4 - 841.89 x 595.28 pt) com bordas ornamentadas, selo institucional,
 * QR Code de validação pública e linhas para assinaturas institucionais oficiais.
 */
export async function generateCertificatePDF(options: GenerateCertificateOptions): Promise<Buffer> {
  const { certificate, studentRegistrationNumber, baseUrl = 'http://localhost:3000' } = options;

  // Gera o QR Code binário (PNG Buffer) para verificação pública
  const verifyUrl = `${baseUrl}/api/v1/certificates/verify/${certificate.validationCode}`;
  const qrCodeBuffer = await QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 140,
    color: {
      dark: '#004d25',
      light: '#ffffff',
    },
  });

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        layout: 'landscape',
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        info: {
          Title: `Certificado de Conclusão - ${certificate.userName}`,
          Author: 'Instituto Federal de Educação, Ciência e Tecnologia',
          Subject: certificate.courseTitle,
          Keywords: 'Certificado, Inteligência Artificial, Pré-Curso, IF',
          CreationDate: new Date(certificate.issuedAt),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = 841.89;
      const pageHeight = 595.28;

      // 1. FUNDO E MOLDURA INSTITUCIONAL ORNAMENTADA
      // Moldura externa verde institucional
      doc.rect(20, 20, pageWidth - 40, pageHeight - 40)
        .lineWidth(3)
        .strokeColor('#004d25')
        .stroke();

      // Moldura interna dourada
      doc.rect(26, 26, pageWidth - 52, pageHeight - 52)
        .lineWidth(1)
        .strokeColor('#b48c36')
        .stroke();

      // Detalhes nos quatro cantos (ornamentos geométricos clássicos)
      const corners = [
        { x: 30, y: 30 },
        { x: pageWidth - 45, y: 30 },
        { x: 30, y: pageHeight - 45 },
        { x: pageWidth - 45, y: pageHeight - 45 },
      ];
      corners.forEach((c) => {
        doc.rect(c.x, c.y, 15, 15).fillColor('#004d25').fill();
      });

      // 2. CABEÇALHO INSTITUCIONAL OFICIAL
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#004d25')
        .text('REPÚBLICA FEDERATIVA DO BRASIL', { align: 'center', characterSpacing: 1.5 });

      doc.font('Helvetica')
        .fontSize(8.5)
        .fillColor('#333333')
        .text('MINISTÉRIO DA EDUCAÇÃO', { align: 'center', characterSpacing: 1 });

      doc.font('Helvetica')
        .fontSize(8)
        .fillColor('#555555')
        .text('REDE FEDERAL DE EDUCAÇÃO PROFISSIONAL, CIENTÍFICA E TECNOLÓGICA', { align: 'center' });

      doc.font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#004d25')
        .text('INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA', { align: 'center' });

      // Linha separadora decorativa
      doc.moveDown(0.5);
      doc.moveTo(180, doc.y)
        .lineTo(pageWidth - 180, doc.y)
        .lineWidth(1)
        .strokeColor('#b48c36')
        .stroke();

      // 3. TÍTULO DO CERTIFICADO
      doc.moveDown(0.9);
      doc.font('Helvetica-Bold')
        .fontSize(24)
        .fillColor('#004d25')
        .text('CERTIFICADO DE CONCLUSÃO', { align: 'center', characterSpacing: 2 });

      doc.moveDown(0.4);
      doc.font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#b48c36')
        .text('HABILITAÇÃO PROFISSIONAL TÉCNICA DE NÍVEL MÉDIO', { align: 'center', characterSpacing: 1 });

      // 4. CORPO DO TEXTO DO CERTIFICADO
      doc.moveDown(1.1);

      const regText = studentRegistrationNumber ? `sob a Matrícula Institucional nº ${studentRegistrationNumber}` : `código de cadastro nº ${certificate.userId.slice(0, 12)}`;
      
      const completionDateFormatted = (() => {
        try {
          const parts = certificate.completionDate.split('-');
          if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          return new Date(certificate.completionDate).toLocaleDateString('pt-BR');
        } catch {
          return certificate.completionDate;
        }
      })();

      const paragraph = `Certificamos que, para os devidos fins legais de direito, o(a) estudante ${certificate.userName.toUpperCase()}, portador(a) do registro acadêmico ${regText}, concluiu com aproveitamento pleno e satisfatório os 20 componentes curriculares do ${certificate.courseTitle.toUpperCase()}, perfazendo uma carga horária institucional de ${certificate.totalHours.toLocaleString('pt-BR')} horas, em cumprimento a todas as exigências das diretrizes curriculares nacionais da Educação Profissional e Tecnológica.`;

      doc.font('Helvetica')
        .fontSize(12)
        .fillColor('#222222')
        .text(paragraph, 80, doc.y, {
          align: 'justify',
          lineGap: 4,
          width: pageWidth - 160,
        });

      // 5. BLOCO INFERIOR: QR CODE DE VALIDAÇÃO + LINHAS DE ASSINATURA INSTITUCIONAL
      const bottomY = pageHeight - 160;

      // 5.1 Bloco do QR Code e Autenticidade (Lado Esquerdo)
      doc.image(qrCodeBuffer, 80, bottomY - 5, { width: 95, height: 95 });

      doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#004d25')
        .text('AUTENTICIDADE REGISTRADA', 185, bottomY + 5);

      doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#222222')
        .text(`Chave: `, 185, bottomY + 20, { continued: true })
        .font('Courier-Bold')
        .fillColor('#004d25')
        .text(certificate.validationCode);

      doc.font('Helvetica')
        .fontSize(7.5)
        .fillColor('#555555')
        .text(`Data de Emissão: ${completionDateFormatted}`, 185, bottomY + 33)
        .text('Consulte a verificação pública apontando', 185, bottomY + 45)
        .text('a câmera para o QR Code ou acesse a URL:', 185, bottomY + 55)
        .font('Helvetica-Oblique')
        .fontSize(6.5)
        .fillColor('#004d25')
        .text(`/api/v1/certificates/verify/${certificate.validationCode}`, 185, bottomY + 67);

      // 5.2 Bloco de Assinaturas Oficiais (Lado Direito)
      const sigLineY = bottomY + 45;
      const sigCol1X = 400;
      const sigCol2X = 610;
      const sigLineWidth = 180;

      // Linha 1: Coordenação do Curso
      doc.moveTo(sigCol1X, sigLineY)
        .lineTo(sigCol1X + sigLineWidth, sigLineY)
        .lineWidth(0.8)
        .strokeColor('#555555')
        .stroke();

      doc.font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor('#222222')
        .text('Coordenação do Curso', sigCol1X, sigLineY + 6, { width: sigLineWidth, align: 'center' });

      doc.font('Helvetica')
        .fontSize(6.5)
        .fillColor('#666666')
        .text('Pré-Curso de Inteligência Artificial', sigCol1X, sigLineY + 16, { width: sigLineWidth, align: 'center' })
        .text('Portaria Institucional de Designação', sigCol1X, sigLineY + 26, { width: sigLineWidth, align: 'center' });

      // Linha 2: Diretoria de Ensino e Registro Acadêmico
      doc.moveTo(sigCol2X, sigLineY)
        .lineTo(sigCol2X + sigLineWidth, sigLineY)
        .lineWidth(0.8)
        .strokeColor('#555555')
        .stroke();

      doc.font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor('#222222')
        .text('Diretoria de Ensino', sigCol2X, sigLineY + 6, { width: sigLineWidth, align: 'center' });

      doc.font('Helvetica')
        .fontSize(6.5)
        .fillColor('#666666')
        .text('Controle e Registro Acadêmico', sigCol2X, sigLineY + 16, { width: sigLineWidth, align: 'center' })
        .text('Instituto Federal de Educação', sigCol2X, sigLineY + 26, { width: sigLineWidth, align: 'center' });

      // 6. RODAPÉ DE REGISTRO
      doc.font('Helvetica')
        .fontSize(6.5)
        .fillColor('#888888')
        .text(
          `Documento assinado digitalmente nos termos da MP 2.200-2/2001 e validado pela plataforma CAMPOS IA sob a chave de autenticidade ${certificate.validationCode}`,
          40,
          pageHeight - 33,
          { align: 'center', width: pageWidth - 80 }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
