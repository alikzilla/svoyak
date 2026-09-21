import type { ModifierKind, ModifierPlan, Pack, Player, RoomSettings } from '@svoyak/shared';
import { JACKPOT_AMOUNT, TRANSFER_AMOUNT } from '@svoyak/shared';

/** Источник случайности параметром: раскладку надо уметь проверить тестом. */
export type Random = () => number;

/** Достаёт из массива случайный элемент и удаляет его на месте (splice) —
 *  повторно тот же элемент не вытянуть. Поэтому вызывающий обязан передавать
 *  одноразовую копию массива, а не оригинал (например, `plan.kinds` из
 *  сохранённой `Game` трогать напрямую нельзя — только через `[...kinds]`). */
function drawFrom<T>(items: T[], random: Random): T | undefined {
  if (items.length === 0) return undefined;
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items.splice(index, 1)[0];
}

/** Перемешанная колода видов: пока не кончилась, виды не повторяются. */
function shuffled(kinds: readonly ModifierKind[], random: Random): ModifierKind[] {
  const rest = [...kinds];
  const deck: ModifierKind[] = [];
  while (rest.length > 0) {
    const kind = drawFrom(rest, random);
    if (kind) deck.push(kind);
  }
  return deck;
}

/** Куда лягут клетки-модификаторы. Считается один раз при создании комнаты:
 *  карта хранится в состоянии, поэтому переживает сохранение и отмену хода.
 *  Кот и аукцион не трогаются — модификатор не должен съедать спецвопрос,
 *  который автор пака поставил осознанно. В финале модификаторов нет. */
export function planModifierCells(
  pack: Pack,
  plan: ModifierPlan,
  random: Random = Math.random,
): Record<string, ModifierKind> {
  if (plan.perRound <= 0 || plan.kinds.length === 0) return {};

  const cells: Record<string, ModifierKind> = {};
  let deck: ModifierKind[] = [];

  for (const round of pack.rounds) {
    const eligible = round.themes.flatMap((theme) =>
      theme.questions.filter((question) => question.type === 'normal').map((question) => question.id),
    );
    const take = Math.min(plan.perRound, eligible.length);
    for (let index = 0; index < take; index += 1) {
      const questionId = drawFrom(eligible, random);
      if (questionId === undefined) break;
      if (deck.length === 0) deck = shuffled(plan.kinds, random);
      const kind = deck.pop();
      if (kind) cells[questionId] = kind;
    }
  }

  return cells;
}

/** Настройка «не уходить в минус» должна соблюдаться одинаково всеми.
 *  Перевёртыш, удвоение и обмен — не дельты, поэтому `applyDelta` их не ловит. */
export function clampScore(score: number, settings: RoomSettings): number {
  return settings.allowNegative ? score : Math.max(0, score);
}

/** Эффект клетки-модификатора. Чистая функция над списком игроков: ни фаз,
 *  ни таймеров, ни доски — только счёт и жетоны. */
export function applyModifier(
  players: Player[],
  kind: ModifierKind,
  playerId: string,
  targetPlayerId: string | null,
  settings: RoomSettings,
): Player[] {
  const me = players.find((player) => player.id === playerId);
  if (!me) return players;

  const withScore = (player: Player, score: number): Player => ({
    ...player,
    score: clampScore(score, settings),
  });

  switch (kind) {
    case 'nothing':
      return players;

    case 'flip':
      return players.map((player) =>
        player.id === playerId ? withScore(player, -player.score) : player,
      );

    case 'jackpot':
      return players.map((player) =>
        player.id === playerId ? withScore(player, player.score + JACKPOT_AMOUNT) : player,
      );

    case 'double':
      return players.map((player) =>
        player.id === playerId ? withScore(player, player.score * 2) : player,
      );

    case 'hint':
      return players.map((player) =>
        // Комната, восстановленная с диска, может быть сохранена до появления поля hints.
        player.id === playerId ? { ...player, hints: (player.hints ?? 0) + 1 } : player,
      );

    case 'robbery': {
      // Лидер ищется среди остальных: сам себя открывший не грабит.
      const others = players.filter((player) => player.id !== playerId);
      const leader = others.reduce<Player | null>(
        (best, player) => (best === null || player.score > best.score ? player : best),
        null,
      );
      if (!leader) return players;
      return players.map((player) => {
        if (player.id === leader.id) return withScore(player, player.score - TRANSFER_AMOUNT);
        if (player.id === playerId) return withScore(player, player.score + TRANSFER_AMOUNT);
        return player;
      });
    }

    case 'generosity': {
      const others = players.filter((player) => player.id !== playerId);
      if (others.length === 0) return players;
      return players.map((player) =>
        player.id === playerId
          ? withScore(player, player.score - TRANSFER_AMOUNT)
          : withScore(player, player.score + TRANSFER_AMOUNT),
      );
    }

    case 'swap': {
      if (targetPlayerId === null || targetPlayerId === playerId) return players;
      const target = players.find((player) => player.id === targetPlayerId);
      if (!target) return players;
      // Счёт открывшего берём заранее (`me`), а не из уже обновлённого списка,
      // иначе обмен прочитал бы половину значений после самого себя.
      return players.map((player) => {
        if (player.id === playerId) return withScore(player, target.score);
        if (player.id === targetPlayerId) return withScore(player, me.score);
        return player;
      });
    }
  }
}
