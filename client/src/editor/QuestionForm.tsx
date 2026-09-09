import type { Media, Question, QuestionType } from '@svoyak/shared';
import { MediaField } from './MediaField.js';

interface QuestionFormProps {
  packId: string;
  question: Question;
  onChange: (question: Question) => void;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  normal: 'Обычный',
  cat: 'Кот в мешке',
  auction: 'Аукцион',
};

const field =
  'w-full ink-border rounded-xl bg-white/70 px-3 py-2 text-ink placeholder:text-ink/30 focus:border-p1';

export function QuestionForm({ packId, question, onChange }: QuestionFormProps) {
  const patch = (over: Partial<Question>): void => onChange({ ...question, ...over });

  const setMedia = (key: 'media' | 'answerMedia', media: Media | undefined): void => {
    const next: Question = { ...question };
    if (media) next[key] = media;
    else delete next[key];
    onChange(next);
  };

  return (
    <div className="grid gap-3 rounded-2xl ink-border bg-card text-ink p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-ink/60">
          Цена
          <input
            className="w-24 ink-border rounded-xl bg-white/70 px-2 py-1.5 text-right tabular-nums focus:border-p1"
            value={question.price}
            inputMode="numeric"
            onChange={(event) => patch({ price: Number(event.target.value.replace(/\D/g, '')) || 0 })}
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-ink/60">
          Тип
          <select
            className="ink-border rounded-xl bg-white/70 px-2 py-1.5 text-ink focus:border-p1"
            value={question.type}
            onChange={(event) => {
              const type = event.target.value as QuestionType;
              const next: Question = { ...question, type };
              if (type === 'cat' && !next.cat) {
                next.cat = { theme: '', price: 'nominal', canKeep: false };
              }
              if (type !== 'cat') delete next.cat;
              onChange(next);
            }}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-1 text-xs text-ink/60">
        Вопрос
        <textarea
          className={`${field} min-h-20 resize-y`}
          value={question.text}
          placeholder="Текст, который прочитает ведущий"
          onChange={(event) => patch({ text: event.target.value })}
        />
      </label>

      <MediaField
        label="Медиа в вопросе"
        packId={packId}
        media={question.media}
        onChange={(media) => setMedia('media', media)}
      />

      <label className="grid gap-1 text-xs text-ink/60">
        Ответ
        <input
          className={field}
          value={question.answer}
          placeholder="Правильный ответ"
          onChange={(event) => patch({ answer: event.target.value })}
        />
      </label>

      <label className="grid gap-1 text-xs text-ink/60">
        Ещё принимаются (через точку с запятой)
        <input
          className={field}
          value={question.altAnswers.join('; ')}
          placeholder="Коппола; Фрэнсис Коппола"
          onChange={(event) =>
            patch({
              altAnswers: event.target.value
                .split(';')
                .map((alt) => alt.trim())
                .filter((alt) => alt !== ''),
            })
          }
        />
      </label>

      <MediaField
        label="Медиа в ответе"
        packId={packId}
        media={question.answerMedia}
        onChange={(media) => setMedia('answerMedia', media)}
      />

      <label className="grid gap-1 text-xs text-ink/60">
        Комментарий ведущему (игроки не увидят)
        <input
          className={field}
          value={question.hostComment ?? ''}
          onChange={(event) => {
            const next: Question = { ...question };
            if (event.target.value === '') delete next.hostComment;
            else next.hostComment = event.target.value;
            onChange(next);
          }}
        />
      </label>

      {question.type === 'cat' && question.cat && (
        <fieldset className="grid gap-2 rounded-xl border border-gold/40 bg-p4/5 p-3">
          <legend className="px-1 text-xs text-p1">Кот в мешке</legend>
          <label className="grid gap-1 text-xs text-ink/60">
            Тема кота — её объявляют перед передачей
            <input
              className={field}
              value={question.cat.theme}
              onChange={(event) =>
                patch({ cat: { ...question.cat!, theme: event.target.value } })
              }
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink/60">
            Стоимость
            <input
              className="w-28 ink-border rounded-xl bg-white/70 px-2 py-1.5 text-right tabular-nums focus:border-p1"
              value={question.cat.price === 'nominal' ? '' : question.cat.price}
              placeholder="как клетка"
              inputMode="numeric"
              onChange={(event) => {
                const raw = event.target.value.replace(/\D/g, '');
                patch({
                  cat: { ...question.cat!, price: raw === '' ? 'nominal' : Number(raw) },
                });
              }}
            />
            <span className="text-ink/60">пусто — по номиналу клетки</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-ink/60">
            <input
              type="checkbox"
              checked={question.cat.canKeep}
              onChange={(event) =>
                patch({ cat: { ...question.cat!, canKeep: event.target.checked } })
              }
            />
            можно оставить себе
          </label>
        </fieldset>
      )}
    </div>
  );
}
