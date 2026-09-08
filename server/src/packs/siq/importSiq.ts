import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import type { Media, Pack } from '@svoyak/shared';
import { UPLOADS_DIR } from '../../config.js';
import { parseSiqContent, type ImportEntry } from './parseContent.js';

export interface SiqImportResult {
  pack: Pack;
  report: ImportEntry[];
}

/** Медиа в архиве лежит по папкам, а имена файлов закодированы как в URL. */
const MEDIA_DIRS = ['images', 'audio', 'video', 'texts'];

function decodeName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** Все медиа-ссылки пака — чтобы переписать их после распаковки файлов. */
function* eachMedia(pack: Pack): Generator<{ get: () => Media | undefined; set: (media: Media) => void }> {
  for (const round of pack.rounds) {
    for (const theme of round.themes) {
      for (const question of theme.questions) {
        yield { get: () => question.media, set: (media) => (question.media = media) };
        yield { get: () => question.answerMedia, set: (media) => (question.answerMedia = media) };
      }
    }
  }
  for (const theme of pack.final.themes) {
    yield { get: () => theme.question.media, set: (media) => (theme.question.media = media) };
  }
}

/** Разбор .siq: content.xml плюс распаковка медиа в uploads/<пак>/. */
export function importSiq(buffer: Buffer): SiqImportResult {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch (cause) {
    return {
      pack: parseSiqContent('').pack,
      report: [
        {
          level: 'error',
          message: `Файл не читается как архив: ${cause instanceof Error ? cause.message : 'ошибка'}`,
        },
      ],
    };
  }

  const entries = zip.getEntries();
  const contentEntry = entries.find(
    (entry) => path.basename(entry.entryName).toLowerCase() === 'content.xml',
  );
  if (!contentEntry) {
    return {
      pack: parseSiqContent('').pack,
      report: [{ level: 'error', message: 'В архиве нет content.xml — это не пак SIGame' }],
    };
  }

  const { pack, report } = parseSiqContent(contentEntry.getData().toString('utf8'));

  // Имя файла из ссылки ищем среди распакованных: в архиве оно закодировано.
  const files = new Map<string, AdmZip.IZipEntry>();
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const dir = path.dirname(entry.entryName).toLowerCase();
    if (!MEDIA_DIRS.some((folder) => dir === folder || dir.endsWith(`/${folder}`))) continue;
    files.set(decodeName(path.basename(entry.entryName)).toLowerCase(), entry);
  }

  const targetDir = path.join(UPLOADS_DIR, pack.id);
  const extracted = new Map<string, string>();
  let missing = 0;

  for (const slot of eachMedia(pack)) {
    const media = slot.get();
    if (!media) continue;
    // Внешние ссылки оставляем как есть: их не было в архиве.
    if (/^https?:\/\//i.test(media.src)) continue;

    const key = decodeName(media.src).toLowerCase();
    const already = extracted.get(key);
    if (already !== undefined) {
      slot.set({ ...media, src: already });
      continue;
    }

    const entry = files.get(key);
    if (!entry) {
      missing += 1;
      report.push({ level: 'warning', message: `Файл «${media.src}» не найден в архиве` });
      continue;
    }

    fs.mkdirSync(targetDir, { recursive: true });
    const extension = path.extname(decodeName(entry.entryName)) || '';
    const fileName = `${randomUUID()}${extension}`;
    fs.writeFileSync(path.join(targetDir, fileName), entry.getData());

    const src = `/uploads/${pack.id}/${fileName}`;
    extracted.set(key, src);
    slot.set({ ...media, src });
  }

  report.unshift({
    level: 'info',
    message: `Перенесено вопросов: ${pack.rounds.reduce(
      (sum, round) => sum + round.themes.reduce((inner, theme) => inner + theme.questions.length, 0),
      0,
    )}, тем финала: ${pack.final.themes.length}, файлов: ${extracted.size}${
      missing > 0 ? `, не найдено файлов: ${missing}` : ''
    }`,
  });

  return { pack, report };
}
