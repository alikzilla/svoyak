import type { Pack } from './pack.js';

export interface IssuePath {
  roundId?: string;
  themeId?: string;
  questionId?: string;
}

export interface PackIssue {
  /** Ошибка мешает играть, предупреждение — повод посмотреть глазами. */
  level: 'error' | 'warning';
  message: string;
  path: IssuePath;
}

const blank = (value: string | undefined): boolean => (value ?? '').trim() === '';

/** Проверка пака перед сохранением и во время правки. Одна и та же на сервере и в редакторе. */
export function validatePack(pack: Pack): PackIssue[] {
  const issues: PackIssue[] = [];
  const add = (level: PackIssue['level'], message: string, path: IssuePath = {}): void => {
    issues.push({ level, message, path });
  };

  if (blank(pack.title)) add('error', 'Название пака не заполнено');
  if (pack.rounds.length === 0) add('error', 'В паке нет ни одного раунда');

  for (const round of pack.rounds) {
    if (round.themes.length === 0) {
      add('warning', `Раунд «${round.title}» без тем`, { roundId: round.id });
    }

    const sizes = new Set(round.themes.map((theme) => theme.questions.length));
    if (sizes.size > 1) {
      add('warning', `В раунде «${round.title}» вопросов по темам неодинаково`, {
        roundId: round.id,
      });
    }

    for (const theme of round.themes) {
      const path = { roundId: round.id, themeId: theme.id };
      if (blank(theme.title)) add('error', 'У темы нет названия', path);
      if (theme.questions.length === 0) {
        add('warning', `Тема «${theme.title}» без вопросов`, path);
      }

      const prices = theme.questions.map((question) => question.price);
      if (new Set(prices).size !== prices.length) {
        add('warning', `В теме «${theme.title}» повторяются цены вопросов`, path);
      }

      for (const question of theme.questions) {
        const questionPath = { ...path, questionId: question.id };
        if (blank(question.text)) {
          add('error', `«${theme.title}» за ${question.price}: не заполнен текст вопроса`, questionPath);
        }
        if (blank(question.answer)) {
          add('error', `«${theme.title}» за ${question.price}: не заполнен ответ`, questionPath);
        }
        if (!Number.isFinite(question.price) || question.price <= 0) {
          add('error', `«${theme.title}»: цена вопроса должна быть положительным числом`, questionPath);
        }
        if (question.type === 'cat' && !question.cat) {
          add('error', `«${theme.title}» за ${question.price}: Кот в мешке без темы и цены`, questionPath);
        }
      }
    }
  }

  if (pack.final.themes.length === 0) {
    add('error', 'Финал без тем: добавьте хотя бы одну');
  }
  for (const theme of pack.final.themes) {
    const path = { themeId: theme.id, questionId: theme.question.id };
    if (blank(theme.title)) add('error', 'У финальной темы нет названия', path);
    if (blank(theme.question.text)) {
      add('error', `Финал, «${theme.title}»: не заполнен текст вопроса`, path);
    }
    if (blank(theme.question.answer)) {
      add('error', `Финал, «${theme.title}»: не заполнен ответ`, path);
    }
  }

  return issues;
}

export const hasErrors = (issues: PackIssue[]): boolean =>
  issues.some((issue) => issue.level === 'error');
