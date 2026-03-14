'use client';

import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)] shadow-[inset_0_-1px_0_rgba(0,0,0,0.25)] hover:bg-[var(--color-fg)] hover:text-[var(--color-bg)] hover:border-[var(--color-fg)]',
  secondary:
    'bg-transparent text-[var(--color-fg)] border-[var(--color-border-strong)] hover:border-[var(--color-fg)] hover:bg-[var(--color-fg)] hover:text-[var(--color-bg)]',
  ghost:
    'bg-transparent text-[var(--color-muted-fg)] border-transparent hover:text-[var(--color-fg)] hover:border-[var(--color-border)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-[0.7rem] tracking-[0.22em]',
  md: 'h-[3.25rem] px-6 text-sm tracking-[0.18em]',
  lg: 'h-16 px-8 text-base tracking-[0.22em]',
};

export default function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-w-[44px] items-center justify-center border font-display uppercase transition-all duration-150 ease-linear disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
