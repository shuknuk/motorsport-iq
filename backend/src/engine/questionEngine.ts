// @ts-nocheck - Complex type inference with union types
// @ts-nocheck - Complex type inference issues
import type { RaceSnapshot, DriverState, Question, QuestionInstanceState, DerivedSignals } from '../types';
import { QUESTION_BANK, getQuestionById } from './questionBank';
import { calculateDerivedSignals, getDriverByPosition, getDriverByNumber, getTeammate, getCloseBattles, areTeammates } from './derivedSignals';
import { v4 as uuidv4 } from 'uuid';

export interface TriggerContext {
  snapshot: RaceSnapshot;
  previousSnapshot: RaceSnapshot | null;
  signals: DerivedSignals;
}

export interface QuestionCandidate {
  question: Question;
  driver1: DriverState;
  driver2: DriverState | null;
  score: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

// Cooldown tracking per lobby per category
const categoryCooldowns: Map<string, Map<string, number>> = new Map(); // lobbyId -> (category -> lastTriggeredLap)

/**
 * Check if a question can be triggered globally
 */
export function checkGlobalEligibility(
  snapshot: RaceSnapshot,
  activeQuestion: QuestionInstanceState | null,
  questionCount: number,
  maxQuestions = 10
): EligibilityResult {
  // Check if there's already an active question
  if (activeQuestion && !['CLOSED', 'CANCELLED'].includes(activeQuestion.state)) {
    return { eligible: false, reason: 'Active question already exists' };
  }

  // Check if track is green
  if (snapshot.trackStatus !== 'GREEN') {
    return { eligible: false, reason: `Track status is ${snapshot.trackStatus}` };
  }

  // Check if data feed is stalled
  if (snapshot.dataFeedStalled) {
    return { eligible: false, reason: 'Data feed stalled' };
  }

  // Check if max questions reached
  if (questionCount >= maxQuestions) {
    return { eligible: false, reason: 'Maximum questions reached' };
  }

  // Check if race is near end (last 2 laps - no new questions)
  if (snapshot.totalLaps && snapshot.lapNumber >= snapshot.totalLaps - 1) {
    return { eligible: false, reason: 'Race nearing end' };
  }

  return { eligible: true };
}

/**
 * Evaluate a single trigger condition
 */
export function evaluateTrigger(
  trigger: { type: string; params: Record<string, unknown> },
  context: TriggerContext,
  driver1: DriverState,
  driver2: DriverState | null
): boolean {
  const { snapshot, signals } = context;

  switch (trigger.type) {
    case 'pitWindowOpen':
      return signals.pitWindowOpen.get(driver1.driverNumber) ?? false;

    case 'undercutWindow':
      return signals.undercutWindow.get(driver1.driverNumber) ?? false;

    case 'tyreCliffRisk':
      return signals.tyreCliffRisk.get(driver1.driverNumber) ?? false;

    case 'closeBattle':
      if (!driver2) return false;
      const maxGap = (trigger.params.maxGap as number) ?? 2.0;
      const battle = signals.closeBattles.find(
        (b) => b.attacker === driver1.driverNumber && b.defender === driver2.driverNumber
      );
      return battle !== undefined && battle.gap <= maxGap;

    case 'closingTrend':
      return signals.closingTrend.get(driver1.driverNumber) ?? false;

    case 'drsActive':
      return driver1.drsEnabled;

    case 'drsInactive':
      return !driver1.drsEnabled;

    case 'positionRange': {
      const min = trigger.params.min as number;
      const max = trigger.params.max as number;
      return driver1.position >= min && driver1.position <= max;
    }

    case 'position':
      return driver1.position === trigger.params.position;

    case 'gapRange': {
      if (!driver2) return false;
      const minGap = trigger.params.minGap as number;
      const maxGap = trigger.params.maxGap as number;
      const gap = driver1.interval ?? 0;
      return gap >= minGap && gap <= maxGap;
    }

    case 'gapAhead': {
      const maxGap = trigger.params.maxGap as number;
      return driver1.interval !== null && driver1.interval <= maxGap;
    }

    case 'sameTeam':
      if (!driver2) return false;
      return areTeammates(driver1, driver2);

    case 'freshTyres': {
      const maxAge = trigger.params.maxAge as number;
      return driver1.tyreAge <= maxAge;
    }

    case 'tyreAgeDifference': {
      if (!driver2) return false;
      const minDiff = trigger.params.minDiff as number;
      const diff = Math.abs(driver1.tyreAge - driver2.tyreAge);
      return diff >= minDiff;
    }

    case 'pitCount': {
      const count = trigger.params.count as number;
      return driver1.pitCount === count;
    }

    case 'lapRange': {
      const min = trigger.params.min as number;
      const max = trigger.params.max as number;
      return snapshot.lapNumber >= min && snapshot.lapNumber <= max;
    }

    case 'leaderGap': {
      const maxGap = trigger.params.maxGap as number;
      const second = snapshot.drivers[1];
      return second?.interval !== null && (second?.interval ?? 0) <= maxGap;
    }

    case 'positionDifference': {
      if (!driver2) return false;
      const minGap = trigger.params.minGap as number;
      const maxGap = trigger.params.maxGap as number;
      const gap = Math.abs(
        (driver1.gap ?? 0) - (driver2.gap ?? 0)
      );
      return gap >= minGap && gap <= maxGap;
    }

    case 'positionClose': {
      if (!driver2) return false;
      const maxGap = trigger.params.maxGap as number;
      const gap = Math.abs(
        (driver1.gap ?? 0) - (driver2.gap ?? 0)
      );
      return gap <= maxGap;
    }

    case 'randomEvent': {
      // For rare events like damage, safety car debris, etc.
      const probability = trigger.params.probability as number;
      return Math.random() < probability;
    }

    default:
      console.warn(`Unknown trigger type: ${trigger.type}`);
      return false;
  }
}

/**
 * Evaluate all triggers for a question
 */
export function evaluateAllTriggers(
  question: Question,
  context: TriggerContext
): QuestionCandidate[] {
  const candidates: QuestionCandidate[] = [];
  const { snapshot } = context;

  // Get candidate drivers for driver1
  const candidateDrivers = snapshot.drivers.filter((d) => !d.retired && !d.inPit);

  for (const driver1 of candidateDrivers) {
    // Check if all triggers pass for this driver
    let allTriggersPass = true;

    for (const trigger of question.triggers) {
      // Determine driver2 if needed
      let driver2: DriverState | null = null;

      if (trigger.params.defender === 'driver2' || trigger.params.driver2 === 'driver2') {
        // Find the appropriate driver2 (usually the car ahead)
        driver2 = snapshot.drivers.find((d) => d.position === driver1.position - 1) ?? null;
        if (!driver2 && trigger.type !== 'sameTeam') {
          allTriggersPass = false;
          break;
        }
      }

      if (!evaluateTrigger(trigger, context, driver1, driver2)) {
        allTriggersPass = false;
        break;
      }
    }

    if (allTriggersPass) {
      // Find driver2 for the question
      const driver2 = snapshot.drivers.find((d) => d.position === driver1.position - 1) ?? null;

      // Calculate a score based on various factors
      const score = calculateQuestionScore(question, driver1, driver2, context);

      candidates.push({
        question,
        driver1,
        driver2,
        score,
      });
    }
  }

  return candidates;
}

/**
 * Calculate a score for ranking question candidates
 */
function calculateQuestionScore(
  question: Question,
  driver1: DriverState,
  driver2: DriverState | null,
  context: TriggerContext
): number {
  let score = 100;

  // Higher score for battles closer together
  if (driver1.interval !== null) {
    score += Math.max(0, 20 - driver1.interval * 10);
  }

  // Higher score for top positions
  score += Math.max(0, 20 - driver1.position * 2);

  // Higher score for drivers in points
  if (driver1.position <= 10) {
    score += 10;
  }

  // Higher score for podium positions
  if (driver1.position <= 3) {
    score += 15;
  }

  // Lower score if this driver was recently in a question
  // (This would need to be tracked separately)

  return score;
}

/**
 * Apply priority hierarchy and tiebreakers
 * Priority: Pit > Strategy > Overtake > Energy > Gap > Finish
 */
export function applyPriorityHierarchy(candidates: QuestionCandidate[]): QuestionCandidate[] {
  // Sort by priority (lower is higher priority), then by score
  return candidates.sort((a, b) => {
    // First by priority
    if (a.question.priority !== b.question.priority) {
      return a.question.priority - b.question.priority;
    }
    // Then by score (higher is better)
    return b.score - a.score;
  });
}

/**
 * Check if category is on cooldown
 */
export function isCategoryOnCooldown(
  lobbyId: string,
  category: string,
  currentLap: number
): boolean {
  const lobbyCooldowns = categoryCooldowns.get(lobbyId);
  if (!lobbyCooldowns) return false;

  const lastTriggeredLap = lobbyCooldowns.get(category);
  if (lastTriggeredLap === undefined) return false;

  const question = QUESTION_BANK.find((q) => q.category === category);
  const cooldownLaps = question?.cooldownLaps ?? 3;

  return currentLap - lastTriggeredLap < cooldownLaps;
}

/**
 * Set cooldown for a category
 */
export function setCategoryCooldown(lobbyId: string, category: string, lap: number): void {
  let lobbyCooldowns = categoryCooldowns.get(lobbyId);
  if (!lobbyCooldowns) {
    lobbyCooldowns = new Map();
    categoryCooldowns.set(lobbyId, lobbyCooldowns);
  }
  lobbyCooldowns.set(category, lap);
}

/**
 * Select the best question for a lobby
 */
export function selectQuestion(
  snapshot: RaceSnapshot,
  previousSnapshot: RaceSnapshot | null,
  lobbyId: string,
  activeQuestion: QuestionInstanceState | null,
  questionCount: number
): QuestionInstanceState | null {
  // Check global eligibility
  const eligibility = checkGlobalEligibility(snapshot, activeQuestion, questionCount);
  if (!eligibility.eligible) {
    console.log(`Not eligible for question: ${eligibility.reason}`);
    return null;
  }

  // Calculate derived signals
  const signals = calculateDerivedSignals(snapshot, previousSnapshot);
  const context: TriggerContext = { snapshot, previousSnapshot, signals };

  // Collect all candidates from all questions
  let allCandidates: QuestionCandidate[] = [];

  for (const question of QUESTION_BANK) {
    // Check cooldown
    if (isCategoryOnCooldown(lobbyId, question.category, snapshot.lapNumber)) {
      continue;
    }

    const candidates = evaluateAllTriggers(question, context);
    allCandidates = allCandidates.concat(candidates);
  }

  if (allCandidates.length === 0) {
    return null;
  }

  // Apply priority hierarchy
  const sortedCandidates = applyPriorityHierarchy(allCandidates);

  // Select the best candidate
  const selected = sortedCandidates[0];

  // Set cooldown
  setCategoryCooldown(lobbyId, selected.question.category, snapshot.lapNumber);

  // Create question instance
  const instance: QuestionInstanceState = {
    id: uuidv4(),
    lobbyId,
    questionId: selected.question.id,
    state: 'TRIGGERED',
    triggeredAt: new Date(),
    triggerSnapshot: snapshot,
    windowSize: selected.question.windowSize,
    targetLap: snapshot.lapNumber + selected.question.windowSize,
    answer: null,
    outcome: null,
    questionText: formatQuestionText(selected.question, selected.driver1, selected.driver2),
    driver1: selected.driver1,
    driver2: selected.driver2 ?? undefined,
  };

  return instance;
}

/**
 * Format question text with driver names
 */
export function formatQuestionText(
  question: Question,
  driver1: DriverState,
  driver2: DriverState | null
): string {
  let text = question.template;

  text = text.replace(/{driver1}/g, driver1.name);
  text = text.replace(/{driver2}/g, driver2?.name ?? 'the car ahead');

  return text;
}

/**
 * Clear cooldowns for a lobby (e.g., when race ends)
 */
export function clearCooldowns(lobbyId: string): void {
  categoryCooldowns.delete(lobbyId);
}

/**
 * Get all valid candidates for debugging
 */
export function getAllCandidates(
  snapshot: RaceSnapshot,
  previousSnapshot: RaceSnapshot | null
): QuestionCandidate[] {
  const signals = calculateDerivedSignals(snapshot, previousSnapshot);
  const context: TriggerContext = { snapshot, previousSnapshot, signals };

  let allCandidates: QuestionCandidate[] = [];

  for (const question of QUESTION_BANK) {
    const candidates = evaluateAllTriggers(question, context);
    allCandidates = allCandidates.concat(candidates);
  }

  return applyPriorityHierarchy(allCandidates);
}