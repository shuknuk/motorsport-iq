'use client';

import { Card } from '@/components/ui';
import type { LeaderboardEntry } from '@/lib/types';
import { cn } from '@/lib/cn';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  maxEntries?: number;
}

export default function Leaderboard({
  entries,
  currentUserId,
  maxEntries = 10,
}: LeaderboardProps) {
  const sortedEntries = [...entries]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return b.maxStreak - a.maxStreak;
    })
    .slice(0, maxEntries);

  const me = currentUserId ? entries.find((entry) => entry.userId === currentUserId) : undefined;

  return (
    <Card tone="default" className="h-full p-5 md:p-6">
      <h3 className="font-display text-2xl uppercase tracking-tight">Leaderboard</h3>

      {sortedEntries.length === 0 ? (
        <p className="mt-5 border-2 border-[var(--color-border)] p-4 text-center font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">
          No Players Yet
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {sortedEntries.map((entry, index) => {
            const rank = index + 1;
            const isCurrentUser = entry.userId === currentUserId;

            return (
              <div
                key={entry.userId}
                className={cn(
                  'grid grid-cols-[40px_1fr_auto] items-center gap-3 border-2 border-[var(--color-border)] p-3',
                  isCurrentUser && 'border-[var(--color-accent)]'
                )}
              >
                <p className="font-display text-sm uppercase tracking-[0.14em] text-[var(--color-muted-fg)]">#{rank}</p>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg uppercase leading-none">{entry.username}</p>
                  <p className="font-body text-xs text-[var(--color-muted-fg)]">
                    {entry.accuracy.toFixed(0)}% accuracy {entry.streak > 0 ? `· streak ${entry.streak}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl leading-none">{entry.points}</p>
                  <p className="font-display text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">pts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {me && (
        <div className="mt-5 border-t-2 border-[var(--color-border)] pt-4">
          <p className="mb-3 font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">Your Summary</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="border-2 border-[var(--color-border)] p-2 text-center">
              <p className="font-display text-2xl leading-none">{me.correctAnswers}</p>
              <p className="font-display text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted-fg)]">Correct</p>
            </div>
            <div className="border-2 border-[var(--color-border)] p-2 text-center">
              <p className="font-display text-2xl leading-none">{me.maxStreak}</p>
              <p className="font-display text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted-fg)]">Best Streak</p>
            </div>
            <div className="border-2 border-[var(--color-border)] p-2 text-center">
              <p className="font-display text-2xl leading-none">{me.accuracy.toFixed(0)}%</p>
              <p className="font-display text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted-fg)]">Accuracy</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
