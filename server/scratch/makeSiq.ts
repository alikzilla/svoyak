/** Собирает демонстрационный .siq для ручной проверки импорта. */
import fs from 'node:fs';
import AdmZip from 'adm-zip';

const content = `<?xml version="1.0" encoding="utf-8"?>
<package name="Пак из SIGame" version="4" date="01.01.2024">
  <info><authors><author>Клуб знатоков</author></authors></info>
  <rounds>
    <round name="Разминка">
      <themes>
        <theme name="Столицы">
          <info><comments>Простые вопросы</comments></info>
          <questions>
            <question price="100"><scenario><atom>Столица Франции?</atom></scenario>
              <right><answer>Париж</answer></right></question>
            <question price="200"><scenario><atom>Столица Японии?</atom><atom type="image">@токио.png</atom></scenario>
              <right><answer>Токио</answer><answer>Эдо</answer></right>
              <wrong><answer>Киото</answer></wrong></question>
            <question price="300">
              <type name="cat"><param name="theme">Флаги</param><param name="cost">400</param></type>
              <scenario><atom>У какой страны флаг с кленовым листом?</atom></scenario>
              <right><answer>Канада</answer></right></question>
            <question price="400"><type name="auction" />
              <scenario><atom>Самая маленькая страна мира?</atom></scenario>
              <right><answer>Ватикан</answer></right></question>
            <question price="500"><type name="таинственный" />
              <scenario><atom>Вопрос неизвестного типа</atom></scenario>
              <right><answer>Ответ</answer></right></question>
          </questions>
        </theme>
      </themes>
    </round>
    <round name="Финал" type="final">
      <themes>
        <theme name="Наука">
          <questions><question price="0">
            <scenario><atom>Кто сформулировал законы движения планет?</atom></scenario>
            <right><answer>Кеплер</answer></right></question></questions>
        </theme>
      </themes>
    </round>
  </rounds>
</package>`;

const zip = new AdmZip();
zip.addFile('content.xml', Buffer.from(content, 'utf8'));
// Однопиксельный PNG под закодированным именем — как в настоящих паках.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
zip.addFile(`Images/${encodeURIComponent('токио.png')}`, png);
fs.writeFileSync(process.argv[2] ?? 'demo.siq', zip.toBuffer());
console.log('готово:', process.argv[2]);
