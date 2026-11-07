import QRCode from 'qrcode';

export interface CertificatePDFData {
  studentName: string;
  registrationNumber?: string;
  courseTitle: string;
  totalHours: number;
  completionDate: string; // YYYY-MM-DD
  validationCode: string;
  verificationUrl: string;
}

/**
 * Converte data ISO (YYYY-MM-DD) para formato brasileiro extenso
 */
function formatDateBR(isoDate: string): string {
  try {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[0];
      const months = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
      ];
      return `${day} de ${months[monthIdx] || parts[1]} de ${year}`;
    }
  } catch {}
  return isoDate;
}

/**
 * Sanitiza texto para codificação WinAnsi padrão do PDF
 */
function sanitizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos para compatibilidade estrita com Helvetica Type1
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Gera um arquivo PDF 1.4 de Certificado de Conclusão em formato Paisagem (A4 - 842 x 595 pontos).
 * Inclui moldura institucional decorativa, identificação do estudante, 200 horas,
 * código único de autenticidade e QR Code vetorial com resolução perfeita.
 */
export async function generateCertificatePDF(data: CertificatePDFData): Promise<Buffer> {
  const width = 842;
  const height = 595;

  // 1. Gera matriz vetorial do QR Code
  const qr = QRCode.create(data.verificationUrl, { errorCorrectionLevel: 'M' });
  const qrSize = qr.modules.size;
  const qrTargetDimension = 76; // 76x76 pontos
  const modSize = qrTargetDimension / qrSize;
  const qrX = 58;
  const qrY = 56;

  let qrVectorStream = '0 0 0 rg\n'; // preto
  for (let r = 0; r < qrSize; r++) {
    for (let c = 0; c < qrSize; c++) {
      if (qr.modules.get(r, c)) {
        const x = (qrX + c * modSize).toFixed(2);
        const y = (qrY + (qrSize - 1 - r) * modSize).toFixed(2);
        const w = modSize.toFixed(2);
        const h = modSize.toFixed(2);
        qrVectorStream += `${x} ${y} ${w} ${h} re f\n`;
      }
    }
  }

  // 2. Elementos gráficos decorativos (moldura e linhas de assinatura)
  let graphicsStream = '';

  // Fundo sutil com margem
  graphicsStream += 'q\n';
  // Borda externa verde institucional (#006633 -> RGB 0.0, 0.40, 0.20)
  graphicsStream += '0.0 0.40 0.20 RG 3.5 w 24 24 794 547 re S\n';
  // Borda interna dourada (#D4AF37 -> RGB 0.83, 0.69, 0.22)
  graphicsStream += '0.83 0.69 0.22 RG 1.2 w 32 32 778 531 re S\n';

  // Cantoneiras decorativas nos 4 cantos
  graphicsStream += '0.0 0.40 0.20 RG 2 w\n';
  graphicsStream += '36 535 m 52 535 l 52 551 l S\n'; // top-left
  graphicsStream += '806 535 m 790 535 l 790 551 l S\n'; // top-right
  graphicsStream += '36 60 m 52 60 l 52 44 l S\n'; // bottom-left
  graphicsStream += '806 60 m 790 60 l 790 44 l S\n'; // bottom-right

  // Tarja sutil sob o cabeçalho
  graphicsStream += '0.94 0.98 0.95 rg 34 502 774 24 re f\n';

  // Linhas para assinaturas institucionais
  graphicsStream += '0.3 0.3 0.3 RG 0.8 w\n';
  graphicsStream += '350 82 m 560 82 l S\n'; // Assinatura 1
  graphicsStream += '590 82 m 790 82 l S\n'; // Assinatura 2
  graphicsStream += 'Q\n';

  // 3. Montagem tipográfica dos textos
  const studentNameSanitized = sanitizeText(data.studentName.toUpperCase());
  const regNumberSanitized = data.registrationNumber ? sanitizeText(data.registrationNumber) : 'REGISTRO CONFIRMADO';
  const courseTitleSanitized = sanitizeText(data.courseTitle);
  const completionDateBR = sanitizeText(formatDateBR(data.completionDate));
  const validationCodeSanitized = sanitizeText(data.validationCode);

  let textStream = 'BT\n';

  // Cabeçalho Oficial
  textStream += '/F2 11 Tf 0.0 0.40 0.20 rg\n';
  textStream += '421 538 Td\n';
  textStream += `(${sanitizeText('REPUBLICA FEDERATIVA DO BRASIL')}) Tj\n`;

  textStream += '/F2 12 Tf 0.1 0.1 0.1 rg\n';
  textStream += '0 -16 Td\n';
  textStream += `(${sanitizeText('INSTITUTO DE EDUCACAO PROFISSIONAL E TECNOLOGICA')}) Tj\n`;

  textStream += '/F1 9 Tf 0.3 0.3 0.3 rg\n';
  textStream += '0 -14 Td\n';
  textStream += `(${sanitizeText('SISTEMA NACIONAL DE EDUCACAO PROFISSIONAL E TECNOLOGICA — REGISTRO ACADEMICO')}) Tj\n`;

  // Título do Certificado
  textStream += '/F2 26 Tf 0.0 0.40 0.20 rg\n';
  textStream += '0 -38 Td\n';
  textStream += `(${sanitizeText('CERTIFICADO DE CONCLUSAO')}) Tj\n`;

  textStream += '/F3 11 Tf 0.4 0.4 0.4 rg\n';
  textStream += '0 -15 Td\n';
  textStream += `(${sanitizeText('Educacao Profissional Tecnica de Nivel Medio')}) Tj\n`;

  // Corpo do Certificado
  textStream += '/F1 12 Tf 0.2 0.2 0.2 rg\n';
  textStream += '0 -34 Td\n';
  textStream += `(${sanitizeText('Certificamos para os devidos fins que o(a) estudante')}) Tj\n`;

  // Nome do Estudante em Destaque
  textStream += '/F2 18 Tf 0.0 0.35 0.18 rg\n';
  textStream += '0 -24 Td\n';
  textStream += `(${studentNameSanitized}) Tj\n`;

  textStream += '/F1 10 Tf 0.4 0.4 0.4 rg\n';
  textStream += '0 -14 Td\n';
  textStream += `(${sanitizeText(`Identificacao Academica: ${regNumberSanitized}`)}) Tj\n`;

  // Parágrafo com os dados oficiais do curso e das 200 horas
  textStream += '/F1 11 Tf 0.15 0.15 0.15 rg\n';
  textStream += '0 -26 Td\n';
  textStream += `(${sanitizeText(`concluiu com exito todos os requisitos do ${courseTitleSanitized},`)}) Tj\n`;

  textStream += '0 -16 Td\n';
  textStream += `(${sanitizeText(`com carga horaria institucional oficial de ${data.totalHours} horas, obtendo aprovacao com aproveitamento satisfatorio`)}) Tj\n`;

  textStream += '0 -16 Td\n';
  textStream += `(${sanitizeText('em todos os 20 componentes curriculares dos Modulos I, II e III, conforme registros nos autos academicos.')}) Tj\n`;

  textStream += '/F3 10 Tf 0.3 0.3 0.3 rg\n';
  textStream += '0 -24 Td\n';
  textStream += `(${sanitizeText(`Data de Conclusao: ${completionDateBR}  |  Carga Horaria: ${data.totalHours} Horas`)}) Tj\n`;

  textStream += 'ET\n';

  // Textos complementares nas laterais inferiores (QR Code e Assinaturas)
  textStream += 'BT\n';
  // Texto ao lado do QR Code
  textStream += '/F2 8 Tf 0.0 0.40 0.20 rg\n';
  textStream += '142 120 Td\n';
  textStream += `(${sanitizeText('AUTENTICIDADE DIGITAL')}) Tj\n`;

  textStream += '/F1 7.5 Tf 0.2 0.2 0.2 rg\n';
  textStream += '0 -11 Td\n';
  textStream += `(${sanitizeText(`Codigo: ${validationCodeSanitized}`)}) Tj\n`;

  textStream += '0 -10 Td\n';
  textStream += `(${sanitizeText('Verifique publicamente escaneando o')}) Tj\n`;

  textStream += '0 -9 Td\n';
  textStream += `(${sanitizeText('QR Code ou na rota oficial de consulta.')}) Tj\n`;

  // Legendas das Assinaturas
  textStream += '/F1 8.5 Tf 0.3 0.3 0.3 rg\n';
  textStream += '350 68 Td\n';
  textStream += `(${sanitizeText('Diretoria de Registros Escolares')}) Tj\n`;

  textStream += '0 -10 Td\n';
  textStream += `(${sanitizeText('Secretaria Academica Institucional')}) Tj\n`;

  textStream += '240 10 Td\n';
  textStream += `(${sanitizeText('Coordenacao do Pre-Curso de IA')}) Tj\n`;

  textStream += '0 -10 Td\n';
  textStream += `(${sanitizeText('Comissao Docente de Avaliacao')}) Tj\n`;

  textStream += 'ET\n';

  // 4. Concatena todos os fluxos para compor o stream do PDF
  const fullContentStream = `${graphicsStream}\n${qrVectorStream}\n${textStream}`;
  const streamLen = Buffer.byteLength(fullContentStream, 'utf8');

  // 5. Montagem dos objetos do arquivo PDF 1.4
  const objects: string[] = [];

  // obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

  // obj 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');

  // obj 3: Page (Landscape 842 x 595)
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>\nendobj');

  // obj 4: Content Stream
  objects.push(`4 0 obj\n<< /Length ${streamLen} >>\nstream\n${fullContentStream}\nendstream\nendobj`);

  // obj 5: F1 - Helvetica Regular
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj');

  // obj 6: F2 - Helvetica Bold
  objects.push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj');

  // obj 7: F3 - Helvetica Oblique
  objects.push('7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>\nendobj');

  // 6. Estrutura final e tabela XREF
  let body = '%PDF-1.4\n';
  const offsets: number[] = [0];

  objects.forEach((obj) => {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += obj + '\n';
  });

  const xrefOffset = Buffer.byteLength(body, 'utf8');
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    const offsetStr = String(offsets[i]).padStart(10, '0');
    xref += `${offsetStr} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer, 'utf8');
}
