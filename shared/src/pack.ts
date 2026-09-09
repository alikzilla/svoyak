/** Модель пака вопросов. Один и тот же формат используется файлами на диске,
 *  редактором и импортом .siq. */

export type QuestionType = 'normal' | 'cat' | 'auction';
export type MediaKind = 'image' | 'audio' | 'video';

export interface Media {
  kind: MediaKind;
  /** Путь вида `/uploads/<packId>/<file>` либо внешний URL. */
  src: string;
}

/** Содержательная часть вопроса — общая для обычных и финальных. */
export interface QuestionContent {
  text: string;
  media?: Media;
  answer: string;
  /** Другие формулировки, которые ведущий готов принять. */
  altAnswers: string[];
  answerMedia?: Media;
  /** Комментарий, который видит только ведущий. */
  hostComment?: string;
}

/** Кот в мешке: вопрос передаётся другому игроку. */
export interface CatSpec {
  /** Тема кота — объявляется до передачи. */
  theme: string;
  /** Стоимость: число или `nominal` — как у клетки. */
  price: number | 'nominal';
  /** Разрешено ли оставить кота себе. По умолчанию false. */
  canKeep: boolean;
}

export interface Question extends QuestionContent {
  id: string;
  price: number;
  type: QuestionType;
  /** Заполняется только при `type === 'cat'`. */
  cat?: CatSpec;
}

export interface Theme {
  id: string;
  title: string;
  /** Пояснение к теме, зачитывается ведущим. */
  comment?: string;
  questions: Question[];
}

export interface Round {
  id: string;
  title: string;
  themes: Theme[];
}

export interface FinalQuestion extends QuestionContent {
  id: string;
}

export interface FinalTheme {
  id: string;
  title: string;
  question: FinalQuestion;
}

export interface FinalRound {
  themes: FinalTheme[];
}

export interface PackMeta {
  id: string;
  title: string;
  author?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Pack extends PackMeta {
  rounds: Round[];
  final: FinalRound;
}

/** Краткая карточка пака для списков в редакторе и лобби. */
export interface PackSummary extends PackMeta {
  roundsCount: number;
  questionsCount: number;
  finalThemesCount: number;
  /** Пройдёт ли пак проверку перед игрой. Недоделанный можно править, но не играть. */
  playable: boolean;
}
