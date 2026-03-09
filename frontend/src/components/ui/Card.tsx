import { cn } from '@/lib/cn';

type CardTone = 'default' | 'muted' | 'inverse';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
}

const toneClasses: Record<CardTone, string> = {
  default: 'bg-[var(--color-panel)] text-[var(--color-fg)]',
  muted: 'bg-[var(--color-muted)] text-[var(--color-fg)]',
  inverse: 'bg-[var(--color-fg)] text-[var(--color-bg)]',
};

export default function Card({ className, tone = 'default', ...props }: CardProps) {
  return (
    <div
      className={cn('border-2 border-[var(--color-border)] p-6 md:p-8', toneClasses[tone], className)}
      {...props}
    />
  );
}
