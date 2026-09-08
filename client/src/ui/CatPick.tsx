interface CatPickProps {
  theme: string;
  price: number;
  candidates: Array<{ id: string; name: string }>;
  canKeep: boolean;
  onPick: (playerId: string) => void;
}

/** Кот в мешке: открывший выбирает, кому достанется вопрос. */
export function CatPick({ theme, price, candidates, canKeep, onPick }: CatPickProps) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <div className="text-center">
        <p className="text-sm text-muted">Кот в мешке</p>
        <p className="text-2xl font-bold text-gold text-pretty">{theme || 'без темы'}</p>
        <p className="text-muted">
          за <span className="tabular-nums">{price}</span> · кому отдаёте?
        </p>
      </div>
      <ul className="grid gap-2">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <button
              onClick={() => onPick(candidate.id)}
              className="w-full rounded-2xl border border-line bg-surface px-4 py-4 text-lg font-semibold hover:border-gold"
            >
              {candidate.name}
            </button>
          </li>
        ))}
      </ul>
      {canKeep && <p className="text-center text-sm text-muted">этого кота можно оставить себе</p>}
    </div>
  );
}
