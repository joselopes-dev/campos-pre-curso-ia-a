import express, { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db.ts';
import { User } from '../../types/index.ts';

export const academicWorksRouter = Router();

// Permite payload JSON de até 4 MB apenas nesta rota para comportar imagens de até 2 MB em Base64
academicWorksRouter.use(express.json({ limit: '4mb' }));

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Middleware de autenticação e autorização estrita no backend (RBAC).
 * Somente 'professor' e 'administrador' podem criar, editar ou excluir trabalhos.
 */
async function requireStaffRole(req: Request, res: Response, next: NextFunction) {
  try {
    // Verificação básica de origem em mutações autenticadas por cookie
    const origin = req.get('origin');
    const host = req.get('x-forwarded-host') || req.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return res.status(403).json({ error: 'Origem da requisição não autorizada.' });
        }
      } catch {
        return res.status(403).json({ error: 'Cabeçalho de origem inválido.' });
      }
    }

    const token = req.cookies['lms_session'];
    if (!token) {
      return res.status(401).json({ error: 'Acesso não autorizado: autenticação obrigatória.' });
    }

    const user: User | null = await db.getSession(token);
    if (!user) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    if (user.role !== 'professor' && user.role !== 'administrador') {
      return res.status(403).json({
        error: 'Permissão negada: apenas professores e administradores podem gerenciar trabalhos acadêmicos.',
        role: user.role,
      });
    }

    (req as any).user = user;
    next();
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro ao validar autorização.' });
  }
}

/**
 * Valida URL externa garantindo apenas protocolos http: ou https:
 */
function validateExternalUrl(rawUrl: unknown): { valid: true; url: string } | { valid: false; error: string } {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { valid: false, error: 'Informe o link para acessar o trabalho completo.' };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    return { valid: false, error: 'O link informado excede o tamanho máximo permitido (2.048 caracteres).' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'O link do trabalho deve utilizar protocolo http:// ou https://.' };
    }
    if (!parsed.hostname || parsed.hostname.length < 3) {
      return { valid: false, error: 'Informe um endereço de URL válido com domínio completo.' };
    }
    return { valid: true, url: parsed.toString() };
  } catch {
    return { valid: false, error: 'Link inválido. Informe uma URL completa iniciando com https:// ou http://.' };
  }
}

/**
 * Detecta o formato real da imagem pelos magic bytes do buffer binário.
 * Aceita exclusivamente PNG, JPEG e WebP. Bloqueia SVG e formatos não permitidos.
 */
function detectAllowedImageMime(buffer: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: "RIFF" (0..3) + "WEBP" (8..11)
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

function parseAndValidateImageDataUrl(
  imageDataUrl: unknown
): { valid: true; buffer: Buffer; mimeType: string } | { valid: false; error: string } {
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.trim()) {
    return { valid: false, error: 'Dados da imagem inválidos.' };
  }

  const trimmed = imageDataUrl.trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    return {
      valid: false,
      error: 'Formato de imagem inválido. Envie apenas arquivos PNG, JPG/JPEG ou WebP.',
    };
  }

  const declaredMime = match[1].toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(declaredMime)) {
    return {
      valid: false,
      error: 'Formato não permitido. Utilize exclusivamente imagens PNG, JPEG ou WebP.',
    };
  }

  const base64Clean = match[2].replace(/\s+/g, '');
  const estimatedBytes = Math.floor((base64Clean.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES + 1024) {
    return {
      valid: false,
      error: 'A imagem excede o limite máximo de 2 MB. Reduza o arquivo e tente novamente.',
    };
  }

  const buffer = Buffer.from(base64Clean, 'base64');
  if (buffer.length === 0) {
    return { valid: false, error: 'O arquivo de imagem enviado está vazio ou corrompido.' };
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    return {
      valid: false,
      error: 'A imagem excede o limite máximo permitido de 2 MB.',
    };
  }

  const actualMime = detectAllowedImageMime(buffer);
  if (!actualMime) {
    return {
      valid: false,
      error: 'Conteúdo de imagem inválido ou corrompido. Envie um arquivo PNG, JPEG ou WebP válido.',
    };
  }

  return { valid: true, buffer, mimeType: actualMime };
}

function validateWorkPayload(body: any):
  | {
      valid: true;
      title: string;
      authors: string;
      description: string | null;
      workUrl: string;
      imageBuffer: Buffer | null;
      imageMime: string | null;
      removeCoverImage: boolean;
    }
  | { valid: false; error: string } {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (title.length < 3 || title.length > 255) {
    return {
      valid: false,
      error: 'O título do trabalho deve ter entre 3 e 255 caracteres.',
    };
  }

  const authors = typeof body?.authors === 'string' ? body.authors.trim() : '';
  if (authors.length < 2 || authors.length > 500) {
    return {
      valid: false,
      error: 'Informe o nome do autor ou dos integrantes da equipe (entre 2 e 500 caracteres).',
    };
  }

  let description: string | null = null;
  if (body?.description !== undefined && body?.description !== null) {
    if (typeof body.description !== 'string') {
      return { valid: false, error: 'Descrição em formato inválido.' };
    }
    const cleanDesc = body.description.trim();
    if (cleanDesc.length > 2000) {
      return {
        valid: false,
        error: 'A descrição opcional deve ter no máximo 2.000 caracteres.',
      };
    }
    description = cleanDesc || null;
  }

  const urlCheck = validateExternalUrl(body?.workUrl);
  if (urlCheck.valid === false) {
    return { valid: false, error: urlCheck.error };
  }

  let imageBuffer: Buffer | null = null;
  let imageMime: string | null = null;
  if (body?.imageDataUrl !== undefined && body?.imageDataUrl !== null && body?.imageDataUrl !== '') {
    const imgCheck = parseAndValidateImageDataUrl(body.imageDataUrl);
    if (imgCheck.valid === false) {
      return { valid: false, error: imgCheck.error };
    }
    imageBuffer = imgCheck.buffer;
    imageMime = imgCheck.mimeType;
  }

  const removeCoverImage = Boolean(body?.removeCoverImage) && !imageBuffer;

  return {
    valid: true,
    title,
    authors,
    description,
    workUrl: urlCheck.url,
    imageBuffer,
    imageMime,
    removeCoverImage,
  };
}

/**
 * GET /api/v1/academic-works
 * Listagem paginada e busca de trabalhos acadêmicos (acessível a todos os perfis, incluindo alunos).
 */
academicWorksRouter.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '20'), 10) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 120) : '';

    const result = await db.listAcademicWorks({ page, limit, search });
    return res.json(result);
  } catch (error: any) {
    console.error('❌ [AcademicWorks] Erro ao listar trabalhos:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Erro ao carregar trabalhos acadêmicos.',
    });
  }
});

/**
 * GET /api/v1/academic-works/:id/image
 * Serve a imagem binária armazenada no PostgreSQL para persistência definitiva entre deploys.
 */
academicWorksRouter.get('/:id/image', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const img = await db.getAcademicWorkImage(id);
    if (!img) {
      return res.status(404).json({ error: 'Imagem de capa não encontrada.' });
    }

    res.setHeader('Content-Type', img.mimeType);
    res.setHeader('Content-Length', img.buffer.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(img.buffer);
  } catch (error: any) {
    console.error('❌ [AcademicWorks] Erro ao servir imagem:', error);
    return res.status(error.status || 500).json({ error: 'Erro ao carregar imagem do trabalho.' });
  }
});

/**
 * POST /api/v1/academic-works
 * Cadastro de novo trabalho acadêmico (exclusivo para professor e administrador).
 */
academicWorksRouter.post('/', requireStaffRole, async (req: Request, res: Response) => {
  try {
    const user: User = (req as any).user;
    const validation = validateWorkPayload(req.body);
    if (validation.valid === false) {
      return res.status(400).json({ error: validation.error });
    }

    const created = await db.createAcademicWork({
      title: validation.title,
      authors: validation.authors,
      description: validation.description,
      workUrl: validation.workUrl,
      imageBuffer: validation.imageBuffer,
      imageMime: validation.imageMime,
      userId: user.id,
    });

    await db.logAudit(user.id, 'ACADEMIC_WORK_CREATED', `academic_work:${created.id}`, req.ip, {
      title: created.title,
      hasCustomImage: Boolean(validation.imageBuffer),
    });

    return res.status(201).json({
      success: true,
      work: created,
      message: 'Trabalho acadêmico publicado com sucesso.',
    });
  } catch (error: any) {
    console.error('❌ [AcademicWorks] Erro ao cadastrar trabalho:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Não foi possível cadastrar o trabalho acadêmico.',
    });
  }
});

/**
 * PUT /api/v1/academic-works/:id
 * Edição de trabalho acadêmico existente (exclusivo para professor e administrador).
 */
academicWorksRouter.put('/:id', requireStaffRole, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Identificador do trabalho inválido.' });
    }

    const user: User = (req as any).user;
    const validation = validateWorkPayload(req.body);
    if (validation.valid === false) {
      return res.status(400).json({ error: validation.error });
    }

    const updated = await db.updateAcademicWork(id, {
      title: validation.title,
      authors: validation.authors,
      description: validation.description,
      workUrl: validation.workUrl,
      imageBuffer: validation.imageBuffer,
      imageMime: validation.imageMime,
      removeCoverImage: validation.removeCoverImage,
      userId: user.id,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Trabalho acadêmico não encontrado.' });
    }

    await db.logAudit(user.id, 'ACADEMIC_WORK_UPDATED', `academic_work:${updated.id}`, req.ip, {
      title: updated.title,
    });

    return res.json({
      success: true,
      work: updated,
      message: 'Trabalho acadêmico atualizado com sucesso.',
    });
  } catch (error: any) {
    console.error('❌ [AcademicWorks] Erro ao atualizar trabalho:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Não foi possível atualizar o trabalho acadêmico.',
    });
  }
});

/**
 * DELETE /api/v1/academic-works/:id
 * Exclusão de trabalho acadêmico (exclusivo para professor e administrador).
 */
academicWorksRouter.delete('/:id', requireStaffRole, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Identificador do trabalho inválido.' });
    }

    const user: User = (req as any).user;
    const deleted = await db.deleteAcademicWork(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Trabalho acadêmico não encontrado.' });
    }

    await db.logAudit(user.id, 'ACADEMIC_WORK_DELETED', `academic_work:${id}`, req.ip);

    return res.json({
      success: true,
      message: 'Trabalho acadêmico excluído com sucesso.',
    });
  } catch (error: any) {
    console.error('❌ [AcademicWorks] Erro ao excluir trabalho:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Não foi possível excluir o trabalho acadêmico.',
    });
  }
});
