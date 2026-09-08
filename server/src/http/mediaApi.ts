import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import type { Media, MediaKind } from '@svoyak/shared';
import { UPLOADS_DIR } from '../config.js';
import { importSiq } from '../packs/siq/importSiq.js';
import { getPack, savePack } from '../storage/packsRepo.js';

const MAX_SIZE_BYTES = 50 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/mp4': '.m4a',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

function kindOf(mimetype: string): MediaKind | null {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  return null;
}

/** Загрузка медиа для вопроса. Файл кладём рядом с паком, имя генерируем сами. */
export function mediaRouter(): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
  });

  router.post('/packs/:id/media', upload.single('file'), (req, res) => {
    const packId = typeof req.params.id === 'string' ? req.params.id : '';
    const pack = getPack(packId);
    if (!pack) {
      res.status(404).json({ error: 'Пак не найден' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Файл не получен' });
      return;
    }

    const kind = kindOf(file.mimetype);
    if (!kind) {
      res.status(415).json({ error: 'Поддерживаются только картинки, аудио и видео' });
      return;
    }

    // Имя берём своё: пользовательское могло бы увести запись из папки пака.
    const extension = EXTENSIONS[file.mimetype] ?? path.extname(file.originalname).slice(0, 8);
    const fileName = `${randomUUID()}${extension}`;
    const dir = path.join(UPLOADS_DIR, pack.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), file.buffer);

    const media: Media = { kind, src: `/uploads/${pack.id}/${fileName}` };
    res.status(201).json({ media });
  });

  router.post('/packs/import-siq', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Файл не получен' });
      return;
    }

    const result = importSiq(file.buffer);
    if (result.report.some((entry) => entry.level === 'error')) {
      res.status(400).json({ report: result.report });
      return;
    }

    savePack(result.pack);
    res.status(201).json({ pack: result.pack, report: result.report });
  });

  return router;
}
