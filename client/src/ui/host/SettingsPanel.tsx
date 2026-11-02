import { ChevronRight } from 'lucide-react';
import { DEFAULT_SETTINGS, type RoomSettings } from '@svoyak/shared';
import { Segmented } from '../../workspace/ui.js';

interface SettingsPanelProps {
  settings: RoomSettings;
  onChange: (patch: Partial<RoomSettings>) => void;
}

/** Готовые режимы: большинству хватает их, а числа прячем под «Тонкую настройку». */
const PRESETS: Array<{ id: string; title: string; hint: string; patch: Partial<RoomSettings> }> = [
  {
    id: 'calm',
    title: 'Спокойно',
    hint: 'Долгая пауза на чтение, без штрафа за ошибку.',
    patch: { readingMs: 8000, buzzOpenMs: 12000, penaltyOnWrong: false, falseStartLockMs: 1500 },
  },
  {
    id: 'standard',
    title: 'Стандарт',
    hint: 'Как в телевизоре: ошибка стоит цены вопроса.',
    patch: { readingMs: 5000, buzzOpenMs: 8000, penaltyOnWrong: true, falseStartLockMs: 2500 },
  },
  {
    id: 'hard',
    title: 'Жёстко',
    hint: 'Мало времени на нажатие и долгая блокировка за фальстарт.',
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
  ms = false,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  step?: number;
  min?: number;
  /** Значение хранится в миллисекундах, а ведущий видит и вводит секунды. */
  ms?: boolean;
  onChange: (value: number) => void;
}) {
  const scale = ms ? 1000 : 1;
  return (
    <label className="grid content-start gap-1.5">
      <span className="ws-label">{label}</span>
      <span className="relative">
        <input
          type="number"
          inputMode="decimal"
          className={`ws-input num ${ms ? 'pr-8' : ''}`}
          value={value / scale}
          step={step / scale}
          min={min / scale}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.max(min, Math.round(next * scale)));
          }}
        />
        {ms && (
          <span className="text-ws-faint pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm">
            с
          </span>
        )}
      </span>
      {hint && <span className="ws-help">{hint}</span>}
    </label>
  );
}

function SwitchRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="ws-option -mx-3">
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-[0.9375rem] font-medium">{title}</span>
        <span className="text-ws-faint text-[0.8125rem]">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="ws-switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const activePreset = PRESETS.find((preset) =>
    Object.entries(preset.patch).every(
      ([key, value]) => settings[key as keyof RoomSettings] === value,
    ),
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Segmented
          label="Темп игры"
          value={activePreset?.id ?? null}
          options={PRESETS.map((preset) => ({ value: preset.id, label: preset.title }))}
          onChange={(id) => {
            const preset = PRESETS.find((item) => item.id === id);
            if (preset) onChange(preset.patch);
          }}
        />
        <p className="text-ws-soft text-sm">
          {activePreset ? activePreset.hint : 'Свои значения — см. тонкую настройку ниже.'}
        </p>
      </div>

      <div className="grid">
        <SwitchRow
          title={`Открывать кнопку автоматически через ${seconds(settings.readingMs)} с`}
          hint={
            settings.autoOpenBuzzer
              ? 'Пауза даётся, чтобы дочитать вопрос вслух.'
              : 'Сейчас кнопку открываете вы — пробелом или кнопкой на экране.'
          }
          checked={settings.autoOpenBuzzer}
          onChange={(autoOpenBuzzer) => onChange({ autoOpenBuzzer })}
        />
        <SwitchRow
          title={`Держать ответ на экране ${seconds(settings.answerRevealMs || DEFAULT_SETTINGS.answerRevealMs)} с`}
          hint={
            settings.answerRevealMs > 0
              ? 'Закрыть раньше можно кнопкой «Дальше».'
              : 'Сейчас ответ убираете вы — кнопкой «Дальше».'
          }
          checked={settings.answerRevealMs > 0}
          onChange={(on) => onChange({ answerRevealMs: on ? DEFAULT_SETTINGS.answerRevealMs : 0 })}
        />
      </div>

      <details className="ws-disclosure border-ws-line border-t pt-3">
        <summary className="text-ws-soft hover:text-ws-fg w-fit text-sm font-medium">
          <ChevronRight size={16} className="ws-chevron" aria-hidden />
          Тонкая настройка
        </summary>
        <div className="mt-4 grid gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Показ темы и цены"
              ms
              hint="0 — вопрос открывается сразу"
              step={500}
              value={settings.announceMs}
              onChange={(announceMs) => onChange({ announceMs })}
            />
            <NumberField
              label="Пауза на чтение"
              ms
              hint="0 — кнопка открывается сразу"
              step={500}
              value={settings.readingMs}
              onChange={(readingMs) => onChange({ readingMs })}
            />
            <NumberField
              label="Окно на нажатие"
              ms
              step={500}
              value={settings.buzzOpenMs}
              onChange={(buzzOpenMs) => onChange({ buzzOpenMs })}
            />
            <NumberField
              label="Показ ответа"
              ms
              hint="0 — убираете вы"
              step={1000}
              value={settings.answerRevealMs}
              onChange={(answerRevealMs) => onChange({ answerRevealMs })}
            />
            <NumberField
              label="Сцена модификатора"
              ms
              hint="0 — закрываете вы"
              step={1000}
              value={settings.modifierMs}
              onChange={(modifierMs) => onChange({ modifierMs })}
            />
            <NumberField
              label="Блокировка за фальстарт"
              ms
              step={500}
              value={settings.falseStartLockMs}
              onChange={(falseStartLockMs) => onChange({ falseStartLockMs })}
            />
            <NumberField
              label="Добавка после чужой ошибки"
              ms
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
              label="Ставка в финале"
              ms
              step={5000}
              value={settings.finalBetTimeMs}
              onChange={(finalBetTimeMs) => onChange({ finalBetTimeMs })}
            />
            <NumberField
              label="Ответ в финале"
              ms
              step={5000}
              value={settings.finalAnswerTimeMs}
              onChange={(finalAnswerTimeMs) => onChange({ finalAnswerTimeMs })}
            />
          </div>
          <div className="grid">
            <SwitchRow
              title="Снимать стоимость за неверный ответ"
              hint="Иначе ошибка ничего не стоит."
              checked={settings.penaltyOnWrong}
              onChange={(penaltyOnWrong) => onChange({ penaltyOnWrong })}
            />
            <SwitchRow
              title="Разрешать уходить в минус"
              hint="Иначе счёт не опускается ниже нуля."
              checked={settings.allowNegative}
              onChange={(allowNegative) => onChange({ allowNegative })}
            />
            <SwitchRow
              title="В финал только с положительным счётом"
              hint="Игроки с нулём и минусом смотрят финал со стороны."
              checked={settings.finalRequiresPositive}
              onChange={(finalRequiresPositive) => onChange({ finalRequiresPositive })}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
