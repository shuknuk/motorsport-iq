import type { Question, QuestionCategory } from '../types';

/**
 * Question Bank - All 24 questions organized by category
 * Each question has a unique ID, category, difficulty, template, triggers, and success condition
 */

export const QUESTION_BANK: Question[] = [
  // ===== PIT WINDOW QUESTIONS (Priority 1) =====
  {
    id: 'PIT_WILL_STOP_NEXT_3',
    category: 'PIT_WINDOW',
    difficulty: 'EASY',
    template: 'Will {driver1} pit in the next 3 laps?',
    windowSize: 3,
    triggers: [
      { type: 'pitWindowOpen', params: { driver: 'driver1' } },
    ],
    successCondition: { type: 'pitStop', params: { driver: 'driver1', withinLaps: 3 } },
    priority: 1,
    cooldownLaps: 5,
  },
  {
    id: 'PIT_WILL_STOP_UNDERCUT',
    category: 'PIT_WINDOW',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} attempt an undercut by pitting in the next 2 laps?',
    windowSize: 2,
    triggers: [
      { type: 'undercutWindow', params: { driver: 'driver1' } },
      { type: 'positionRange', params: { min: 3, max: 10 } },
    ],
    successCondition: { type: 'pitStop', params: { driver: 'driver1', withinLaps: 2 } },
    priority: 1,
    cooldownLaps: 5,
  },
  {
    id: 'PIT_TYRE_CLIFF',
    category: 'PIT_WINDOW',
    difficulty: 'HARD',
    template: 'Will {driver1} be forced to pit due to tyre degradation in the next 2 laps?',
    windowSize: 2,
    triggers: [
      { type: 'tyreCliffRisk', params: { driver: 'driver1' } },
    ],
    successCondition: { type: 'pitStop', params: { driver: 'driver1', withinLaps: 2 } },
    priority: 1,
    cooldownLaps: 5,
  },
  {
    id: 'PIT_WING_DAMAGE',
    category: 'PIT_WINDOW',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} need an unplanned pit stop in the next 2 laps?',
    windowSize: 2,
    triggers: [
      { type: 'randomEvent', params: { probability: 0.3 } },
    ],
    successCondition: { type: 'pitStop', params: { driver: 'driver1', withinLaps: 2 } },
    priority: 1,
    cooldownLaps: 8,
  },

  // ===== STRATEGY QUESTIONS (Priority 2) =====
  {
    id: 'STRAT_UNDERCUT_WORKS',
    category: 'STRATEGY',
    difficulty: 'HARD',
    template: 'Will {driver1} successfully undercut {driver2} by pitting first?',
    windowSize: 4,
    triggers: [
      { type: 'undercutWindow', params: { driver: 'driver1' } },
      { type: 'closeBattle', params: { attacker: 'driver1', defender: 'driver2', maxGap: 2.5 } },
    ],
    successCondition: { type: 'undercutSuccess', params: { attacker: 'driver1', defender: 'driver2' } },
    priority: 2,
    cooldownLaps: 8,
  },
  {
    id: 'STRAT_OVERCUT_WORKS',
    category: 'STRATEGY',
    difficulty: 'HARD',
    template: 'Will {driver1} benefit from staying out longer than {driver2}?',
    windowSize: 5,
    triggers: [
      { type: 'tyreCliffRisk', params: { driver: 'driver2' } },
      { type: 'closeBattle', params: { attacker: 'driver1', defender: 'driver2', maxGap: 2.5 } },
    ],
    successCondition: { type: 'overcutSuccess', params: { attacker: 'driver1', defender: 'driver2' } },
    priority: 2,
    cooldownLaps: 8,
  },
  {
    id: 'STRAT_ONE_STOP',
    category: 'STRATEGY',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} complete a successful one-stop strategy?',
    windowSize: 20,
    triggers: [
      { type: 'pitCount', params: { driver: 'driver1', count: 0 } },
      { type: 'lapRange', params: { min: 20, max: 40 } },
    ],
    successCondition: { type: 'pitCountAtEnd', params: { driver: 'driver1', maxStops: 1 } },
    priority: 2,
    cooldownLaps: 15,
  },
  {
    id: 'STRAT_TEAM_ORDERS',
    category: 'STRATEGY',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} let {driver2} pass due to team orders?',
    windowSize: 3,
    triggers: [
      { type: 'sameTeam', params: { driver1: 'driver1', driver2: 'driver2' } },
      { type: 'positionDifference', params: { driver1: 'driver2', driver2: 'driver1', minGap: 0, maxGap: 1.5 } },
      { type: 'closingTrend', params: { driver: 'driver2' } },
    ],
    successCondition: { type: 'positionSwap', params: { from: 'driver1', to: 'driver2' } },
    priority: 2,
    cooldownLaps: 10,
  },

  // ===== OVERTAKE QUESTIONS (Priority 3) =====
  {
    id: 'OVER_TAKE_IN_2',
    category: 'OVERTAKE',
    difficulty: 'EASY',
    template: 'Will {driver1} overtake {driver2} in the next 2 laps?',
    windowSize: 2,
    triggers: [
      { type: 'closeBattle', params: { attacker: 'driver1', defender: 'driver2', maxGap: 1.0 } },
      { type: 'drsActive', params: { driver: 'driver1' } },
    ],
    successCondition: { type: 'overtake', params: { attacker: 'driver1', defender: 'driver2' } },
    priority: 3,
    cooldownLaps: 3,
  },
  {
    id: 'OVER_TAKE_IN_3',
    category: 'OVERTAKE',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} overtake {driver2} in the next 3 laps?',
    windowSize: 3,
    triggers: [
      { type: 'closeBattle', params: { attacker: 'driver1', defender: 'driver2', maxGap: 2.0 } },
      { type: 'closingTrend', params: { driver: 'driver1' } },
    ],
    successCondition: { type: 'overtake', params: { attacker: 'driver1', defender: 'driver2' } },
    priority: 3,
    cooldownLaps: 4,
  },
  {
    id: 'OVER_TAKE_TOP_3',
    category: 'OVERTAKE',
    difficulty: 'HARD',
    template: 'Will {driver1} break into the top 3 in the next 5 laps?',
    windowSize: 5,
    triggers: [
      { type: 'positionRange', params: { min: 4, max: 6 } },
      { type: 'closingTrend', params: { driver: 'driver1' } },
      { type: 'gapAhead', params: { driver: 'driver1', maxGap: 3.0 } },
    ],
    successCondition: { type: 'positionReached', params: { driver: 'driver1', targetPosition: 3 } },
    priority: 3,
    cooldownLaps: 6,
  },
  {
    id: 'OVER_MAKE_UP_PLACES',
    category: 'OVERTAKE',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} gain at least 2 positions in the next 5 laps?',
    windowSize: 5,
    triggers: [
      { type: 'positionRange', params: { min: 5, max: 15 } },
      { type: 'freshTyres', params: { driver: 'driver1', maxAge: 10 } },
    ],
    successCondition: { type: 'positionGain', params: { driver: 'driver1', minGain: 2 } },
    priority: 3,
    cooldownLaps: 6,
  },
  {
    id: 'OVER_DRS_PASS',
    category: 'OVERTAKE',
    difficulty: 'EASY',
    template: 'Will {driver1} use DRS to pass {driver2} in the next lap?',
    windowSize: 1,
    triggers: [
      { type: 'closeBattle', params: { attacker: 'driver1', defender: 'driver2', maxGap: 1.0 } },
      { type: 'drsActive', params: { driver: 'driver1' } },
      { type: 'drsInactive', params: { driver: 'driver2' } },
    ],
    successCondition: { type: 'overtake', params: { attacker: 'driver1', defender: 'driver2' } },
    priority: 3,
    cooldownLaps: 2,
  },

  // ===== ENERGY BATTLE QUESTIONS (Priority 4) =====
  {
    id: 'ENERGY_DRS_HELP',
    category: 'ENERGY_BATTLE',
    difficulty: 'EASY',
    template: 'Will DRS help {driver1} close the gap to {driver2}?',
    windowSize: 2,
    triggers: [
      { type: 'drsActive', params: { driver: 'driver1' } },
      { type: 'gapRange', params: { attacker: 'driver1', defender: 'driver2', minGap: 0.8, maxGap: 2.0 } },
    ],
    successCondition: { type: 'gapReduced', params: { attacker: 'driver1', defender: 'driver2', minReduction: 0.3 } },
    priority: 4,
    cooldownLaps: 3,
  },
  {
    id: 'ENERGY_NO_DRS_DEFEND',
    category: 'ENERGY_BATTLE',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} successfully defend against {driver2} without DRS?',
    windowSize: 2,
    triggers: [
      { type: 'closeBattle', params: { attacker: 'driver2', defender: 'driver1', maxGap: 1.0 } },
      { type: 'drsActive', params: { driver: 'driver2' } },
      { type: 'drsInactive', params: { driver: 'driver1' } },
    ],
    successCondition: { type: 'positionHeld', params: { defender: 'driver1', attacker: 'driver2' } },
    priority: 4,
    cooldownLaps: 3,
  },
  {
    id: 'ENERGY_TYRE_DELTA',
    category: 'ENERGY_BATTLE',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} have a tyre advantage over {driver2} in 3 laps?',
    windowSize: 3,
    triggers: [
      { type: 'tyreAgeDifference', params: { driver1: 'driver1', driver2: 'driver2', minDiff: 10 } },
    ],
    successCondition: { type: 'gapReduced', params: { attacker: 'driver1', defender: 'driver2', minReduction: 0.5 } },
    priority: 4,
    cooldownLaps: 5,
  },
  {
    id: 'ENERGY_FUEL_SAVE',
    category: 'ENERGY_BATTLE',
    difficulty: 'HARD',
    template: 'Will {driver1} need to lift and coast in the next 5 laps?',
    windowSize: 5,
    triggers: [
      { type: 'positionRange', params: { min: 1, max: 5 } },
      { type: 'lapRange', params: { min: 40, max: 60 } },
    ],
    successCondition: { type: 'lapTimeDelta', params: { driver: 'driver1', minDelta: 0.5 } },
    priority: 4,
    cooldownLaps: 10,
  },

  // ===== GAP CLOSING QUESTIONS (Priority 5) =====
  {
    id: 'GAP_CLOSE_UNDER_1',
    category: 'GAP_CLOSING',
    difficulty: 'EASY',
    template: 'Will {driver1} close the gap to {driver2} to under 1 second?',
    windowSize: 3,
    triggers: [
      { type: 'gapRange', params: { attacker: 'driver1', defender: 'driver2', minGap: 1.0, maxGap: 2.5 } },
      { type: 'closingTrend', params: { driver: 'driver1' } },
    ],
    successCondition: { type: 'gapReached', params: { attacker: 'driver1', defender: 'driver2', targetGap: 1.0 } },
    priority: 5,
    cooldownLaps: 4,
  },
  {
    id: 'GAP_CLOSE_UNDER_3',
    category: 'GAP_CLOSING',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} close the gap to {driver2} to under 3 seconds?',
    windowSize: 5,
    triggers: [
      { type: 'gapRange', params: { attacker: 'driver1', defender: 'driver2', minGap: 3.0, maxGap: 6.0 } },
      { type: 'closingTrend', params: { driver: 'driver1' } },
    ],
    successCondition: { type: 'gapReached', params: { attacker: 'driver1', defender: 'driver2', targetGap: 3.0 } },
    priority: 5,
    cooldownLaps: 6,
  },
  {
    id: 'GAP_LEADER_BREAK',
    category: 'GAP_CLOSING',
    difficulty: 'MEDIUM',
    template: 'Will the leader build a gap of more than 5 seconds?',
    windowSize: 5,
    triggers: [
      { type: 'leaderGap', params: { maxGap: 3.0 } },
      { type: 'position', params: { driver: 'driver1', position: 1 } },
    ],
    successCondition: { type: 'leaderGapReached', params: { targetGap: 5.0 } },
    priority: 5,
    cooldownLaps: 6,
  },
  {
    id: 'GAP_CATCH_BACK',
    category: 'GAP_CLOSING',
    difficulty: 'HARD',
    template: 'Will {driver1} catch up to {driver2} after falling behind?',
    windowSize: 6,
    triggers: [
      { type: 'gapRange', params: { attacker: 'driver1', defender: 'driver2', minGap: 5.0, maxGap: 10.0 } },
      { type: 'freshTyres', params: { driver: 'driver1', maxAge: 5 } },
    ],
    successCondition: { type: 'gapReached', params: { attacker: 'driver1', defender: 'driver2', targetGap: 1.0 } },
    priority: 5,
    cooldownLaps: 8,
  },

  // ===== FINISH POSITION QUESTIONS (Priority 6) =====
  {
    id: 'FINISH_TOP_3',
    category: 'FINISH_POSITION',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} finish in the top 3?',
    windowSize: 10,
    triggers: [
      { type: 'positionRange', params: { min: 3, max: 6 } },
      { type: 'lapRange', params: { min: 40, max: 55 } },
    ],
    successCondition: { type: 'finalPosition', params: { driver: 'driver1', maxPosition: 3 } },
    priority: 6,
    cooldownLaps: 20,
  },
  {
    id: 'FINISH_POINTS',
    category: 'FINISH_POSITION',
    difficulty: 'EASY',
    template: 'Will {driver1} finish in the points (top 10)?',
    windowSize: 10,
    triggers: [
      { type: 'positionRange', params: { min: 8, max: 12 } },
      { type: 'lapRange', params: { min: 40, max: 55 } },
    ],
    successCondition: { type: 'finalPosition', params: { driver: 'driver1', maxPosition: 10 } },
    priority: 6,
    cooldownLaps: 15,
  },
  {
    id: 'FINISH_BEAT_TEAMMATE',
    category: 'FINISH_POSITION',
    difficulty: 'MEDIUM',
    template: 'Will {driver1} finish ahead of teammate {driver2}?',
    windowSize: 15,
    triggers: [
      { type: 'sameTeam', params: { driver1: 'driver1', driver2: 'driver2' } },
      { type: 'positionClose', params: { driver1: 'driver1', driver2: 'driver2', maxGap: 3 } },
      { type: 'lapRange', params: { min: 35, max: 50 } },
    ],
    successCondition: { type: 'finishAhead', params: { driver1: 'driver1', driver2: 'driver2' } },
    priority: 6,
    cooldownLaps: 20,
  },
  {
    id: 'FINISH_PODIUM_NEW',
    category: 'FINISH_POSITION',
    difficulty: 'HARD',
    template: 'Will a driver outside the top 3 make it to the podium?',
    windowSize: 15,
    triggers: [
      { type: 'positionRange', params: { min: 4, max: 8 } },
      { type: 'closingTrend', params: { driver: 'driver1' } },
      { type: 'lapRange', params: { min: 35, max: 50 } },
    ],
    successCondition: { type: 'positionReached', params: { driver: 'driver1', targetPosition: 3 } },
    priority: 6,
    cooldownLaps: 25,
  },
];

/**
 * Get questions by category
 */
export function getQuestionsByCategory(category: QuestionCategory): Question[] {
  return QUESTION_BANK.filter((q) => q.category === category);
}

/**
 * Get question by ID
 */
export function getQuestionById(id: string): Question | undefined {
  return QUESTION_BANK.find((q) => q.id === id);
}

/**
 * Get all questions sorted by priority
 */
export function getQuestionsSortedByPriority(): Question[] {
  return [...QUESTION_BANK].sort((a, b) => a.priority - b.priority);
}

/**
 * Get question categories
 */
export function getCategories(): QuestionCategory[] {
  return ['PIT_WINDOW', 'STRATEGY', 'OVERTAKE', 'ENERGY_BATTLE', 'GAP_CLOSING', 'FINISH_POSITION'];
}

/**
 * Category display names
 */
export const CATEGORY_NAMES: Record<QuestionCategory, string> = {
  PIT_WINDOW: 'Pit Stop',
  STRATEGY: 'Strategy',
  OVERTAKE: 'Overtake',
  ENERGY_BATTLE: 'Energy Battle',
  GAP_CLOSING: 'Gap Closing',
  FINISH_POSITION: 'Finish Position',
};

/**
 * Difficulty display names and colors
 */
export const DIFFICULTY_INFO: Record<string, { name: string; color: string; points: number }> = {
  EASY: { name: 'Easy', color: 'green', points: 10 },
  MEDIUM: { name: 'Medium', color: 'yellow', points: 15 },
  HARD: { name: 'Hard', color: 'red', points: 25 },
};