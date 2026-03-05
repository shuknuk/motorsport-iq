'use client';

import type { LeaderboardEntry } from '@/lib/types';

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

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500/20 border-yellow-500';
      case 2:
        return 'bg-gray-400/20 border-gray-400';
      case 3:
        return 'bg-amber-600/20 border-amber-600';
      default:
        return 'bg-gray-800/50 border-gray-700';
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  if (entries.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h3 className="text-lg font-bold text-white mb-4">Leaderboard</h3>
        <p className="text-gray-400 text-center py-4">No players yet</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <h3 className="text-lg font-bold text-white mb-4">Leaderboard</h3>
      <div className="space-y-2">
        {sortedEntries.map((entry, index) => {
          const rank = index + 1;
          const isCurrentUser = entry.userId === currentUserId;

          return (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                getRankStyle(rank)
              } ${isCurrentUser ? 'ring-2 ring-blue-500' : ''}`}
            >
              {/* Rank */}
              <div className="w-8 text-center font-bold">
                {typeof getRankBadge(rank) === 'string' && getRankBadge(rank).startsWith('#') ? (
                  <span className="text-gray-400">{getRankBadge(rank)}</span>
                ) : (
                  <span className="text-xl">{getRankBadge(rank)}</span>
                )}
              </div>

              {/* Username */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">
                  {entry.username}
                  {isCurrentUser && (
                    <span className="ml-2 text-xs text-blue-400">(You)</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <span>{entry.accuracy.toFixed(0)}% accuracy</span>
                  {entry.streak > 0 && (
                    <span className="text-orange-400">🔥 {entry.streak}</span>
                  )}
                </div>
              </div>

              {/* Points */}
              <div className="text-right">
                <div className="font-bold text-white text-lg">{entry.points}</div>
                <div className="text-xs text-gray-400">pts</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats summary */}
      {currentUserId && entries.find((e) => e.userId === currentUserId) && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xl font-bold text-white">
                {entries.find((e) => e.userId === currentUserId)?.correctAnswers ?? 0}
              </div>
              <div className="text-xs text-gray-400">Correct</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white">
                {entries.find((e) => e.userId === currentUserId)?.maxStreak ?? 0}
              </div>
              <div className="text-xs text-gray-400">Best Streak</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white">
                {(entries.find((e) => e.userId === currentUserId)?.accuracy ?? 0).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-400">Accuracy</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}