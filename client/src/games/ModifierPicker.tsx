import type { ModifierPlan } from '@svoyak/shared';
import { GAME_LIMITS, MODIFIER_HINTS, MODIFIER_KINDS, MODIFIER_TITLES } from '@svoyak/shared';

interface ModifierPickerProps {
  plan: ModifierPlan;
  onChange: (plan: ModifierPlan) => void;
}

const [MIN, MAX] = GAME_LIMITS.modifiersPerRound;

/** Сколько клеток-модификаторов в раунде и какие виды могут выпасть.
 *  Под такой клеткой нет вопроса, поэтому она съедает вопрос из раунда. */
export function ModifierPicker({ plan, onChange }: ModifierPickerProps) {
  const setPerRound = (next: number): void =>
    onChange({ ...plan, perRound: Math.min(MAX, Math.max(MIN, next)) });

  const toggle = (kind: (typeof MODIFIER_KINDS)[number]): void =>
    onChange({
      ...plan,
      kinds: plan.kinds.includes(kind)
        ? plan.kinds.filter((item) => item !== kind)
        : [...plan.kinds, kind],
    });

  return (
    <section className="ink-border bg-card text-ink grid gap-3 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-body text-sm font-bold">Модификаторов на раунд</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Модификаторов меньше"
            onClick={() => setPerRound(plan.perRound - 1)}
            className="ink-border size-8 rounded-lg font-black"
          >
            −
          </button>
          <span className="font-pop w-6 text-center text-xl font-black tabular-nums">
            {plan.perRound}
          </span>
          <button
            type="button"
            aria-label="Модификаторов больше"
            onClick={() => setPerRound(plan.perRound + 1)}
            className="ink-border size-8 rounded-lg font-black"
          >
            +
          </button>
        </span>
      </div>

      {plan.perRound > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {MODIFIER_KINDS.map((kind) => (
            <label key={kind} className="font-body flex items-start gap-2 text-sm font-bold">
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={plan.kinds.includes(kind)}
                onChange={() => toggle(kind)}
              />
              <span>
                {MODIFIER_TITLES[kind]}
                <span className="block text-xs font-bold opacity-60">{MODIFIER_HINTS[kind]}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {plan.perRound > 0 && plan.kinds.length === 0 && (
        <p className="font-body text-no text-xs font-bold">
          Ни один вид не включён — модификаторов не будет
        </p>
      )}
    </section>
  );
}
