import type { ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { Media } from '@svoyak/shared';
import { QuestionMedia } from '../QuestionMedia.js';

interface TicketProps {
  /** Полоса над вопросом: тема, цена, таймер. */
  header: ReactNode;
  text: string | null;
  media?: Media | undefined;
  answer: string | null;
  altAnswers?: string[];
  answerMedia?: Media | undefined;
  hostComment?: string | undefined;
  /** Ответ уже показан на общем экране — секретом он больше не является. */
  revealed?: boolean;
  /** Подсказка, что делать дальше, и кнопки. */
  children?: ReactNode;
}

/**
 * Билет ведущего: открытая часть сверху, линия отрыва, под ней ключ — ответ
 * на янтарной полосе, который видит только ведущий. Тот же билет — в
 * редакторе пака, поэтому вопрос выглядит одинаково там, где его пишут,
 * и там, где его читают вслух.
 */
export function Ticket({
  header,
  text,
  media,
  answer,
  altAnswers = [],
  answerMedia,
  hostComment,
  revealed = false,
  children,
}: TicketProps) {
  return (
    <article className="ws-ticket">
      <div className="grid gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{header}</div>
        {/* Текст виден целиком и сразу: ведущий читает его вслух. */}
        {text !== null && (
          <p className="text-[1.5rem] leading-[1.35] font-medium text-pretty">{text || 'Вопрос без текста'}</p>
        )}
        {media && <QuestionMedia media={media} variant="host" alt={text ?? ''} />}
      </div>

      {answer !== null && (
        <>
          <div className="ws-tear" aria-hidden />
          <div className="ws-key grid gap-1.5 px-5 py-4 sm:px-6">
            <span className="ws-key-label">
              {revealed ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
              {revealed ? 'Ответ — уже на общем экране' : 'Ответ — видите только вы'}
            </span>
            <p className="text-[1.25rem] leading-snug font-semibold text-pretty">{answer}</p>
            {altAnswers.length > 0 && (
              <p className="text-ws-key-ink text-sm">Также принимается: {altAnswers.join(', ')}</p>
            )}
            {answerMedia && (
              <div className="mt-1">
                <QuestionMedia media={answerMedia} variant="host" alt={answer} />
              </div>
            )}
            {hostComment && <p className="text-ws-key-ink text-sm text-pretty">{hostComment}</p>}
          </div>
        </>
      )}

      {children && <div className="border-ws-line grid gap-4 border-t p-5 sm:px-6">{children}</div>}
    </article>
  );
}
