import { useState } from 'react';
import type { RoomSettings } from '@svoyak/shared';

interface SettingsPanelProps {
  settings: RoomSettings;
  onChange: (patch: Partial<RoomSettings>) => void;
}

/** Готовые режимы: большинству хватает их, а числа прячем под «ещё настройки». */
const PRESETS: Array<{ id: string; title: string; hint: string; patch: Partial<RoomSettings> }> = [
  {
    id: 'calm',
    title: 'Спокойно',
    hint: 'долгая пауза на чтение, без штрафа за ошибку',
    patch: { readingMs: 8000, buzzOpenMs: 12000, penaltyOnWrong: false, falseStartLockMs: 1500 },
  },
  {
    id: 'standard',
    title: 'Стандарт',
    hint: 'как в телевизоре',
    patch: { readingMs: 5000, buzzOpenMs: 8000, penaltyOnWrong: true, falseStartLockMs: 2500 },
  },
  {
    id: 'hard',
    title: 'Жёстко',
    hint: 'мало времени, длинная блокировка за фальстарт',
    patch: { readingMs: 3000, buzzOpenMs: 5000, penaltyOnWrong: true, falseStartLockMs: 4000 },
  },
];

const seconds = (ms: number): string => (ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1);

function NumberField({
  label,
  hint,
  value,
  step = 1,
  min = 0,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  step?: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="font-body grid gap-1 text-sm font-bold">
      <span>{label}</span>
      <input
        type="number"
        className="ink-border bg-card text-ink w-full rounded-xl px-3 py-2 tabular-nums"
        value={value}
        step={step}
        min={min}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.max(min, next));
        }}
      />
      {hint && <span className="text-xs font-bold opacity-60">{hint}</span>}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="font-body flex items-center gap-2 text-sm font-bold">
      <input
        type="checkbox"
        className="size-5"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const activePreset = PRESETS.find((preset) =>
    Object.entries(preset.patch).every(
      ([key, value]) => settings[key as keyof RoomSettings] === value,
    ),
  );

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {PRESETS.map((preset) => {
          const active = activePreset?.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.patch)}
              style={{ boxShadow: active ? '5px 5px 0 #1a1a1a' : '3px 3px 0 #1a1a1a' }}
              className={`ink-border text-ink rounded-2xl px-4 py-3 text-left ${
                active ? 'bg-p4' : 'bg-card'
              }`}
            >
              <span className="font-pop block text-lg font-black">{preset.title}</span>
              <span className="font-body block text-xs font-bold opacity-70">{preset.hint}</span>
            </button>
          );
        })}
      </div>

      <label className="ink-border bg-card text-ink font-body flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold">
        <input
          type="checkbox"
          className="size-5"
          checked={settings.autoOpenBuzzer}
          onChange={(event) => onChange({ autoOpenBuzzer: event.target.checked })}
        />
        <span>
          Открывать кнопку самому через {seconds(settings.readingMs)} с
          <span className="block text-xs font-bold opacity-60">
            {settings.autoOpenBuzzer
              ? 'пауза даётся, чтобы дочитать вопрос вслух'
              : 'сейчас кнопку открывает ведущий вручную'}
          </span>
        </span>
      </label>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="font-body justify-self-start text-sm font-bold underline underline-offset-4 opacity-70"
      >
        {expanded ? 'свернуть настройки' : 'ещё настройки'}
      </button>

      {expanded && (
        <div className="ink-border bg-card text-ink grid gap-4 rounded-2xl p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField
              label="Пауза на чтение, мс"
              hint="0 — кнопка открывается сразу"
              step={500}
              value={settings.readingMs}
              onChange={(readingMs) => onChange({ readingMs })}
            />
            <NumberField
              label="Окно на нажатие, мс"
              step={500}
              value={settings.buzzOpenMs}
              onChange={(buzzOpenMs) => onChange({ buzzOpenMs })}
            />
            <NumberField
              label="Блокировка за фальстарт, мс"
              step={500}
              value={settings.falseStartLockMs}
              onChange={(falseStartLockMs) => onChange({ falseStartLockMs })}
            />
            <NumberField
              label="Добавка после чужой ошибки, мс"
              step={500}
              value={settings.buzzReopenMinMs}
              onChange={(buzzReopenMinMs) => onChange({ buzzReopenMinMs })}
            />
            <NumberField
              label="Шаг ставки на аукционе"
              step={50}
              min={1}
              value={settings.auctionStep}
              onChange={(auctionStep) => onChange({ auctionStep })}
            />
            <NumberField
              label="Время на ставку в финале, мс"
              step={5000}
              value={settings.finalBetTimeMs}
              onChange={(finalBetTimeMs) => onChange({ finalBetTimeMs })}
            />
            <NumberField
              label="Время на ответ в финале, мс"
              step={5000}
              value={settings.finalAnswerTimeMs}
              onChange={(finalAnswerTimeMs) => onChange({ finalAnswerTimeMs })}
            />
          </div>
          <div className="grid gap-2">
            <Check
              label="Снимать стоимость за неверный ответ"
              checked={settings.penaltyOnWrong}
              onChange={(penaltyOnWrong) => onChange({ penaltyOnWrong })}
            />
            <Check
              label="Разрешать уходить в минус"
              checked={settings.allowNegative}
              onChange={(allowNegative) => onChange({ allowNegative })}
            />
            <Check
              label="В финал пускать только с положительным счётом"
              checked={settings.finalRequiresPositive}
              onChange={(finalRequiresPositive) => onChange({ finalRequiresPositive })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
