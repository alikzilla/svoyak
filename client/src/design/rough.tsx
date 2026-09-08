import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import rough from 'roughjs';

/** Общие параметры «дрожания»: линия должна выглядеть проведённой рукой, а не мышью. */
const HAND = { roughness: 1.8, bowing: 1.4, strokeWidth: 3 } as const;

function useSize(): [React.RefObject<HTMLDivElement | null>, { w: number; h: number }] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Рамка рисуется по внешнему краю, поэтому берём border-box, а не contentRect.
  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const width = Math.round(node.offsetWidth);
    const height = Math.round(node.offsetHeight);
    setSize((current) => (current.w === width && current.h === height ? current : { w: width, h: height }));
  }, []);

  // Меряем сразу при монтировании: ResizeObserver не срабатывает, пока вкладка не рисуется,
  // и рамка иначе осталась бы нулевой до первого изменения размера.
  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    // Шрифты подгружаются после первой отрисовки и меняют высоту содержимого.
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [measure]);

  return [ref, size];
}

interface RoughFrameProps {
  children?: ReactNode;
  /** Классы внешней коробки: размеры и отступы снаружи. */
  className?: string;
  /** Классы содержимого: раскладка и внутренние отступы. */
  contentClassName?: string;
  /** Цвет заливки; по умолчанию рамка без заливки. */
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  /** Одно и то же число даёт одну и ту же кривизну — рамка не дёргается при перерисовке. */
  seed?: number;
  style?: CSSProperties;
}

/** Прямоугольник, нарисованный от руки: рамка живёт в SVG под содержимым. */
export function RoughFrame({
  children,
  className = '',
  contentClassName = '',
  fill,
  stroke = '#1a1a1a',
  strokeWidth = HAND.strokeWidth,
  roughness = HAND.roughness,
  seed = 7,
  style,
}: RoughFrameProps) {
  const [ref, size] = useSize();
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.w < 4 || size.h < 4) return;
    svg.replaceChildren();

    const generator = rough.svg(svg);
    const inset = strokeWidth + 2;
    const node = generator.rectangle(inset, inset, size.w - inset * 2, size.h - inset * 2, {
      stroke,
      strokeWidth,
      roughness,
      bowing: HAND.bowing,
      seed,
      ...(fill ? { fill, fillStyle: 'solid' } : {}),
    });
    svg.appendChild(node);
  }, [size.w, size.h, fill, stroke, strokeWidth, roughness, seed]);

  return (
    <div ref={ref} className={`relative ${className}`} style={style}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        aria-hidden
        className="pointer-events-none absolute inset-0"
      />
      <div className={`relative h-full ${contentClassName}`}>{children}</div>
    </div>
  );
}

interface RoughLineProps {
  className?: string;
  color?: string;
  seed?: number;
  height?: number;
}

/** Подчёркивание маркером — ставится под заголовком. */
export function RoughUnderline({ className = '', color = '#7b4bf7', seed = 3, height = 14 }: RoughLineProps) {
  const [ref, size] = useSize();
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.w < 4) return;
    svg.replaceChildren();
    const generator = rough.svg(svg);
    svg.appendChild(
      generator.line(2, height / 2, size.w - 2, height / 2 + 2, {
        stroke: color,
        strokeWidth: 5,
        roughness: 2.2,
        bowing: 2,
        seed,
      }),
    );
  }, [size.w, color, seed, height]);

  return (
    <div ref={ref} className={className} style={{ height }}>
      <svg ref={svgRef} width={size.w} height={height} aria-hidden />
    </div>
  );
}

/** Перечёркивание крест-накрест — для сыгранных клеток. */
export function RoughCross({ color = '#1a1a1a', seed = 11 }: { color?: string; seed?: number }) {
  const [ref, size] = useSize();
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.w < 4 || size.h < 4) return;
    svg.replaceChildren();
    const generator = rough.svg(svg);
    const pad = 10;
    const options = { stroke: color, strokeWidth: 4, roughness: 2, bowing: 2, seed };
    svg.appendChild(generator.line(pad, pad, size.w - pad, size.h - pad, options));
    svg.appendChild(generator.line(size.w - pad, pad, pad, size.h - pad, { ...options, seed: seed + 1 }));
  }, [size.w, size.h, color, seed]);

  return (
    <div ref={ref} className="absolute inset-0">
      <svg ref={svgRef} width={size.w} height={size.h} aria-hidden />
    </div>
  );
}

/** Обводка кружком — отмечает выбранное. */
export function RoughCircle({ color = '#ff6b57', seed = 5 }: { color?: string; seed?: number }) {
  const [ref, size] = useSize();
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.w < 4 || size.h < 4) return;
    svg.replaceChildren();
    const generator = rough.svg(svg);
    svg.appendChild(
      generator.ellipse(size.w / 2, size.h / 2, size.w - 6, size.h - 6, {
        stroke: color,
        strokeWidth: 4,
        roughness: 2,
        bowing: 1.5,
        seed,
      }),
    );
  }, [size.w, size.h, color, seed]);

  return (
    <div ref={ref} className="pointer-events-none absolute -inset-2">
      <svg ref={svgRef} width={size.w} height={size.h} aria-hidden />
    </div>
  );
}
