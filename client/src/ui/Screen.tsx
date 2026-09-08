import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface ScreenProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  back?: boolean;
}

export function Screen({ title, subtitle, children, back = true }: ScreenProps) {
  return (
    <div className="app-shell flex flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-[clamp(2rem,1rem+5vw,3.5rem)] leading-tight font-black tracking-tight text-gold">
        {title}
      </h1>
      {subtitle && <p className="max-w-prose text-lg text-muted text-pretty">{subtitle}</p>}
      {children}
      {back && (
        <Link to="/" className="text-sm text-muted underline underline-offset-4 hover:text-ink">
          на главную
        </Link>
      )}
    </div>
  );
}
