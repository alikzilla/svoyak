/** Спецвопросы: кот в мешке, аукцион и выбор цели модификатора. */
import type { AuctionState, RoomState } from '@svoyak/shared';
import type { Effect } from './actions.js';
import { findPlayer } from './players.js';
import { applyModifier } from './modifiers.js';
import { activeQuestion } from './questions.js';
import { minRaise, nextBidder } from './auction.js';
import type { ReduceResult, ActionOf } from './reduceCommon.js';
import { reject, log, nameOf } from './reduceCommon.js';

/** Эффекты сцены модификатора: таймер, а при нулевой настройке — его отсутствие.
 *  Имя нарочно отличается от `enterReveal`: та сцена показывает ответ на вопрос,
 *  эта — выпавший модификатор, и путать их нельзя. */
export function modifierEffects(state: RoomState, at: number): Effect[] {
  const durationMs = state.settings.modifierMs;
  if (durationMs <= 0) return [{ type: 'clearTimer' }];
  return [
    {
      type: 'setTimer',
      kind: 'modifier',
      durationMs,
      onExpire: { type: 'TIMER_EXPIRED', kind: 'modifier', at: at + durationMs },
    },
  ];
}

/** После каждой ставки: либо ход следующему, либо торги закончены и играет лидер. */
export function closeOrContinueAuction(
  state: RoomState,
  auction: AuctionState,
  afterPlayerId: string,
  at: number,
): ReduceResult {
  const turn = nextBidder(state, auction, afterPlayerId);
  const withSkipped: AuctionState = {
    ...auction,
    passedIds: [...new Set([...auction.passedIds, ...turn.skipped])],
  };

  if (turn.playerId !== null) {
    return {
      state: { ...state, auction: { ...withSkipped, turnPlayerId: turn.playerId } },
      effects: [{ type: 'persist' }],
    };
  }

  const winnerId = withSkipped.leaderId;
  const winner = winnerId ? findPlayer(state, winnerId) : undefined;
  if (!winnerId || !winner || !state.active) return reject(state, 'Торги некому выиграть');

  return {
    state: {
      ...state,
      phase: 'auction_answer',
      auction: { ...withSkipped, turnPlayerId: null },
      active: { ...state.active, price: withSkipped.currentBid, soloPlayerId: winnerId },
      log: log(state, at, `Аукцион выиграл ${winner.name} за ${withSkipped.currentBid}`),
    },
    effects: [{ type: 'persist' }],
  };
}

export function onCatTransfer(state: RoomState, action: ActionOf<'CAT_TRANSFER'>): ReduceResult {
  if (state.phase !== 'cat_transfer' || !state.cat || !state.active) {
    return reject(state, 'Сейчас никто не передаёт кота');
  }
  const question = activeQuestion(state);
  const canKeep = question?.cat?.canKeep ?? false;
  if (action.toPlayerId === state.cat.fromPlayerId && !canKeep) {
    return reject(state, 'Кота нужно отдать другому игроку');
  }
  const receiver = findPlayer(state, action.toPlayerId);
  if (!receiver) return reject(state, 'Игрок не найден');

  return {
    state: {
      ...state,
      phase: 'cat_answer',
      cat: { ...state.cat, toPlayerId: receiver.id },
      active: { ...state.active, soloPlayerId: receiver.id },
      log: log(state, action.at, `Кот в мешке достаётся ${receiver.name}: «${state.cat.theme}»`),
    },
    effects: [{ type: 'sound', sound: 'cat' }, { type: 'persist' }],
  };
}

export function onModifierTarget(state: RoomState, action: ActionOf<'MODIFIER_TARGET'>): ReduceResult {
  const modifier = state.modifier;
  if (state.phase !== 'modifier' || !modifier) return reject(state, 'Сейчас нечего менять');
  if (modifier.kind !== 'swap') return reject(state, 'Этот модификатор не меняет счёт');
  if (modifier.targetPlayerId !== null) return reject(state, 'Обмен уже состоялся');
  if (modifier.playerId !== action.playerId) {
    return reject(state, 'Выбирает тот, кто открыл клетку');
  }
  if (action.targetPlayerId === action.playerId) {
    return reject(state, 'С самим собой меняться нельзя');
  }
  const target = findPlayer(state, action.targetPlayerId);
  if (!target) return reject(state, 'Игрок не найден');

  const players = applyModifier(
    state.players,
    'swap',
    action.playerId,
    action.targetPlayerId,
    state.settings,
  );

  return {
    state: {
      ...state,
      players,
      modifier: { ...modifier, targetPlayerId: action.targetPlayerId },
      log: log(
        state,
        action.at,
        `${nameOf(state, action.playerId)} меняется счётом с ${target.name}`,
      ),
    },
    effects: [...modifierEffects(state, action.at), { type: 'persist' }],
  };
}

export function onBid(state: RoomState, action: ActionOf<'BID'>): ReduceResult {
  const auction = state.auction;
  if (state.phase !== 'auction_bidding' || !auction || !state.active) {
    return reject(state, 'Сейчас нет торгов');
  }
  if (auction.turnPlayerId !== action.playerId) return reject(state, 'Сейчас не ваш ход');
  const player = findPlayer(state, action.playerId);
  if (!player) return reject(state, 'Игрок не найден');

  const step = state.settings.auctionStep;

  if (action.amount === 'pass') {
    const passed = { ...auction, passedIds: [...auction.passedIds, action.playerId] };
    return closeOrContinueAuction(state, passed, action.playerId, action.at);
  }

  const amount = action.amount === 'all-in' ? player.score : action.amount;
  if (!Number.isFinite(amount)) return reject(state, 'Некорректная ставка');
  if (amount > player.score) return reject(state, 'Ставка больше вашего счёта');
  if (amount < minRaise(auction, step)) {
    return reject(state, `Поднимать нужно минимум до ${minRaise(auction, step)}`);
  }

  const raised: AuctionState = {
    ...auction,
    currentBid: amount,
    leaderId: action.playerId,
    allInIds:
      amount === player.score ? [...auction.allInIds, action.playerId] : auction.allInIds,
  };
  const withLog: RoomState = {
    ...state,
    log: log(
      state,
      action.at,
      `${player.name}: ${amount === player.score ? 'ва-банк' : 'ставка'} ${amount}`,
    ),
  };
  const result = closeOrContinueAuction(withLog, raised, action.playerId, action.at);
  return {
    ...result,
    effects: [
      { type: 'sound', sound: amount === player.score ? 'all_in' : 'bid' },
      ...result.effects,
    ],
  };
}
