import type { CatSpec, FinalTheme, Question, QuestionType, Round, Theme } from '@svoyak/shared';

export interface RowOptions {
  type?: QuestionType;
  altAnswers?: string[];
  hostComment?: string;
  cat?: CatSpec;
}

/** Компактная запись вопроса: цена, текст, ответ и необязательные детали. */
export type Row = [price: number, text: string, answer: string, options?: RowOptions];

export function buildTheme(themeId: string, title: string, rows: Row[]): Theme {
  return {
    id: themeId,
    title,
    questions: rows.map(([price, text, answer, options], index): Question => {
      const question: Question = {
        id: `${themeId}-q${index + 1}`,
        price,
        type: options?.type ?? 'normal',
        text,
        answer,
        altAnswers: options?.altAnswers ?? [],
      };
      if (options?.hostComment !== undefined) question.hostComment = options.hostComment;
      if (options?.cat !== undefined) question.cat = options.cat;
      return question;
    }),
  };
}

export function buildRound(roundId: string, title: string, themes: Theme[]): Round {
  return { id: roundId, title, themes };
}

export function buildFinalTheme(
  themeId: string,
  title: string,
  text: string,
  answer: string,
  altAnswers: string[] = [],
): FinalTheme {
  return {
    id: themeId,
    title,
    question: { id: `${themeId}-q`, text, answer, altAnswers },
  };
}
