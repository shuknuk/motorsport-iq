import { cn } from '@/lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, className, id, ...props }: InputProps) {
  return (
    <label className="block w-full" htmlFor={id}>
      {label && (
        <span className="mb-2 block font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">
          {label}
        </span>
      )}
      <input
        id={id}
        className={cn(
          'h-12 w-full border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-4 font-body text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted-fg)]',
          'transition-colors duration-150 ease-linear focus-visible:outline-none focus-visible:border-[var(--color-accent)]',
          className
        )}
        {...props}
      />
    </label>
  );
}
