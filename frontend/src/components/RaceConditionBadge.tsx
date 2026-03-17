'use client';

import type { TrackStatus } from '@/lib/types';
import { cn } from '@/lib/cn';

interface RaceConditionBadgeProps {
  status: TrackStatus;
  highlighted?: boolean;
}

const STATUS_CONFIG: Record<
  TrackStatus,
  { label: string; textClassName: string; style?: React.CSSProperties; className?: string }
> = {
  GREEN: {
    label: '🟢 GREEN FLAG',
    textClassName: 'text-white',
    style: { backgroundColor: '#00C853' },
  },
  YELLOW: {
    label: '🟡 YELLOW FLAG',
    textClassName: 'text-black',
    style: { backgroundColor: '#FFD600' },
  },
  SC: {
    label: '🚗 SAFETY CAR',
    textClassName: 'text-black',
    style: { backgroundColor: '#FFD600' },
  },
  VSC: {
    label: '🟡 VIRTUAL SC',
    textClassName: 'text-black',
    style: { backgroundColor: '#FFD600' },
  },
  RED: {
    label: '🔴 RED FLAG',
    textClassName: 'text-white',
    style: { backgroundColor: '#D50000' },
  },
  CHEQUERED: {
    label: '🏁 RACE ENDED',
    textClassName: 'text-white',
    className:
      'bg-[linear-gradient(135deg,#111_0%,#111_45%,#f5f5f5_45%,#f5f5f5_55%,#111_55%,#111_100%)]',
  },
};

export default function RaceConditionBadge({
  status,
  highlighted = false,
}: RaceConditionBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'border-2 border-[var(--color-border)] px-3 py-1 font-display text-xs uppercase tracking-[0.15em] transition-[background-color,color,transform,box-shadow] duration-300',
        config.textClassName,
        config.className,
        highlighted && 'ring-2 ring-[var(--color-accent)]'
      )}
      style={config.style}
    >
      {config.label}
    </span>
  );
}
