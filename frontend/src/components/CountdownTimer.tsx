'use client';

import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  deadline: Date | string;
  onExpire?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function CountdownTimer({
  deadline,
  onExpire,
  size = 'md',
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const deadlineTime = deadlineDate.getTime();
      const remaining = Math.max(0, deadlineTime - now);

      setTimeRemaining(remaining);
      setIsExpired(remaining === 0);

      if (remaining === 0 && onExpire) {
        onExpire();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [deadlineDate, onExpire]);

  const totalDuration = 20000; // 20 seconds
  const progress = Math.max(0, Math.min(1, timeRemaining / totalDuration));
  const seconds = Math.ceil(timeRemaining / 1000);

  // Calculate stroke dasharray for SVG
  const radius = size === 'sm' ? 30 : size === 'md' ? 45 : 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  // Color based on time remaining
  const getColor = () => {
    if (progress > 0.5) return '#22c55e'; // green
    if (progress > 0.25) return '#eab308'; // yellow
    return '#ef4444'; // red
  };

  const fontSize = size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-4xl';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={radius * 2 + 10}
        height={radius * 2 + 10}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={radius + 5}
          cy={radius + 5}
          r={radius}
          fill="none"
          stroke="#374151"
          strokeWidth="6"
        />
        {/* Progress circle */}
        <circle
          cx={radius + 5}
          cy={radius + 5}
          r={radius}
          fill="none"
          stroke={isExpired ? '#ef4444' : getColor()}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-100"
        />
      </svg>
      {/* Time text */}
      <div className={`absolute inset-0 flex items-center justify-center ${fontSize} font-bold text-white`}>
        {isExpired ? (
          <span className="text-red-500">0</span>
        ) : (
          <span style={{ color: getColor() }}>{seconds}</span>
        )}
      </div>
    </div>
  );
}