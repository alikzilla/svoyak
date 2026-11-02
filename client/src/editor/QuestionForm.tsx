import { useId } from 'react';
import type { Media, Question, QuestionType } from '@svoyak/shared';
import { Segmented } from '../workspace/ui.js';
import { AltAnswersField } from './AltAnswersField.js';
import { MediaField } from './MediaField.js';

interface QuestionFormProps {
  packId: string;
  question: Question;
  onChange: (question: Question) => void;
}

const TYPE_OPTIONS: Array<{ value: QuestionType; label: string }> = [
  { value: 'normal', label: 'Обычный' },
  { value: 'cat', label: 'Кот в мешке' },
  { value: 'auction', label: 'Аукцион' },
];

/**
 * Билет вопроса в редакторе — тот же, что ведущий увидит в игре: сверху
 * то, что читают вслух, под линией отрыва — ответ, который видит только он.
 */
export function QuestionForm({ packId, question, onChange }: QuestionFormProps) {
  const id = useId();
  const patch = (over: Partial<Question>): void => onChange({ ...question, ...over });

  const setMedia = (key: 'media' | 'answerMedia', media: Media | undefined): void => {
    const next: Question = { ...question };
    if (media) next[key] = media;
    else delete next[key];
    onChange(next);
  };

  return (
    <div className="border-ws-line border-t">
      <div className="grid gap-4 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="grid gap-1.5">
            <span className="ws-label">Цена</span>
            <input
              className="ws-input num w-28 text-right"
              value={question.price}
              inputMode="numeric"
              onChange={(event) => patch({ price: Number(event.target.value.replace(/\D/g, '')) || 0 })}
            />
          </label>
          <div className="grid gap-1.5">
            <span className="ws-label">Тип</span>
            <Segmented<QuestionType>
              label="Тип вопроса"
              value={question.type}
              options={TYPE_OPTIONS}
              onChange={(type) => {
                const next: Question = { ...question, type };
                if (type === 'cat' && !next.cat) next.cat = { theme: '', price: 'nominal', canKeep: false };
                if (type !== 'cat') delete next.cat;
                onChange(next);
              }}
            />
          </div>
        </div>

        <label className="grid gap-1.5">
          <span className="ws-label">Вопрос</span>
          <textarea
            className="ws-input min-h-24 text-[1rem]"
            value={question.text}
            placeholder="Текст, который прочитает ведущий"
            onChange={(event) => patch({ text: event.target.value })}
          />
        </label>

        <MediaField
          label="Картинка, звук или видео к вопросу"
          packId={packId}
          media={question.media}
          onChange={(media) => setMedia('media', media)}
        />

        {question.type === 'cat' && question.cat && (
          <fieldset className="bg-ws-sunken grid gap-3 rounded-lg p-4">
            <legend className="sr-only">Кот в мешке</legend>
            <p className="text-sm font-semibold">Кот в мешке</p>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <label className="grid gap-1.5">
                <span className="ws-label">Тема кота — её объявляют перед передачей</span>
                <input
                  className="ws-input"
                  value={question.cat.theme}
                  onChange={(event) => patch({ cat: { ...question.cat!, theme: event.target.value } })}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="ws-label">Стоимость</span>
                <input
                  className="ws-input num text-right"
                  value={question.cat.price === 'nominal' ? '' : question.cat.price}
                  placeholder="как у клетки"
                  inputMode="numeric"
                  onChange={(event) => {
                    const raw = event.target.value.replace(/\D/g, '');
                    patch({ cat: { ...question.cat!, price: raw === '' ? 'nominal' : Number(raw) } });
                  }}
                />
              </label>
            </div>
            <label className="flex w-fit items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                role="switch"
                className="ws-switch"
                checked={question.cat.canKeep}
                onChange={(event) => patch({ cat: { ...question.cat!, canKeep: event.target.checked } })}
              />
              Можно оставить себе
            </label>
          </fieldset>
        )}
      </div>

      <div className="ws-tear" aria-hidden />

      <div className="ws-key grid gap-4 px-4 py-4 sm:px-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="ws-key-label">Ответ — видит только ведущий</span>
            <input
              className="ws-input"
              value={question.answer}
              placeholder="Правильный ответ"
              onChange={(event) => patch({ answer: event.target.value })}
            />
          </label>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-alt`} className="ws-key-label">
              Также принимаются — через «;»
            </label>
            <AltAnswersField
              id={`${id}-alt`}
              value={question.altAnswers}
              onChange={(altAnswers) => patch({ altAnswers })}
            />
          </div>
        </div>
        <label className="grid gap-1.5">
          <span className="ws-key-label">Комментарий ведущему — игроки не увидят</span>
          <input
            className="ws-input"
            value={question.hostComment ?? ''}
            placeholder="Как произносится, откуда факт, что подсказать"
            onChange={(event) => {
              const next: Question = { ...question };
              if (event.target.value === '') delete next.hostComment;
              else next.hostComment = event.target.value;
              onChange(next);
            }}
          />
        </label>
        <MediaField
          label="Картинка, звук или видео к ответу"
          packId={packId}
          media={question.answerMedia}
          onChange={(media) => setMedia('answerMedia', media)}
          tone="key"
        />
      </div>
    </div>
  );
}
