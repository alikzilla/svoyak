import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svoyak-siq-'));
process.env['UPLOADS_DIR'] = path.join(tempDir, 'uploads');
process.env['DATA_DIR'] = path.join(tempDir, 'data');
const { importSiq } = await import('./importSiq.js');

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<package name="Архивный пак" version="4">
  <rounds>
    <round name="Раунд">
      <themes>
        <theme name="Картинки">
          <questions>
            <question price="100">
              <scenario>
                <atom>Что на фото?</atom>
                <atom type="image">@фото котика.jpg</atom>
              </scenario>
              <right><answer>Кот</answer></right>
            </question>
            <question price="200">
              <scenario>
                <atom>Пропавший файл</atom>
                <atom type="audio">@нету.mp3</atom>
              </scenario>
              <right><answer>Ответ</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
  </rounds>
</package>`;

/** Настоящий .siq: zip с content.xml и папкой Images, имя файла закодировано. */
function buildArchive(): Buffer {
  const zip = new AdmZip();
  zip.addFile('content.xml', Buffer.from(CONTENT, 'utf8'));
  zip.addFile(`Images/${encodeURIComponent('фото котика.jpg')}`, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return zip.toBuffer();
}

describe('импорт .siq', () => {
  const result = importSiq(buildArchive());

  it('читает пак из архива', () => {
    expect(result.pack.title).toBe('Архивный пак');
    expect(result.pack.rounds[0]?.themes[0]?.questions).toHaveLength(2);
  });

  it('достаёт файл с закодированным именем и переписывает ссылку', () => {
    const media = result.pack.rounds[0]?.themes[0]?.questions[0]?.media;
    expect(media?.kind).toBe('image');
    expect(media?.src).toMatch(new RegExp(`^/uploads/${result.pack.id}/[0-9a-f-]+\\.jpg$`));

    const onDisk = path.join(tempDir, 'uploads', result.pack.id);
    expect(fs.readdirSync(onDisk)).toHaveLength(1);
  });

  it('о пропавшем файле сообщает, но импорт не роняет', () => {
    expect(result.report.some((entry) => entry.message.includes('нету.mp3'))).toBe(true);
    expect(result.pack.rounds[0]?.themes[0]?.questions[1]?.text).toBe('Пропавший файл');
  });

  it('первой строкой отчёта идёт сводка', () => {
    expect(result.report[0]?.message).toContain('Перенесено вопросов: 2');
  });

  it('не архив — понятная ошибка, а не исключение', () => {
    const broken = importSiq(Buffer.from('просто текст'));
    expect(broken.report.some((entry) => entry.level === 'error')).toBe(true);
  });

  it('архив без content.xml — понятная ошибка', () => {
    const zip = new AdmZip();
    zip.addFile('readme.txt', Buffer.from('привет'));
    const result = importSiq(zip.toBuffer());
    expect(result.report[0]?.message).toContain('content.xml');
  });
});
