import { XMLParser } from 'fast-xml-parser';
import type {
  FinalTheme,
  Media,
  MediaKind,
  Pack,
  Question,
  QuestionType,
  Round,
  Theme,
} from '@svoyak/shared';
import { makePackId } from '../blank.js';

export interface ImportEntry {
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface ParsedSiq {
  pack: Pack;
  report: ImportEntry[];
  /** Ссылки на файлы внутри архива, которые предстоит достать. */
  mediaRefs: string[];
}

/** fast-xml-parser отдаёт одиночные узлы объектом, а не массивом. */
function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

const text = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && '#text' in value) return String((value as { '#text': unknown })['#text']).trim();
  return '';
};

/** В .siq медиа помечается собачкой: `@file.jpg` — файл внутри архива. */
function mediaFrom(kind: MediaKind, raw: string): Media {
  return { kind, src: raw.startsWith('@') ? raw.slice(1) : raw };
}

const MEDIA_KINDS: Record<string, MediaKind> = {
  image: 'image',
  voice: 'audio',
  audio: 'audio',
  video: 'video',
};

/** Типы вопросов: слева — как их называет SIGame в разных версиях формата. */
const QUESTION_TYPES: Record<string, QuestionType> = {
  cat: 'cat',
  bagcat: 'cat',
  secret: 'cat',
  secretpublicprice: 'cat',
  secretnoquestion: 'cat',
  auction: 'auction',
  stake: 'auction',
  norisk: 'normal',
  sponsored: 'normal',
  simple: 'normal',
  // «Для всех» в SIGame отвечают все письменно; у нас такого нет — играем как обычный.
  forall: 'normal',
};

interface XmlNode {
  [key: string]: unknown;
}

function param(node: XmlNode | undefined, name: string): string {
  for (const item of asArray(node?.['param'] as XmlNode | XmlNode[] | undefined)) {
    if (String(item['@_name']).toLowerCase() === name) return text(item);
  }
  return '';
}

interface QuestionContent {
  body: string;
  media: Media | undefined;
  answerText: string;
  answerMedia: Media | undefined;
  /** Сколько файлов не влезло: у нас одно медиа на вопрос и одно на ответ. */
  extraMedia: number;
  /** Типы вставок, которые мы показать не умеем (html и т. п.). */
  unsupported: string[];
}

/** Общая для всего пака сводка: что подправили по дороге. */
interface ParseContext {
  report: ImportEntry[];
  mediaRefs: string[];
  filledText: number;
  withOptions: number;
  forAll: number;
}

/** Чем назвать вопрос, у которого есть только картинка, звук или видео. */
const PROMPT_BY_KIND: Record<MediaKind, string> = {
  image: 'Что на картинке?',
  audio: 'Что звучит?',
  video: 'Что на видео?',
};

/** Текст и медиа вопроса: старый формат хранит их в scenario, новый — в params.
 *  В старом всё, что идёт после `<atom type="marker"/>`, относится к ответу. */
function readContent(question: XmlNode): QuestionContent {
  const parts: string[] = [];
  const answerParts: string[] = [];
  let media: Media | undefined;
  let answerMedia: Media | undefined;
  let afterMarker = false;
  let extraMedia = 0;
  const unsupported: string[] = [];

  const push = (kind: MediaKind | undefined, value: string): void => {
    if (kind && value !== '') {
      const taken = afterMarker ? answerMedia : media;
      if (taken) extraMedia += 1;
      else if (afterMarker) answerMedia = mediaFrom(kind, value);
      else media = mediaFrom(kind, value);
      return;
    }
    if (value === '') return;
    if (afterMarker) answerParts.push(value);
    else parts.push(value);
  };

  const scenario = question['scenario'] as XmlNode | undefined;
  for (const atom of asArray(scenario?.['atom'] as XmlNode | XmlNode[] | undefined)) {
    const rawType = String(atom['@_type'] ?? '').toLowerCase();
    if (rawType === 'marker') {
      afterMarker = true;
      continue;
    }
    const kind = MEDIA_KINDS[rawType];
    if (!kind && rawType !== '' && rawType !== 'say') continue;
    push(kind, text(atom));
  }

  const params = question['params'] as XmlNode | undefined;
  for (const entry of asArray(params?.['param'] as XmlNode | XmlNode[] | undefined)) {
    const name = String(entry['@_name']).toLowerCase();
    if (name !== 'question' && name !== 'answer') continue;
    afterMarker = name === 'answer';
    for (const item of asArray(entry['item'] as XmlNode | XmlNode[] | undefined)) {
      const itemType = String((item as XmlNode)['@_type'] ?? '').toLowerCase();
      if (itemType !== '' && itemType !== 'text' && !(itemType in MEDIA_KINDS)) {
        // Имя файла такой вставки — не текст вопроса, его нельзя показывать игрокам.
        unsupported.push(itemType);
        continue;
      }
      push(MEDIA_KINDS[itemType], text(item));
    }
  }

  return {
    body: parts.join('\n'),
    media,
    answerText: answerParts.join('\n'),
    answerMedia,
    extraMedia,
    unsupported,
  };
}

interface AnswerOption {
  label: string;
  text: string;
}

/** Вопрос с выбором ответа (v5): answerType=select и группа answerOptions. */
function readOptions(params: XmlNode | undefined): AnswerOption[] {
  if (param(params, 'answertype').toLowerCase() !== 'select') return [];
  for (const entry of asArray(params?.['param'] as XmlNode | XmlNode[] | undefined)) {
    if (String(entry['@_name']).toLowerCase() !== 'answeroptions') continue;
    return asArray(entry['param'] as XmlNode | XmlNode[] | undefined).map((option) => ({
      label: String(option['@_name'] ?? '').trim(),
      text: asArray(option['item'] as XmlNode | XmlNode[] | undefined)
        .filter((item) => !(String((item as XmlNode)['@_type'] ?? '').toLowerCase() in MEDIA_KINDS))
        .map((item) => text(item))
        .filter((value) => value !== '')
        .join(' '),
    }));
  }
  return [];
}

/** Варианты-буквы: сами варианты нарисованы на картинке, в паке только «А», «В», «С». */
const lettersOnly = (options: AnswerOption[]): boolean =>
  options.every((option) => option.text.length <= 1);

function optionsLine(options: AnswerOption[]): string {
  return lettersOnly(options)
    ? `Выберите вариант: ${options.map((option) => option.label).join(', ')}`
    : `Варианты: ${options.map((option) => `${option.label} — ${option.text || option.label}`).join('; ')}`;
}

/** Число из параметра цены: в v4 это просто текст, в v5 — numberSet с границами. */
function priceParam(node: XmlNode | undefined): number | undefined {
  for (const item of asArray(node?.['param'] as XmlNode | XmlNode[] | undefined)) {
    const name = String(item['@_name']).toLowerCase();
    if (name !== 'price' && name !== 'cost') continue;
    const range = item['numberSet'] as XmlNode | undefined;
    // Диапазон «от и до» мы не поддерживаем: берём цену, только если она одна.
    const value = range
      ? range['@_minimum'] === range['@_maximum']
        ? Number(range['@_minimum'])
        : NaN
      : Number(text(item));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function readQuestion(
  raw: XmlNode,
  themeTitle: string,
  themeComment: string,
  ctx: ParseContext,
  index: number,
): Question {
  const { report, mediaRefs } = ctx;
  const price = Number(raw['@_price'] ?? 0) || 0;
  const { body, media, answerText, answerMedia, extraMedia, unsupported } = readContent(raw);
  if (extraMedia > 0) {
    report.push({
      level: 'warning',
      message: `«${themeTitle}» за ${price}: лишних файлов ${extraMedia} — у нас одно медиа на вопрос и одно на ответ, перенесён первый`,
    });
  }
  for (const kind of new Set(unsupported)) {
    report.push({
      level: 'warning',
      message: `«${themeTitle}» за ${price}: вставка типа «${kind}» не поддерживается — пропущена`,
    });
  }

  const right = raw['right'] as XmlNode | undefined;
  let answers = asArray(right?.['answer'] as string | string[] | undefined)
    .map((value) => text(value))
    .filter((value) => value !== '');

  // В вопросе с выбором правильный ответ записан буквой — ведущему нужен сам вариант.
  const options = readOptions(raw['params'] as XmlNode | undefined);
  if (options.length > 0 && !lettersOnly(options)) {
    const chosen = options.find((option) => option.label.toLowerCase() === answers[0]?.toLowerCase());
    if (chosen && chosen.text !== '') answers = [chosen.text, chosen.label, ...answers.slice(1)];
  }

  if (answers.length === 0) {
    report.push({
      level: 'warning',
      message: `«${themeTitle}» за ${price}: вопрос без ответа — заполните вручную`,
    });
  }

  const wrong = raw['wrong'] as XmlNode | undefined;
  const wrongAnswers = asArray(wrong?.['answer'] as string | string[] | undefined)
    .map((value) => text(value))
    .filter((value) => value !== '');
  if (wrongAnswers.length > 0) {
    report.push({
      level: 'info',
      message: `«${themeTitle}» за ${price}: Неверные ответы из пака не переносятся (${wrongAnswers.join(', ')})`,
    });
  }

  // v4 описывает тип узлом <type name>, v5 — атрибутом самого вопроса.
  const typeNode = raw['type'] as XmlNode | undefined;
  const rawTypeName = String(raw['@_type'] ?? typeNode?.['@_name'] ?? '').toLowerCase();
  if (rawTypeName === 'forall') ctx.forAll += 1;
  const type = QUESTION_TYPES[rawTypeName] ?? 'normal';
  if (rawTypeName !== '' && !(rawTypeName in QUESTION_TYPES)) {
    report.push({
      level: 'warning',
      message: `«${themeTitle}» за ${price}: неизвестный тип «${rawTypeName}» — сделан обычным`,
    });
  }

  // Вопрос «по картинке» в SIGame часто без слов, а у нас без текста пак не играется.
  let questionText = body;
  if (options.length > 0) {
    questionText = [body, optionsLine(options)].filter((part) => part !== '').join(' ');
    ctx.withOptions += 1;
  } else if (questionText === '' && media) {
    questionText = themeComment !== '' ? themeComment : PROMPT_BY_KIND[media.kind];
    ctx.filledText += 1;
  }

  const question: Question = {
    id: `q-${index}-${Math.random().toString(36).slice(2, 8)}`,
    price,
    type,
    text: questionText,
    answer: answers[0] ?? '',
    altAnswers: answers.slice(1),
  };

  if (media) {
    question.media = media;
    mediaRefs.push(media.src);
  }
  if (answerMedia) {
    question.answerMedia = answerMedia;
    mediaRefs.push(answerMedia.src);
  }
  // Текст после разделителя — это комментарий к ответу, ведущему он пригодится.
  if (answerText !== '' && answerText !== question.answer) question.hostComment = answerText;

  if (type === 'cat') {
    const params = raw['params'] as XmlNode | undefined;
    const catTheme = param(typeNode, 'theme') || param(params, 'theme');
    // exceptCurrent — отдать другому обязательно, any — можно и себе.
    const selection = param(params, 'selectionmode').toLowerCase();
    question.cat = {
      theme: catTheme !== '' ? catTheme : themeTitle,
      price: priceParam(typeNode) ?? priceParam(params) ?? 'nominal',
      canKeep: selection === 'any',
    };
  }

  return question;
}

function readTheme(raw: XmlNode, ctx: ParseContext, index: number): Theme {
  const title = String(raw['@_name'] ?? 'Без названия').trim();
  const info = raw['info'] as XmlNode | undefined;
  const comment = text(info?.['comments']);

  const questions = asArray(
    (raw['questions'] as XmlNode | undefined)?.['question'] as XmlNode | XmlNode[] | undefined,
  ).map((question, questionIndex) =>
    readQuestion(question, title, comment, ctx, index * 100 + questionIndex),
  );

  const theme: Theme = { id: `t-${index}-${Math.random().toString(36).slice(2, 8)}`, title, questions };
  if (comment !== '') theme.comment = comment;
  return theme;
}

/** Разбор content.xml из архива .siq. Формат менял версии, поэтому берём и старую, и новую форму. */
export function parseSiqContent(xml: string, now = Date.now()): ParsedSiq {
  const report: ImportEntry[] = [];
  const mediaRefs: string[] = [];
  const ctx: ParseContext = { report, mediaRefs, filledText: 0, withOptions: 0, forAll: 0 };

  const emptyPack = (title: string): Pack => ({
    id: makePackId(title),
    title,
    createdAt: now,
    updatedAt: now,
    rounds: [],
    final: { themes: [] },
  });

  let parsed: XmlNode;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: false,
      trimValues: true,
    });
    parsed = parser.parse(xml) as XmlNode;
  } catch (cause) {
    report.push({
      level: 'error',
      message: `Не удалось разобрать content.xml: ${cause instanceof Error ? cause.message : 'ошибка'}`,
    });
    return { pack: emptyPack('Импортированный пак'), report, mediaRefs };
  }

  const pkg = parsed['package'] as XmlNode | undefined;
  if (!pkg) {
    report.push({ level: 'error', message: 'В content.xml нет узла package — это не пак SIGame' });
    return { pack: emptyPack('Импортированный пак'), report, mediaRefs };
  }

  const title = String(pkg['@_name'] ?? 'Импортированный пак');
  const pack: Pack = { ...emptyPack(title), source: 'siq' };

  const info = pkg['info'] as XmlNode | undefined;
  const authors = asArray(
    (info?.['authors'] as XmlNode | undefined)?.['author'] as string | string[] | undefined,
  )
    .map((value) => text(value))
    .filter((value) => value !== '');
  if (authors.length > 0) pack.author = authors.join(', ');

  const rounds = asArray(
    (pkg['rounds'] as XmlNode | undefined)?.['round'] as XmlNode | XmlNode[] | undefined,
  );

  const finalRounds = rounds.filter((round) => String(round['@_type'] ?? '').toLowerCase() === 'final');
  const normalRounds = rounds.filter((round) => String(round['@_type'] ?? '').toLowerCase() !== 'final');

  pack.rounds = normalRounds.map((round, roundIndex): Round => {
    const themes = asArray(
      (round['themes'] as XmlNode | undefined)?.['theme'] as XmlNode | XmlNode[] | undefined,
    ).map((theme, themeIndex) => readTheme(theme, ctx, roundIndex * 100 + themeIndex));

    return {
      id: `r-${roundIndex}-${Math.random().toString(36).slice(2, 8)}`,
      title: String(round['@_name'] ?? `Раунд ${roundIndex + 1}`),
      themes,
    };
  });

  const firstFinal = finalRounds[0];
  if (!firstFinal) {
    report.push({
      level: 'warning',
      message: 'Финального раунда в паке нет — после последнего раунда сразу итоги; темы финала можно добавить в редакторе',
    });
  } else {
    pack.final.themes = asArray(
      (firstFinal['themes'] as XmlNode | undefined)?.['theme'] as XmlNode | XmlNode[] | undefined,
    ).map((raw, index): FinalTheme => {
      const theme = readTheme(raw, ctx, 900 + index);
      const question = theme.questions[0];
      return {
        id: theme.id,
        title: theme.title,
        question: {
          id: `${theme.id}-q`,
          text: question?.text ?? '',
          answer: question?.answer ?? '',
          altAnswers: question?.altAnswers ?? [],
          ...(question?.media ? { media: question.media } : {}),
          ...(question?.answerMedia ? { answerMedia: question.answerMedia } : {}),
          ...(question?.hostComment ? { hostComment: question.hostComment } : {}),
        },
      };
    });
  }

  if (finalRounds.length > 1) {
    report.push({
      level: 'warning',
      message: `Финальных раундов в паке ${finalRounds.length} — взят первый`,
    });
  }

  if (ctx.filledText > 0) {
    report.push({
      level: 'info',
      message: `Вопросов только с картинкой, звуком или видео: ${ctx.filledText} — подставлен текст вроде «Что на картинке?» или комментарий темы, поправьте при желании`,
    });
  }
  if (ctx.withOptions > 0) {
    report.push({
      level: 'info',
      message: `Вопросов с вариантами ответа: ${ctx.withOptions} — варианты дописаны в текст вопроса`,
    });
  }
  if (ctx.forAll > 0) {
    report.push({
      level: 'info',
      message: `Вопросов «для всех»: ${ctx.forAll} — у нас они обычные: отвечает тот, кто нажал первым`,
    });
  }

  return { pack, report, mediaRefs };
}
