'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

interface LapProgressBarProps {
  lapNumber: number;
  totalLaps: number | null;
  timestamp: string;
  leaderLapTime: number | null;
  raceCompleted: boolean;
  highlighted?: boolean;
}

function calculateProgress(timestamp: string, leaderLapTime: number | null): number {
  if (!leaderLapTime || leaderLapTime <= 0) {
    return 0;
  }

  const lapStartTime = new Date(timestamp).getTime();
  const elapsedMs = Math.max(0, Date.now() - lapStartTime);
  const lapDurationMs = leaderLapTime * 1000;

  return Math.min(100, Math.max(0, (elapsedMs / lapDurationMs) * 100));
}

export default function LapProgressBar({
  lapNumber,
  totalLaps,
  timestamp,
  leaderLapTime,
  raceCompleted,
  highlighted = false,
}: LapProgressBarProps) {
  const [progress, setProgress] = useState(() => (
    raceCompleted ? 100 : calculateProgress(timestamp, leaderLapTime)
  ));

  useEffect(() => {
    if (raceCompleted) {
      setProgress(100);
      return;
    }

    setProgress(calculateProgress(timestamp, leaderLapTime));
    const interval = window.setInterval(() => {
      setProgress(calculateProgress(timestamp, leaderLapTime));
    }, 250);

    return () => window.clearInterval(interval);
  }, [leaderLapTime, raceCompleted, timestamp]);

  return (
    <div
      className={cn(
        'mt-4 border-2 border-[var(--color-border)] bg-[var(--color-bg)] p-3 transition-[box-shadow,border-color] duration-300',
        highlighted && 'border-[var(--color-accent)] shadow-[0_0_0_2px_rgba(255,24,1,0.12)]'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Lap Progress</p>
        <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-fg)]">
          Lap {lapNumber}{totalLaps ? ` / ${totalLaps}` : ''}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-border),transparent_30%)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#ff1801_0%,#ff7b00_100%)] transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 font-display text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">
        {Math.round(progress)}% through the current lap
      </p>
    </div>
  );
}
