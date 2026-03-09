import { cn } from '@/lib/cn';

interface SectionLabelProps {
  index: string;
  label: string;
  className?: string;
}

export default function SectionLabel({ index, label, className }: SectionLabelProps) {
  return (
    <div className={cn('font-display text-xs uppercase tracking-[0.22em]', className)}>
      <span className="text-[var(--color-accent)]">{index}. </span>
      <span className="text-[var(--color-muted-fg)]">{label}</span>
    </div>
  );
}
