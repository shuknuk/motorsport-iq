'use client';

import { QuestionCategory, Difficulty } from '@/lib/types';

interface QuestionCardProps {
  questionText: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  instanceId: string;
  onSubmit: (answer: 'YES' | 'NO') => void;
  disabled?: boolean;
  answered?: 'YES' | 'NO' | null;
  timeRemaining?: number;
}

const CATEGORY_COLORS: Record<QuestionCategory, string> = {
  PIT_WINDOW: 'bg-orange-500',
  STRATEGY: 'bg-purple-500',
  OVERTAKE: 'bg-red-500',
  ENERGY_BATTLE: 'bg-yellow-500',
  GAP_CLOSING: 'bg-blue-500',
  FINISH_POSITION: 'bg-green-500',
};

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  PIT_WINDOW: 'Pit Stop',
  STRATEGY: 'Strategy',
  OVERTAKE: 'Overtake',
  ENERGY_BATTLE: 'Energy Battle',
  GAP_CLOSING: 'Gap Closing',
  FINISH_POSITION: 'Finish Position',
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  EASY: 'text-green-400',
  MEDIUM: 'text-yellow-400',
  HARD: 'text-red-400',
};

export default function QuestionCard({
  questionText,
  category,
  difficulty,
  instanceId,
  onSubmit,
  disabled = false,
  answered = null,
  timeRemaining,
}: QuestionCardProps) {
  return (
    <div className="bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800 w-full max-w-md">
      {/* Category and Difficulty */}
      <div className="flex items-center justify-between mb-4">
        <span className={`${CATEGORY_COLORS[category]} text-white text-xs font-bold px-3 py-1 rounded-full`}>
          {CATEGORY_LABELS[category]}
        </span>
        <span className={`text-sm font-semibold ${DIFFICULTY_COLORS[difficulty]}`}>
          {difficulty}
        </span>
      </div>

      {/* Question Text */}
      <h2 className="text-xl font-bold text-white mb-6 leading-tight">
        {questionText}
      </h2>

      {/* Answer Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => onSubmit('YES')}
          disabled={disabled || answered !== null}
          className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
            answered === 'YES'
              ? 'bg-green-500 text-white'
              : answered === 'NO'
              ? 'bg-gray-700 text-gray-500'
              : disabled
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-500 text-white hover:scale-105 active:scale-95'
          }`}
        >
          YES
        </button>
        <button
          onClick={() => onSubmit('NO')}
          disabled={disabled || answered !== null}
          className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
            answered === 'NO'
              ? 'bg-red-500 text-white'
              : answered === 'YES'
              ? 'bg-gray-700 text-gray-500'
              : disabled
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-500 text-white hover:scale-105 active:scale-95'
          }`}
        >
          NO
        </button>
      </div>

      {/* Answered indicator */}
      {answered && (
        <div className="mt-4 text-center text-gray-400 text-sm">
          You answered: <span className={`font-bold ${answered === 'YES' ? 'text-green-400' : 'text-red-400'}`}>{answered}</span>
        </div>
      )}
    </div>
  );
}