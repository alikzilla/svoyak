import type { ModifierPlan } from '@svoyak/shared';
import { GAME_LIMITS, MODIFIER_HINTS, MODIFIER_KINDS, MODIFIER_TITLES } from '@svoyak/shared';
import { Notice, Stepper } from '../workspace/ui.js';

interface ModifierPickerProps {
  plan: ModifierPlan;
  onChange: (plan: ModifierPlan) => void;
}

const [MIN, MAX] = GAME_LIMITS.modifiersPerRound;

/** Сколько клеток-модификаторов в раунде и какие виды могут выпасть.
 *  Под такой клеткой нет вопроса, поэтому она съедает вопрос из раунда. */
export function ModifierPicker({ plan, onChange }: ModifierPickerProps) {
  const toggle = (kind: (typeof MODIFIER_KINDS)[number]): void =>
    onChange({
      ...plan,
      kinds: plan.kinds.includes(kind) ? plan.kinds.filter((item) => item !== kind) : [...plan.kinds, kind],
    });

  return (
    <div className="grid gap-4">
      <div className="max-w-56">
        <Stepper
          label="Модификаторов на раунд"
          value={plan.perRound}
          min={MIN}
          max={MAX}
          onChange={(perRound) => onChange({ ...plan, perRound })}
          hint={plan.perRound === 0 ? 'без модификаторов' : 'каждый заменяет один вопрос'}
        />
      </div>

      {plan.perRound > 0 && (
        <div className="grid gap-2">
          <span className="ws-label">Какие могут выпасть</span>
          <ul className="-mx-3 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
            {MODIFIER_KINDS.map((kind) => (
              <li key={kind}>
                <label className="ws-option">
                  <input
                    type="checkbox"
                    className="ws-check"
                    checked={plan.kinds.includes(kind)}
                    onChange={() => toggle(kind)}
                  />
                  <span className="grid gap-0.5">
                    <span className="text-[0.9375rem] font-medium">{MODIFIER_TITLES[kind]}</span>
                    <span className="text-ws-faint text-[0.8125rem]">{MODIFIER_HINTS[kind]}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.perRound > 0 && plan.kinds.length === 0 && (
        <Notice tone="warn">Ни один вид не отмечен — модификаторов не будет.</Notice>
      )}
    </div>
  );
}
