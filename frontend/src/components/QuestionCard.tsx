'use client';

import { Card, Button } from '@/components/ui';
import { type Difficulty, type QuestionCategory } from '@/lib/types';

interface QuestionCardProps {
  questionText: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  instanceId: string;
  onSubmit: (answer: 'YES' | 'NO') => void;
  disabled?: boolean;
  answered?: 'YES' | 'NO' | null;
}

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  OVERTAKE: 'Overtake',
  PIT_WINDOW: 'Pit Window',
  GAP_CLOSING: 'Gap Closing',
  FINISH_POSITION: 'Finish Position',
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
};

export default function QuestionCard({
  questionText,
  category,
  difficulty,
  onSubmit,
  disabled = false,
  answered = null,
}: QuestionCardProps) {
  return (
    <Card tone="default" className="w-full max-w-2xl p-6 md:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <span className="border-2 border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1 font-display text-xs uppercase tracking-[0.18em]">
          {CATEGORY_LABELS[category]}
        </span>
        <span className="font-display text-xs uppercase tracking-[0.22em] text-[var(--color-muted-fg)]">
          Difficulty: {DIFFICULTY_LABELS[difficulty]}
        </span>
      </div>

      <h2 className="font-display text-3xl uppercase leading-tight tracking-tight md:text-4xl">{questionText}</h2>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <Button
          variant={answered === 'NO' ? 'ghost' : 'primary'}
          size="lg"
          className="w-full"
          onClick={() => onSubmit('YES')}
          disabled={disabled || answered !== null}
        >
          YES
        </Button>
        <Button
          variant={answered === 'YES' ? 'ghost' : 'secondary'}
          size="lg"
          className="w-full"
          onClick={() => onSubmit('NO')}
          disabled={disabled || answered !== null}
        >
          NO
        </Button>
      </div>

      {answered && (
        <p className="mt-4 border-t-2 border-[var(--color-border)] pt-4 font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">
          Submitted Answer: <span className="text-[var(--color-fg)]">{answered}</span>
        </p>
      )}
    </Card>
  );
}
