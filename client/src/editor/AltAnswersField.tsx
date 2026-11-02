import { useEffect, useState } from 'react';

const parse = (raw: string): string[] =>
  raw
    .split(';')
    .map((alt) => alt.trim())
    .filter((alt) => alt !== '');

const same = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/**
 * Другие принимаемые ответы через точку с запятой. Поле держит свой текст:
 * раньше значение каждый раз пересобиралось из списка, и только что
 * набранная «;» тут же исчезала — второй вариант ввести было нельзя.
 */
export function AltAnswersField({
  value,
  onChange,
  placeholder = 'Коппола; Фрэнсис Коппола',
  className = 'ws-input',
  id,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [raw, setRaw] = useState(() => value.join('; '));

  // Список поменялся снаружи (отмена, импорт) — показываем его.
  useEffect(() => {
    setRaw((current) => (same(parse(current), value) ? current : value.join('; ')));
  }, [value]);

  return (
    <input
      id={id}
      className={className}
      value={raw}
      placeholder={placeholder}
      onChange={(event) => {
        setRaw(event.target.value);
        const next = parse(event.target.value);
        if (!same(next, value)) onChange(next);
      }}
      onBlur={() => setRaw(value.join('; '))}
    />
  );
}
