import type {
  ComposeRequest,
  ComposeResponse,
  GameRecipe,
  Pack,
  Question,
  Round,
  Theme,
  ThemeOption,
  ThemeRef,
} from '@svoyak/shared';

/** Ищет пак по идентификатору. Отдельным параметром, чтобы сборку можно было
 *  проверить тестом без файлов на диске. */
export type PackLookup = (packId: string) => Pack | null;

const ROUND_NAMES = ['Первый раунд', 'Второй раунд', 'Третий раунд', 'Четвёртый раунд', 'Пятый раунд'];

const roundTitle = (index: number): string => ROUND_NAMES[index] ?? `Раунд ${index + 1}`;

/** Цена клетки задаётся положением вопроса и номером раунда, а не тем, из какого
 *  пака пришла тема: иначе в одном раунде окажутся разные сетки цен. */
const priceAt = (roundIndex: number, questionIndex: number): number =>
  (questionIndex + 1) * 100 * (roundIndex + 1);

function findRoundTheme(pack: Pack, themeId: string): Theme | null {
  for (const round of pack.rounds) {
    const theme = round.themes.find((candidate) => candidate.id === themeId);
    if (theme) return theme;
  }
  return null;
}

function resolve(lookup: PackLookup, ref: ThemeRef): Pack {
  const pack = lookup(ref.packId);
  if (!pack) throw new Error(`Пак «${ref.packId}» не найден`);
  return pack;
}

/** Собирает обычный пак из ссылок на темы. Дальше он живёт в комнате как любой
 *  другой: движок, доска и сохранение о сборке ничего не знают. */
export function buildPackFromRecipe(recipe: GameRecipe, lookup: PackLookup, now = Date.now()): Pack {
  if (recipe.rounds.length === 0) throw new Error('В игре нет ни одного раунда');
  if (recipe.final.length === 0) throw new Error('В игре нет ни одной финальной темы');

  const id = `game-${now.toString(36)}`;
  const titles = new Set<string>();

  const rounds: Round[] = recipe.rounds.map((refs, roundIndex) => {
    if (refs.length === 0) throw new Error(`В раунде ${roundIndex + 1} нет тем`);
    return {
      id: `${id}-r${roundIndex + 1}`,
      title: roundTitle(roundIndex),
      themes: refs.map((ref, themeIndex) => {
        const pack = resolve(lookup, ref);
        const source = findRoundTheme(pack, ref.themeId);
        if (!source) throw new Error(`Тема не найдена: ${ref.packId}/${ref.themeId}`);
        titles.add(pack.title);
        const themeId = `${id}-r${roundIndex + 1}-t${themeIndex + 1}`;
        const questions: Question[] = source.questions.map((question, questionIndex) => ({
          ...question,
          id: `${themeId}-q${questionIndex + 1}`,
          price: priceAt(roundIndex, questionIndex),
        }));
        return {
          ...source,
          id: themeId,
          questions,
        };
      }),
    };
  });

  const finalThemes = recipe.final.map((ref, index) => {
    const pack = resolve(lookup, ref);
    const source = pack.final.themes.find((candidate) => candidate.id === ref.themeId);
    if (!source) throw new Error(`Тема не найдена: ${ref.packId}/${ref.themeId}`);
    titles.add(pack.title);
    const themeId = `${id}-f${index + 1}`;
    return {
      ...source,
      id: themeId,
      question: { ...source.question, id: `${themeId}-q` },
    };
  });

  return {
    id,
    title: [...titles].join(' + ') || 'Своя игра',
    author: 'Свояк',
    description: `Сборная игра: ${rounds.length} раунда, ${rounds.reduce((sum, round) => sum + round.themes.length, 0)} тем`,
    createdAt: now,
    updatedAt: now,
    rounds,
    final: { themes: finalThemes },
  };
}

/** Простой воспроизводимый генератор: seed отдаётся клиенту, поэтому «пересобрать»
 *  можно повторить и объяснить. Криптостойкость здесь не нужна. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Все темы раундов выбранных паков — с подписями для превью. */
export function listThemeOptions(packIds: string[], lookup: PackLookup): ThemeOption[] {
  const options: ThemeOption[] = [];
  for (const packId of packIds) {
    const pack = lookup(packId);
    if (!pack) continue;
    for (const round of pack.rounds) {
      for (const theme of round.themes) {
        options.push({
          packId,
          themeId: theme.id,
          title: theme.title,
          packTitle: pack.title,
          questionsCount: theme.questions.length,
        });
      }
    }
  }
  return options;
}

/** Финальные темы выбранных паков. */
export function listFinalOptions(packIds: string[], lookup: PackLookup): ThemeOption[] {
  const options: ThemeOption[] = [];
  for (const packId of packIds) {
    const pack = lookup(packId);
    if (!pack) continue;
    for (const theme of pack.final.themes) {
      options.push({
        packId,
        themeId: theme.id,
        title: theme.title,
        packTitle: pack.title,
        questionsCount: 1,
      });
    }
  }
  return options;
}

const strip = (option: ThemeOption): ThemeRef => ({ packId: option.packId, themeId: option.themeId });

/** Раздаёт темы по кругу: сначала по одной из каждого пака, потом по второй и так
 *  далее. Простая перетасовка всех тем скучивала бы в раунде один пак, а вечер
 *  на трёх темах «Автомобилей» подряд — не то, чего ждут от микса. */
function dealAcrossPacks(options: ThemeOption[], random: () => number): ThemeOption[] {
  const byPack = new Map<string, ThemeOption[]>();
  for (const option of options) {
    const bucket = byPack.get(option.packId);
    if (bucket) bucket.push(option);
    else byPack.set(option.packId, [option]);
  }

  const queues = shuffled(
    [...byPack.values()].map((bucket) => shuffled(bucket, random)),
    random,
  );

  const dealt: ThemeOption[] = [];
  for (let depth = 0; dealt.length < options.length; depth += 1) {
    for (const queue of queues) {
      const option = queue[depth];
      if (option) dealt.push(option);
    }
  }
  return dealt;
}

/** Случайный, но воспроизводимый состав игры из выбранных паков. */
export function draftRecipe(request: ComposeRequest, lookup: PackLookup): ComposeResponse {
  const seed = request.seed ?? Math.floor(Math.random() * 2 ** 31);
  const random = mulberry32(seed);

  const needed = request.rounds * request.themesPerRound;
  const pool = dealAcrossPacks(listThemeOptions(request.packIds, lookup), random);
  if (pool.length < needed) {
    throw new Error(
      `В выбранных паках не хватает тем: нужно ${needed}, есть ${pool.length}. Возьмите больше паков или уменьшите раунды.`,
    );
  }

  const finalPool = shuffled(listFinalOptions(request.packIds, lookup), random);
  if (finalPool.length < request.finalThemes) {
    throw new Error(
      `В выбранных паках не хватает финальных тем: нужно ${request.finalThemes}, есть ${finalPool.length}.`,
    );
  }

  const rounds: ThemeOption[][] = [];
  for (let index = 0; index < request.rounds; index += 1) {
    rounds.push(pool.slice(index * request.themesPerRound, (index + 1) * request.themesPerRound));
  }
  const final = finalPool.slice(0, request.finalThemes);

  return {
    recipe: {
      rounds: rounds.map((round) => round.map(strip)),
      final: final.map(strip),
    },
    seed,
    rounds,
    final,
    pool: pool.slice(needed),
    finalPool: finalPool.slice(request.finalThemes),
  };
}
