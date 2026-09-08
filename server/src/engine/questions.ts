import type { Pack, Question, RoomState, Theme } from '@svoyak/shared';

export function currentRound(state: RoomState) {
  return state.pack.rounds[state.roundIndex];
}

export function findTheme(pack: Pack, roundIndex: number, themeId: string): Theme | undefined {
  return pack.rounds[roundIndex]?.themes.find((theme) => theme.id === themeId);
}

export function findQuestion(
  pack: Pack,
  roundIndex: number,
  themeId: string,
  questionId: string,
): Question | undefined {
  return findTheme(pack, roundIndex, themeId)?.questions.find(
    (question) => question.id === questionId,
  );
}

/** Вопрос, который сейчас в игре, вместе с его темой. */
export function activeQuestion(state: RoomState): Question | undefined {
  if (!state.active) return undefined;
  return findQuestion(state.pack, state.roundIndex, state.active.themeId, state.active.questionId);
}
