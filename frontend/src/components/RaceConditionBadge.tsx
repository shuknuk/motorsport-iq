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
    className: 'bg-[#00C853] border-[#00C853]',
  },
  YELLOW: {
    label: '🟡 YELLOW FLAG',
    textClassName: 'text-black',
    className: 'bg-[#FFD600] border-[#FFD600]',
  },
  SC: {
    label: '🚗 SAFETY CAR',
    textClassName: 'text-black',
    className: 'bg-[#FFD600] border-[#FFD600]',
  },
  VSC: {
    label: '🟡 VIRTUAL SC',
    textClassName: 'text-black',
    className: 'bg-[#FFD600] border-[#FFD600]',
    // Add a subtle difference to distinguish from regular SC
    style: { backgroundColor: '#FFD600', opacity: 0.8 },
  },
  RED: {
    label: '🔴 RED FLAG',
    textClassName: 'text-white',
    className: 'bg-[#D50000] border-[#D50000]',
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
  // Provide fallback for unknown status values to prevent UI breaking
  const config = STATUS_CONFIG[status] || {
    label: `⚪ UNKNOWN STATUS (${status})`,
    textClassName: 'text-black',
    className: 'bg-[#9E9E9E] border-[#9E9E9E]',
  };

  return (
    <span
      className={cn(
        'border-2 border-[var(--color-border)] px-3 py-1 font-display text-xs uppercase tracking-[0.15em] transition-[background-color,color,transform,box-shadow] duration-300',
        config.className,
        config.textClassName,
        highlighted && 'ring-2 ring-[var(--color-accent)]'
      )}
      style={config.style}
    >
      {config.label}
    </span>
  );
}