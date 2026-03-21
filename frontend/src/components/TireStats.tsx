'use client';

import type { LeaderStats } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui';

interface TireStatsProps {
  leaderStats: LeaderStats | null;
  highlighted?: boolean;
}

function getCompoundConfig(compound: string | null): { label: string; color: string; textClassName: string; icon: string } {
  const normalized = compound?.trim().toUpperCase() ?? 'UNKNOWN';

  switch (normalized) {
    case 'SOFT':
      return { label: 'Soft', color: '#D50000', textClassName: 'text-white', icon: '🔴' };
    case 'MEDIUM':
      return { label: 'Medium', color: '#FFD600', textClassName: 'text-black', icon: '🟡' };
    case 'HARD':
      return { label: 'Hard', color: '#F5F5F5', textClassName: 'text-black', icon: '⚪' };
    case 'INTERMEDIATE':
    case 'INTER':
      return { label: 'Inter', color: '#00C853', textClassName: 'text-white', icon: '🟢' };
    case 'WET':
      return { label: 'Wet', color: '#2962FF', textClassName: 'text-white', icon: '🔵' };
    default:
      return { label: 'Unknown', color: '#2A3B55', textClassName: 'text-white', icon: '⚫' };
  }
}

export default function TireStats({ leaderStats, highlighted = false }: TireStatsProps) {
  // Handle null leaderStats gracefully
  if (!leaderStats) {
    return (
      <Card
        tone="default"
        className={cn(
          'mb-6 p-5 md:p-6 transition-[box-shadow,border-color] duration-300',
          highlighted && 'border-[var(--color-accent)] shadow-[0_0_0_2px_rgba(255,24,1,0.12)]'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Lead Driver Tire Stats</p>
            <h3 className="mt-2 font-display text-2xl uppercase tracking-tight">
              Awaiting telemetry
            </h3>
            <p className="mt-1 font-body text-sm text-[var(--color-muted-fg)]">No leader yet</p>
          </div>
          <div
            className={cn('min-w-[112px] border-2 border-[var(--color-border)] px-3 py-2 text-center text-[var(--color-muted-fg)]')}
            style={{ backgroundColor: 'var(--color-muted)' }}
          >
            <p className="font-display text-xs uppercase tracking-[0.16em]">⚪ Compound</p>
            <p className="mt-1 font-display text-lg uppercase">Unknown</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="border-2 border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-center">
            <p className="font-display text-xs uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">Tire Age</p>
            <p className="mt-2 font-display text-3xl leading-none">0</p>
            <p className="mt-1 font-display text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">laps</p>
          </div>
          <div className="border-2 border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-center">
            <p className="font-display text-xs uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">Stint</p>
            <p className="mt-2 font-display text-3xl leading-none">-</p>
            <p className="mt-1 font-display text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">current run</p>
          </div>
        </div>
      </Card>
    );
  }

  const compoundConfig = getCompoundConfig(leaderStats.tyreCompound ?? null);

  return (
    <Card
      tone="default"
      className={cn(
        'mb-6 p-5 md:p-6 transition-[box-shadow,border-color] duration-300',
        highlighted && 'border-[var(--color-accent)] shadow-[0_0_0_2px_rgba(255,24,1,0.12)]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Lead Driver Tire Stats</p>
          <h3 className="mt-2 font-display text-2xl uppercase tracking-tight">
            {leaderStats.name}
          </h3>
          <p className="mt-1 font-body text-sm text-[var(--color-muted-fg)]">{leaderStats.team}</p>
        </div>
        <div
          className={cn('min-w-[112px] border-2 border-[var(--color-border)] px-3 py-2 text-center', compoundConfig.textClassName)}
          style={{ backgroundColor: compoundConfig.color }}
        >
          <p className="font-display text-xs uppercase tracking-[0.16em]">{compoundConfig.icon} Compound</p>
          <p className="mt-1 font-display text-lg uppercase">{compoundConfig.label}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="border-2 border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-center">
          <p className="font-display text-xs uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">Tire Age</p>
          <p className="mt-2 font-display text-3xl leading-none">{leaderStats.tyreAge}</p>
          <p className="mt-1 font-display text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">laps</p>
        </div>
        <div className="border-2 border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-center">
          <p className="font-display text-xs uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">Stint</p>
          <p className="mt-2 font-display text-3xl leading-none">
            {leaderStats.stintNumber !== null && leaderStats.stintNumber !== undefined ? leaderStats.stintNumber : '-'}
          </p>
          <p className="mt-1 font-display text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">current run</p>
        </div>
      </div>
    </Card>
  );
}
