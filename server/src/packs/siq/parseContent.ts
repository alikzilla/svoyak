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
}

/** Текст и медиа вопроса: старый формат хранит их в scenario, новый — в params.
 *  В старом всё, что идёт после `<atom type="marker"/>`, относится к ответу. */
function readContent(question: XmlNode): QuestionContent {
  const parts: string[] = [];
  const answerParts: string[] = [];
  let media: Media | undefined;
  let answerMedia: Media | undefined;
  let afterMarker = false;

  const push = (kind: MediaKind | undefined, value: string): void => {
    if (kind && value !== '') {
      if (afterMarker) answerMedia ??= mediaFrom(kind, value);
      else media ??= mediaFrom(kind, value);
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
      push(MEDIA_KINDS[String(item['@_type'] ?? '').toLowerCase()], text(item));
    }
  }

  return {
    body: parts.join('\n'),
    media,
    answerText: answerParts.join('\n'),
    answerMedia,
  };
}

function readQuestion(
  raw: XmlNode,
  themeTitle: string,
  report: ImportEntry[],
  mediaRefs: string[],
  index: number,
): Question {
  const price = Number(raw['@_price'] ?? 0) || 0;
  const { body, media, answerText, answerMedia } = readContent(raw);

  const right = raw['right'] as XmlNode | undefined;
  const answers = asArray(right?.['answer'] as string | string[] | undefined)
    .map((value) => text(value))
    .filter((value) => value !== '');

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

  const typeNode = raw['type'] as XmlNode | undefined;
  const rawTypeName = String(typeNode?.['@_name'] ?? '').toLowerCase();
  const type = QUESTION_TYPES[rawTypeName] ?? 'normal';
  if (rawTypeName !== '' && !(rawTypeName in QUESTION_TYPES)) {
    report.push({
      level: 'warning',
      message: `«${themeTitle}» за ${price}: неизвестный тип «${rawTypeName}» — сделан обычным`,
    });
  }

  const question: Question = {
    id: `q-${index}-${Math.random().toString(36).slice(2, 8)}`,
    price,
    type,
    text: body,
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
    const catPrice = Number(param(typeNode, 'cost') || param(typeNode, 'price'));
    question.cat = {
      theme: param(typeNode, 'theme'),
      price: Number.isFinite(catPrice) && catPrice > 0 ? catPrice : 'nominal',
      canKeep: false,
    };
  }

  return question;
}

function readTheme(raw: XmlNode, report: ImportEntry[], mediaRefs: string[], index: number): Theme {
  const title = String(raw['@_name'] ?? 'Без названия');
  const info = raw['info'] as XmlNode | undefined;
  const comment = text(info?.['comments']);

  const questions = asArray(
    (raw['questions'] as XmlNode | undefined)?.['question'] as XmlNode | XmlNode[] | undefined,
  ).map((question, questionIndex) =>
    readQuestion(question, title, report, mediaRefs, index * 100 + questionIndex),
  );

  const theme: Theme = { id: `t-${index}-${Math.random().toString(36).slice(2, 8)}`, title, questions };
  if (comment !== '') theme.comment = comment;
  return theme;
}

/** Разбор content.xml из архива .siq. Формат менял версии, поэтому берём и старую, и новую форму. */
export function parseSiqContent(xml: string, now = Date.now()): ParsedSiq {
  const report: ImportEntry[] = [];
  const mediaRefs: string[] = [];

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
  const pack = emptyPack(title);

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
    ).map((theme, themeIndex) => readTheme(theme, report, mediaRefs, roundIndex * 100 + themeIndex));

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
      message: 'Финальный раунд в паке не найден — добавьте темы финала вручную',
    });
  } else {
    pack.final.themes = asArray(
      (firstFinal['themes'] as XmlNode | undefined)?.['theme'] as XmlNode | XmlNode[] | undefined,
    ).map((raw, index): FinalTheme => {
      const theme = readTheme(raw, report, mediaRefs, 900 + index);
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

  return { pack, report, mediaRefs };
}
