import type { Question, QuestionCategory } from '../types';

/**
 * MVP Question Bank
 * Curated questions only for observable, lap-based race situations from the handoff spec.
 */

export const QUESTION_BANK: Question[] = [
  {
    id: 'OVR_PASS_NEXT_3',
    category: 'OVERTAKE',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} overtake {driver2} within the next 3 laps?',
    windowSize: 3,
    triggers: [
      { type: 'overtakeOpportunity', params: {} },
    ],
    successCondition: { type: 'overtake', params: {} },
    priority: 1,
    cooldownLaps: 2,
  },
  {
    id: 'OVR_CLOSE_TO_1S',
    category: 'OVERTAKE',
    difficulty: 'EASY',
    template: 'Will {driver1} close to within 1 second of {driver2} in the next 2 laps?',
    windowSize: 2,
    triggers: [
      { type: 'closingTrend', params: {} },
      { type: 'gapRange', params: { minGap: 1.0, maxGap: 2.5 } },
    ],
    successCondition: { type: 'gapReached', params: { targetGap: 1.0 } },
    priority: 1,
    cooldownLaps: 2,
  },
  {
    id: 'PIT_STOP_NEXT_3',
    category: 'PIT_WINDOW',
    difficulty: 'EASY',
    template: 'Will {driver1} pit within the next 3 laps?',
    windowSize: 3,
    triggers: [
      { type: 'pitWindowOpen', params: {} },
    ],
    successCondition: { type: 'pitStop', params: { withinLaps: 3 } },
    priority: 2,
    cooldownLaps: 2,
  },
  {
    id: 'PIT_STAY_OUT_NEXT_3',
    category: 'PIT_WINDOW',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} avoid pitting within the next 3 laps?',
    windowSize: 3,
    triggers: [
      { type: 'pitWindowOpen', params: {} },
      { type: 'positionRange', params: { min: 1, max: 15 } },
    ],
    successCondition: { type: 'noPitStop', params: { withinLaps: 3 } },
    priority: 2,
    cooldownLaps: 2,
  },
  {
    id: 'GAP_REDUCE_1S',
    category: 'GAP_CLOSING',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} reduce the gap to {driver2} by at least 1 second within 3 laps?',
    windowSize: 3,
    triggers: [
      { type: 'closingTrend', params: {} },
      { type: 'gapRange', params: { minGap: 1.0, maxGap: 4.0 } },
    ],
    successCondition: { type: 'gapReduced', params: { minReduction: 1.0 } },
    priority: 3,
    cooldownLaps: 2,
  },
  {
    id: 'GAP_FALL_BELOW_1S',
    category: 'GAP_CLOSING',
    difficulty: 'EASY',
    template: 'Will the gap from {driver1} to {driver2} fall below 1 second within 2 laps?',
    windowSize: 2,
    triggers: [
      { type: 'closingTrend', params: {} },
      { type: 'gapRange', params: { minGap: 1.0, maxGap: 2.0 } },
    ],
    successCondition: { type: 'gapReached', params: { targetGap: 1.0 } },
    priority: 3,
    cooldownLaps: 2,
  },
  {
    id: 'FIN_AHEAD_OF_RIVAL',
    category: 'FINISH_POSITION',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} finish ahead of {driver2}?',
    windowSize: 3,
    triggers: [
      { type: 'lateRacePhase', params: {} },
      { type: 'positionClose', params: { maxGap: 5.0 } },
    ],
    successCondition: { type: 'finishAhead', params: {} },
    priority: 4,
    cooldownLaps: 2,
  },
  {
    id: 'FIN_TOP_5',
    category: 'FINISH_POSITION',
    difficulty: 'EASY',
    template: 'Will {driver1} remain in the top 5?',
    windowSize: 3,
    triggers: [
      { type: 'lateRacePhase', params: {} },
      { type: 'positionRange', params: { min: 1, max: 5 } },
    ],
    successCondition: { type: 'finalPosition', params: { maxPosition: 5 } },
    priority: 4,
    cooldownLaps: 2,
  },
];

export function getQuestionsByCategory(category: QuestionCategory): Question[] {
  return QUESTION_BANK.filter((question) => question.category === category);
}

export function getQuestionById(id: string): Question | undefined {
  return QUESTION_BANK.find((question) => question.id === id);
}

export function getQuestionsSortedByPriority(): Question[] {
  return [...QUESTION_BANK].sort((a, b) => a.priority - b.priority);
}

export function getCategories(): QuestionCategory[] {
  return ['OVERTAKE', 'PIT_WINDOW', 'GAP_CLOSING', 'FINISH_POSITION'];
}

export const CATEGORY_NAMES: Record<QuestionCategory, string> = {
  OVERTAKE: 'Overtake',
  PIT_WINDOW: 'Pit Window',
  GAP_CLOSING: 'Gap Closing',
  FINISH_POSITION: 'Finish Position',
};

export const DIFFICULTY_INFO: Record<string, { name: string; color: string; points: number }> = {
  EASY: { name: 'Easy', color: 'green', points: 10 },
  MEDIUM: { name: 'Medium', color: 'yellow', points: 15 },
  HARD: { name: 'Hard', color: 'red', points: 25 },
};
