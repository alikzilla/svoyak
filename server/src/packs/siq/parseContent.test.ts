import { describe, it, expect } from 'vitest';
import { parseSiqContent } from './parseContent.js';

/** Классический формат SIGame (версия 4) — таких паков в сети большинство. */
const V4 = `<?xml version="1.0" encoding="utf-8"?>
<package name="Тестовый пак" version="4" date="01.01.2024">
  <info><authors><author>Автор</author></authors></info>
  <rounds>
    <round name="Первый раунд">
      <themes>
        <theme name="Кино">
          <info><comments>Про фильмы</comments></info>
          <questions>
            <question price="100">
              <scenario><atom>Кто снял «Крёстного отца»?</atom></scenario>
              <right><answer>Коппола</answer><answer>Фрэнсис Коппола</answer></right>
            </question>
            <question price="200">
              <scenario>
                <atom>Кадр из фильма</atom>
                <atom type="image">@кадр.jpg</atom>
              </scenario>
              <right><answer>Матрица</answer></right>
              <wrong><answer>Начало</answer></wrong>
            </question>
            <question price="300">
              <type name="cat">
                <param name="theme">Мультфильмы</param>
                <param name="cost">500</param>
              </type>
              <scenario><atom>Кто рисовал Тихиро?</atom></scenario>
              <right><answer>Миядзаки</answer></right>
            </question>
            <question price="400">
              <type name="auction" />
              <scenario><atom>Вопрос на аукцион</atom></scenario>
              <right><answer>Ответ</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
    <round name="Финал" type="final">
      <themes>
        <theme name="География">
          <questions>
            <question price="0">
              <scenario><atom>Самое глубокое озеро?</atom></scenario>
              <right><answer>Байкал</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
  </rounds>
</package>`;

/** Новый формат (версия 5): вопрос лежит в params, типы называются иначе. */
const V5 = `<?xml version="1.0" encoding="utf-8"?>
<package name="Новый пак" version="5">
  <rounds>
    <round name="Раунд">
      <themes>
        <theme name="Тема">
          <questions>
            <question price="100">
              <params>
                <param name="question" type="content">
                  <item type="text">Текст вопроса</item>
                </param>
              </params>
              <right><answer>Ответ</answer></right>
            </question>
            <question price="200">
              <type name="stake" />
              <params>
                <param name="question" type="content">
                  <item type="text">Ставочный вопрос</item>
                </param>
              </params>
              <right><answer>Ставка</answer></right>
            </question>
            <question price="300">
              <type name="secret">
                <param name="theme">Секретная тема</param>
                <param name="price">700</param>
              </type>
              <params>
                <param name="question" type="content">
                  <item type="text">Секретный вопрос</item>
                </param>
              </params>
              <right><answer>Секрет</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
  </rounds>
</package>`;

describe('разбор content.xml, версия 4', () => {
  const result = parseSiqContent(V4);

  it('читает название и автора пака', () => {
    expect(result.pack.title).toBe('Тестовый пак');
    expect(result.pack.author).toBe('Автор');
  });

  it('раскладывает раунды и финал по своим местам', () => {
    expect(result.pack.rounds).toHaveLength(1);
    expect(result.pack.final.themes).toHaveLength(1);
    expect(result.pack.final.themes[0]?.title).toBe('География');
    expect(result.pack.final.themes[0]?.question.answer).toBe('Байкал');
  });

  it('переносит тему с комментарием и вопросы с ценами', () => {
    const theme = result.pack.rounds[0]?.themes[0];
    expect(theme?.title).toBe('Кино');
    expect(theme?.comment).toBe('Про фильмы');
    expect(theme?.questions.map((question) => question.price)).toEqual([100, 200, 300, 400]);
  });

  it('первый правильный ответ основной, остальные — принимаемые', () => {
    const question = result.pack.rounds[0]?.themes[0]?.questions[0];
    expect(question?.answer).toBe('Коппола');
    expect(question?.altAnswers).toEqual(['Фрэнсис Коппола']);
  });

  it('картинка в вопросе превращается в медиа со ссылкой на файл', () => {
    const question = result.pack.rounds[0]?.themes[0]?.questions[1];
    expect(question?.text).toBe('Кадр из фильма');
    expect(question?.media).toEqual({ kind: 'image', src: 'кадр.jpg' });
  });

  it('кот в мешке переносится с темой и ценой', () => {
    const question = result.pack.rounds[0]?.themes[0]?.questions[2];
    expect(question?.type).toBe('cat');
    expect(question?.cat).toEqual({ theme: 'Мультфильмы', price: 500, canKeep: false });
  });

  it('аукцион распознаётся', () => {
    expect(result.pack.rounds[0]?.themes[0]?.questions[3]?.type).toBe('auction');
  });

  it('неверные ответы не теряются молча, а попадают в отчёт', () => {
    expect(result.report.some((entry) => entry.message.includes('Неверные ответы'))).toBe(true);
  });
});

describe('разбор content.xml, версия 5', () => {
  const result = parseSiqContent(V5);

  it('читает текст вопроса из params', () => {
    expect(result.pack.rounds[0]?.themes[0]?.questions[0]?.text).toBe('Текст вопроса');
  });

  it('stake — это аукцион', () => {
    expect(result.pack.rounds[0]?.themes[0]?.questions[1]?.type).toBe('auction');
  });

  it('secret — это кот в мешке', () => {
    const question = result.pack.rounds[0]?.themes[0]?.questions[2];
    expect(question?.type).toBe('cat');
    expect(question?.cat).toEqual({ theme: 'Секретная тема', price: 700, canKeep: false });
  });

  it('если финального раунда нет, финал остаётся пустым и об этом сказано', () => {
    expect(result.pack.final.themes).toHaveLength(0);
    expect(result.report.some((entry) => entry.message.includes('Финальный раунд'))).toBe(true);
  });
});

describe('устойчивость', () => {
  it('битый XML не роняет разбор, а возвращает ошибку в отчёте', () => {
    const result = parseSiqContent('<это не пак');
    expect(result.pack.rounds).toHaveLength(0);
    expect(result.report.some((entry) => entry.level === 'error')).toBe(true);
  });

  it('вопрос без ответа переносится, но помечается в отчёте', () => {
    const xml = `<package name="П"><rounds><round name="Р"><themes><theme name="Т"><questions>
      <question price="100"><scenario><atom>Вопрос</atom></scenario></question>
    </questions></theme></themes></round></rounds></package>`;
    const result = parseSiqContent(xml);
    expect(result.pack.rounds[0]?.themes[0]?.questions).toHaveLength(1);
    expect(result.report.some((entry) => entry.message.includes('без ответа'))).toBe(true);
  });
});

describe('разделитель ответа', () => {
  it('атомы после marker относятся к ответу, а не к вопросу', () => {
    const xml = `<package name="П"><rounds><round name="Р"><themes><theme name="Т"><questions>
      <question price="100">
        <scenario>
          <atom>Что на картинке?</atom>
          <atom type="marker" />
          <atom type="image">@ответ.jpg</atom>
          <atom>Это была Мона Лиза</atom>
        </scenario>
        <right><answer>Мона Лиза</answer></right>
      </question>
    </questions></theme></themes></round></rounds></package>`;

    const question = parseSiqContent(xml).pack.rounds[0]?.themes[0]?.questions[0];
    expect(question?.text).toBe('Что на картинке?');
    expect(question?.media).toBeUndefined();
    expect(question?.answerMedia).toEqual({ kind: 'image', src: 'ответ.jpg' });
    expect(question?.hostComment).toBe('Это была Мона Лиза');
  });
});
