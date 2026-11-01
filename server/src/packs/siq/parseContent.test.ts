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
    expect(result.report.some((entry) => entry.message.includes('Финального раунда'))).toBe(true);
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

/** Так пишет нынешний редактор SIGame: тип — атрибут вопроса, параметры кота —
 *  среди params, медиа — ссылки isRef без собачки. */
const V5_REAL = `<?xml version="1.0" encoding="utf-8"?>
<package name="Настоящий пятый" version="5">
  <rounds>
    <round name="Раунд">
      <themes>
        <theme name="Мемы">
          <questions>
            <question price="100">
              <params>
                <param name="question" type="content"><item type="image" isRef="True">мем.png</item></param>
                <param name="answer" type="content"><item type="video" isRef="True">ответ.mp4</item></param>
              </params>
              <right><answer>Чувак, это рэпчик</answer></right>
            </question>
            <question price="200" type="secret">
              <params>
                <param name="question" type="content"><item type="image" isRef="True">кот.png</item></param>
                <param name="selectionMode">exceptCurrent</param>
                <param name="price" type="numberSet"><numberSet minimum="0" maximum="0" step="0" /></param>
                <param name="theme"></param>
              </params>
              <right><answer>Миротворец</answer></right>
            </question>
            <question price="300" type="secret">
              <params>
                <param name="question" type="content"><item>Котик</item></param>
                <param name="selectionMode">any</param>
                <param name="price" type="numberSet"><numberSet minimum="800" maximum="800" step="0" /></param>
                <param name="theme">Кошки</param>
              </params>
              <right><answer>Мяу</answer></right>
            </question>
            <question price="400" type="stake">
              <params>
                <param name="question" type="content">
                  <item>За игру с песней</item>
                  <item type="audio" isRef="True" placement="background">тема.mp3</item>
                </param>
              </params>
              <right><answer>Tabletop Simulator</answer></right>
            </question>
          </questions>
        </theme>
        <theme name="По кадру">
          <info><comments>Назовите фильм</comments></info>
          <questions>
            <question price="100">
              <params>
                <param name="question" type="content">
                  <item type="image" isRef="True">кадр1.png</item>
                  <item type="image" isRef="True">кадр2.png</item>
                </param>
              </params>
              <right><answer>Матрица</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
    <round name="Финал" type="final">
      <themes>
        <theme name="Игры">
          <questions>
            <question price="0">
              <params>
                <param name="question" type="content"><item type="image" isRef="True">игра.png</item></param>
                <param name="answer" type="content"><item type="image" isRef="True">игра-ответ.png</item></param>
              </params>
              <right><answer>Satisfactory</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
  </rounds>
</package>`;

describe('разбор content.xml, версия 5 из нынешнего редактора', () => {
  const result = parseSiqContent(V5_REAL);
  const memes = result.pack.rounds[0]?.themes[0];
  const frames = result.pack.rounds[0]?.themes[1];

  it('тип вопроса читается из атрибута: secret — кот, stake — аукцион', () => {
    expect(memes?.questions.map((question) => question.type)).toEqual(['normal', 'cat', 'cat', 'auction']);
  });

  it('кот без своей темы и цены получает тему клетки и номинал, отдать нужно другому', () => {
    expect(memes?.questions[1]?.cat).toEqual({ theme: 'Мемы', price: 'nominal', canKeep: false });
  });

  it('кот со своей темой и ценой из numberSet; selectionMode any — можно оставить себе', () => {
    expect(memes?.questions[2]?.cat).toEqual({ theme: 'Кошки', price: 800, canKeep: true });
  });

  it('вопрос из одной картинки получает текст-подсказку, чтобы пак можно было играть', () => {
    expect(memes?.questions[0]?.text).toBe('Что на картинке?');
    expect(memes?.questions[0]?.media).toEqual({ kind: 'image', src: 'мем.png' });
    expect(memes?.questions[0]?.answerMedia).toEqual({ kind: 'video', src: 'ответ.mp4' });
  });

  it('если у темы есть комментарий, текстом вопроса становится он', () => {
    expect(frames?.questions[0]?.text).toBe('Назовите фильм');
  });

  it('о подставленном тексте и лишних картинках сказано в отчёте', () => {
    const messages = result.report.map((entry) => entry.message).join('\n');
    expect(messages).toContain('подставлен');
    expect(messages).toContain('перенесён первый');
  });

  it('текст рядом с фоновым аудио не теряется', () => {
    expect(memes?.questions[3]?.text).toBe('За игру с песней');
    expect(memes?.questions[3]?.media).toEqual({ kind: 'audio', src: 'тема.mp3' });
  });

  it('в финале переносится и картинка ответа', () => {
    const final = result.pack.final.themes[0]?.question;
    expect(final?.text).toBe('Что на картинке?');
    expect(final?.answerMedia).toEqual({ kind: 'image', src: 'игра-ответ.png' });
    expect(result.mediaRefs).toContain('игра-ответ.png');
  });
});

const V5_OPTIONS = `<?xml version="1.0" encoding="utf-8"?>
<package name="Варианты" version="5">
  <rounds>
    <round name="Раунд">
      <themes>
        <theme name="Художник или нейросеть">
          <questions>
            <question price="100">
              <params>
                <param name="question" type="content"><item type="image" isRef="True">картина.jpg</item></param>
                <param name="answerType">select</param>
                <param name="answerOptions" type="group">
                  <param name="A" type="content"><item>Художник</item></param>
                  <param name="B" type="content"><item>Нейросеть</item></param>
                </param>
              </params>
              <right><answer>B</answer></right>
            </question>
            <question price="200" type="simple">
              <params>
                <param name="question" type="content"><item type="image" isRef="True">одежда.jpg</item></param>
                <param name="answerType">select</param>
                <param name="answerOptions" type="group">
                  <param name="A" type="content"><item>А</item></param>
                  <param name="B" type="content"><item>В</item></param>
                  <param name="C" type="content"><item>С</item></param>
                </param>
              </params>
              <right><answer>C</answer></right>
            </question>
            <question price="300" type="forAll">
              <params>
                <param name="question" type="content"><item type="image" isRef="True">юрта.jpg</item></param>
              </params>
              <right><answer>Юрта</answer></right>
            </question>
            <question price="400">
              <params>
                <param name="question" type="content"><item type="html" isRef="True">реклама.html</item></param>
              </params>
              <right><answer>Любое</answer></right>
            </question>
            <question price="500">
              <params>
                <param name="question" type="content">
                  <item type="image" isRef="True">раз.jpg</item>
                  <item type="image" isRef="True">два.jpg</item>
                </param>
              </params>
              <right><answer>Что-то</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
  </rounds>
</package>`;

describe('вопросы с вариантами, «для всех» и вставки', () => {
  const result = parseSiqContent(V5_OPTIONS);
  const questions = result.pack.rounds[0]?.themes[0]?.questions ?? [];
  const messages = result.report.map((entry) => entry.message);

  it('варианты ответа дописываются в текст, а буква ответа превращается в сам вариант', () => {
    expect(questions[0]?.text).toBe('Варианты: A — Художник; B — Нейросеть');
    expect(questions[0]?.answer).toBe('Нейросеть');
    expect(questions[0]?.altAnswers).toEqual(['B']);
  });

  it('если варианты — просто буквы на картинке, ответ остаётся буквой', () => {
    expect(questions[1]?.text).toBe('Выберите вариант: A, B, C');
    expect(questions[1]?.answer).toBe('C');
  });

  it('forAll становится обычным вопросом, и в отчёте одна строка, а не по строке на вопрос', () => {
    expect(questions[2]?.type).toBe('normal');
    expect(messages.filter((message) => message.includes('forall'))).toHaveLength(0);
    expect(messages.some((message) => message.includes('«для всех»: 1'))).toBe(true);
  });

  it('HTML-вставка не попадает в текст вопроса именем файла', () => {
    expect(questions[3]?.text).toBe('');
    expect(messages.some((message) => message.includes('за 400') && message.includes('html'))).toBe(true);
  });

  it('о лишней картинке сказано у конкретного вопроса', () => {
    expect(questions[4]?.media).toEqual({ kind: 'image', src: 'раз.jpg' });
    expect(messages.some((message) => message.includes('за 500') && message.includes('перенесён первый'))).toBe(true);
  });
});

describe('происхождение пака', () => {
  it('импортированный пак помечен как пришедший из SIGame', () => {
    expect(parseSiqContent(V4).pack.source).toBe('siq');
  });
});
