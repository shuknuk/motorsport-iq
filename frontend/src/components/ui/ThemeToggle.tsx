'use client';

import { useTheme } from '@/lib/theme/ThemeProvider';
import Button from './Button';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="secondary"
      size="sm"
      className="min-w-[176px]"
      onClick={toggleTheme}
      aria-label="Switch visual theme"
    >
      {theme === 'f1' ? 'Switch to Swiss' : 'Switch to F1'}
    </Button>
  );
}
