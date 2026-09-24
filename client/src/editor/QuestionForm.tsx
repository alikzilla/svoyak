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

const field = 'field';

export function QuestionForm({ packId, question, onChange }: QuestionFormProps) {
  const patch = (over: Partial<Question>): void => onChange({ ...question, ...over });

  const setMedia = (key: 'media' | 'answerMedia', media: Media | undefined): void => {
    const next: Question = { ...question };
    if (media) next[key] = media;
    else delete next[key];
    onChange(next);
  };

  return (
    <div className="on-paper ink-border bg-card text-ink relative grid gap-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-soft font-body flex items-center gap-2 text-xs font-bold">
          Цена
          <input
            className="field w-24 text-right tabular-nums"
            value={question.price}
            inputMode="numeric"
            onChange={(event) => patch({ price: Number(event.target.value.replace(/\D/g, '')) || 0 })}
          />
        </label>

        <label className="text-soft font-body flex items-center gap-2 text-xs font-bold">
          Тип
          <select
            className="field w-auto"
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

      <label className="text-soft font-body grid gap-1 text-xs font-bold">
        Вопрос
        <textarea
          className={`${field} min-h-24 resize-y`}
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

      <label className="text-soft font-body grid gap-1 text-xs font-bold">
        Ответ
        <input
          className={field}
          value={question.answer}
          placeholder="Правильный ответ"
          onChange={(event) => patch({ answer: event.target.value })}
        />
      </label>

      <label className="text-soft font-body grid gap-1 text-xs font-bold">
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

      <label className="text-soft font-body grid gap-1 text-xs font-bold">
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
        <fieldset className="border-gold bg-p4/10 grid gap-2 rounded-xl border-4 p-3">
          <legend className="font-pop px-1 text-xs font-black">Кот в мешке</legend>
          <label className="text-soft font-body grid gap-1 text-xs font-bold">
            Тема кота — её объявляют перед передачей
            <input
              className={field}
              value={question.cat.theme}
              onChange={(event) =>
                patch({ cat: { ...question.cat!, theme: event.target.value } })
              }
            />
          </label>
          <label className="text-soft font-body flex items-center gap-2 text-xs font-bold">
            Стоимость
            <input
              className="field w-28 text-right tabular-nums"
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
            <span className="text-soft">пусто — по номиналу клетки</span>
          </label>
          <label className="check-row font-body w-fit items-center text-xs font-bold">
            <input
              type="checkbox"
              checked={question.cat.canKeep}
              onChange={(event) =>
                patch({ cat: { ...question.cat!, canKeep: event.target.checked } })
              }
            />
            Можно оставить себе
          </label>
        </fieldset>
      )}
    </div>
  );
}
