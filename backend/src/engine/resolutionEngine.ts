import type { RaceSnapshot, DriverState, QuestionInstanceState } from '../types';
import { getQuestionById } from './questionBank';
import { getDriverByNumber, getDriverByPosition } from './derivedSignals';

export interface ResolutionResult {
  instanceId: string;
  outcome: boolean;
  correctAnswer: 'YES' | 'NO';
  explanation: string;
}

/**
 * Resolution Engine - Evaluates question outcomes
 * Resolution only happens on lap completion
 */

/**
 * Check if a question instance should be resolved
 */
export function shouldResolve(
  instance: QuestionInstanceState,
  currentSnapshot: RaceSnapshot
): boolean {
  // Only resolve questions in ACTIVE state
  if (instance.state !== 'ACTIVE') {
    return false;
  }

  // Check if we've reached the target lap
  if (currentSnapshot.lapNumber >= instance.targetLap) {
    return true;
  }

  // Check if either driver has retired
  const driver1 = getDriverByNumber(currentSnapshot, instance.driver1?.driverNumber ?? 0);
  if (driver1?.retired) {
    return true;
  }

  if (instance.driver2) {
    const driver2 = getDriverByNumber(currentSnapshot, instance.driver2.driverNumber);
    if (driver2?.retired) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve a question and determine the outcome
 */
export function resolveQuestion(
  instance: QuestionInstanceState,
  currentSnapshot: RaceSnapshot
): ResolutionResult {
  const question = getQuestionById(instance.questionId);
  if (!question) {
    throw new Error(`Question not found: ${instance.questionId}`);
  }

  const outcome = evaluateSuccessCondition(question.successCondition, instance, currentSnapshot);
  const correctAnswer: 'YES' | 'NO' = outcome ? 'YES' : 'NO';
  const explanation = generateExplanation(instance, currentSnapshot, outcome, question.successCondition.type);

  return {
    instanceId: instance.id,
    outcome,
    correctAnswer,
    explanation,
  };
}

/**
 * Evaluate a success condition
 */
export function evaluateSuccessCondition(
  condition: { type: string; params: Record<string, unknown> },
  instance: QuestionInstanceState,
  currentSnapshot: RaceSnapshot
): boolean {
  const triggerDriver1 = instance.driver1;
  const triggerDriver2 = instance.driver2;

  if (!triggerDriver1) {
    return false;
  }

  // Get current state of drivers
  const currentDriver1 = getDriverByNumber(currentSnapshot, triggerDriver1.driverNumber);
  const currentDriver2 = triggerDriver2
    ? getDriverByNumber(currentSnapshot, triggerDriver2.driverNumber)
    : null;

  if (!currentDriver1) {
    // Driver retired or left race
    return false;
  }

  switch (condition.type) {
    case 'pitStop': {
      const withinLaps = condition.params.withinLaps as number;
      const pitCountBefore = triggerDriver1.pitCount;
      const pitCountNow = currentDriver1.pitCount;
      return pitCountNow > pitCountBefore && currentSnapshot.lapNumber - instance.triggerSnapshot.lapNumber <= withinLaps;
    }

    case 'overtake': {
      if (!triggerDriver2 || !currentDriver2) return false;
      // Overtake happened if driver1's position improved and they're now ahead of driver2
      const wasBehind = triggerDriver1.position > triggerDriver2.position;
      const isAhead = currentDriver1.position < currentDriver2.position;
      return wasBehind && isAhead;
    }

    case 'positionSwap': {
      if (!triggerDriver2 || !currentDriver2) return false;
      const wasBehind = triggerDriver1.position > triggerDriver2.position;
      const isAhead = currentDriver1.position < currentDriver2.position;
      return wasBehind && isAhead;
    }

    case 'positionReached': {
      const targetPosition = condition.params.targetPosition as number;
      return currentDriver1.position <= targetPosition;
    }

    case 'positionGain': {
      const minGain = condition.params.minGain as number;
      const positionsGained = triggerDriver1.position - currentDriver1.position;
      return positionsGained >= minGain;
    }

    case 'positionHeld': {
      if (!triggerDriver2 || !currentDriver2) return false;
      // Defender held position if they're still ahead of the attacker
      return currentDriver1.position < currentDriver2.position;
    }

    case 'gapReduced': {
      if (!triggerDriver2 || !currentDriver2) return false;
      const minReduction = condition.params.minReduction as number;
      const triggerGap = Math.abs(
        (triggerDriver1.gap ?? 0) - (triggerDriver2.gap ?? 0)
      );
      const currentGap = Math.abs(
        (currentDriver1.gap ?? 0) - (currentDriver2.gap ?? 0)
      );
      return triggerGap - currentGap >= minReduction;
    }

    case 'gapReached': {
      if (!triggerDriver2 || !currentDriver2) return false;
      const targetGap = condition.params.targetGap as number;
      const currentGap = Math.abs(
        (currentDriver1.gap ?? 0) - (currentDriver2.gap ?? 0)
      );
      return currentGap <= targetGap;
    }

    case 'leaderGapReached': {
      const targetGap = condition.params.targetGap as number;
      const second = currentSnapshot.drivers[1];
      return second?.interval !== null && (second?.interval ?? 0) >= targetGap;
    }

    case 'undercutSuccess': {
      if (!triggerDriver2 || !currentDriver2) return false;
      // Undercut worked if driver1 pitted and is now ahead of driver2 who hasn't pitted
      const driver1Pitted = currentDriver1.pitCount > triggerDriver1.pitCount;
      const driver2Pitted = currentDriver2.pitCount > triggerDriver2.pitCount;
      const isAhead = currentDriver1.position < currentDriver2.position;
      return driver1Pitted && !driver2Pitted && isAhead;
    }

    case 'overcutSuccess': {
      if (!triggerDriver2 || !currentDriver2) return false;
      // Overcut worked if driver2 pitted and driver1 stayed out and is still ahead
      const driver1Pitted = currentDriver1.pitCount > triggerDriver1.pitCount;
      const driver2Pitted = currentDriver2.pitCount > triggerDriver2.pitCount;
      const isAhead = currentDriver1.position < currentDriver2.position;
      return !driver1Pitted && driver2Pitted && isAhead;
    }

    case 'finalPosition': {
      const maxPosition = condition.params.maxPosition as number;
      // For this to resolve, the race must be finished or we're past the window
      if (currentSnapshot.trackStatus !== 'RED' && currentSnapshot.lapNumber < instance.targetLap) {
        // Race not finished, use current position as proxy
        return currentDriver1.position <= maxPosition;
      }
      return currentDriver1.position <= maxPosition;
    }

    case 'finishAhead': {
      if (!triggerDriver2 || !currentDriver2) return false;
      return currentDriver1.position < currentDriver2.position;
    }

    case 'pitCountAtEnd': {
      const maxStops = condition.params.maxStops as number;
      return currentDriver1.pitCount <= maxStops;
    }

    case 'lapTimeDelta': {
      const minDelta = condition.params.minDelta as number;
      // Check if driver's lap times have degraded
      const triggerLapTime = triggerDriver1.lastLapTime;
      const currentLapTime = currentDriver1.lastLapTime;
      if (!triggerLapTime || !currentLapTime) return false;
      return currentLapTime - triggerLapTime >= minDelta;
    }

    default:
      console.warn(`Unknown success condition type: ${condition.type}`);
      return false;
  }
}

/**
 * Generate an explanation for the outcome
 */
export function generateExplanation(
  instance: QuestionInstanceState,
  currentSnapshot: RaceSnapshot,
  outcome: boolean,
  conditionType: string
): string {
  const driver1Name = instance.driver1?.name ?? 'Driver';
  const driver2Name = instance.driver2?.name ?? 'the car ahead';
  const triggerDriver1 = instance.driver1;
  const currentDriver1 = triggerDriver1
    ? getDriverByNumber(currentSnapshot, triggerDriver1.driverNumber)
    : null;

  const yesNo = outcome ? 'Yes' : 'No';
  const didDidNot = outcome ? 'did' : 'did not';

  switch (conditionType) {
    case 'pitStop':
      return `${yesNo}! ${driver1Name} ${didDidNot} pit within the specified window. Tyre age was ${triggerDriver1?.tyreAge ?? 0} laps at trigger.`;

    case 'overtake':
      return `${yesNo}! ${driver1Name} ${didDidNot} overtake ${driver2Name}. Position change: ${triggerDriver1?.position} → ${currentDriver1?.position}.`;

    case 'positionSwap':
      return `${yesNo}! ${driver1Name} ${didDidNot} let ${driver2Name} pass. New positions: ${driver1Name} P${currentDriver1?.position}, ${driver2Name} ahead.`;

    case 'positionReached':
      return `${yesNo}! ${driver1Name} ${outcome ? 'reached' : 'did not reach'} the target position. Current: P${currentDriver1?.position}.`;

    case 'positionGain':
      const positionsGained = (triggerDriver1?.position ?? 0) - (currentDriver1?.position ?? 0);
      return `${yesNo}! ${driver1Name} gained ${positionsGained} position(s). Started P${triggerDriver1?.position}, now P${currentDriver1?.position}.`;

    case 'positionHeld':
      return `${yesNo}! ${driver1Name} ${outcome ? 'successfully defended' : 'could not defend against'} ${driver2Name}.`;

    case 'gapReduced':
      return `${yesNo}! The gap ${outcome ? 'decreased' : 'did not decrease enough'} between ${driver1Name} and ${driver2Name}.`;

    case 'gapReached':
      return `${yesNo}! ${driver1Name} ${outcome ? 'closed to within' : 'did not close to'} the target gap to ${driver2Name}.`;

    case 'undercutSuccess':
      return `${yesNo}! The undercut ${outcome ? 'worked' : 'did not work'} for ${driver1Name}.`;

    case 'overcutSuccess':
      return `${yesNo}! The overcut ${outcome ? 'worked' : 'did not work'} for ${driver1Name}.`;

    case 'finalPosition':
      return `${yesNo}! ${driver1Name} ${outcome ? 'finished in' : 'did not finish in'} the target position. Final: P${currentDriver1?.position}.`;

    case 'finishAhead':
      return `${yesNo}! ${driver1Name} finished ${outcome ? 'ahead of' : 'behind'} ${driver2Name}.`;

    case 'pitCountAtEnd':
      return `${yesNo}! ${driver1Name} made ${currentDriver1?.pitCount ?? 0} pit stop(s).`;

    default:
      return `${yesNo}! The prediction ${didDidNot} come true for ${driver1Name}.`;
  }
}

/**
 * Check if a question should be cancelled due to race conditions
 */
export function shouldCancel(
  instance: QuestionInstanceState,
  currentSnapshot: RaceSnapshot
): { cancel: boolean; reason: string } | null {
  // Cancel if track status is SC or VSC and question is not locked
  if (['TRIGGERED', 'LIVE'].includes(instance.state)) {
    if (currentSnapshot.trackStatus === 'SC') {
      return { cancel: true, reason: 'Safety Car deployed' };
    }
    if (currentSnapshot.trackStatus === 'VSC') {
      return { cancel: true, reason: 'Virtual Safety Car deployed' };
    }
  }

  // Cancel if driver retired
  const driver1 = instance.driver1
    ? getDriverByNumber(currentSnapshot, instance.driver1.driverNumber)
    : null;
  if (driver1?.retired) {
    return { cancel: true, reason: `${instance.driver1?.name} retired` };
  }

  if (instance.driver2) {
    const driver2 = getDriverByNumber(currentSnapshot, instance.driver2.driverNumber);
    if (driver2?.retired) {
      return { cancel: true, reason: `${instance.driver2.name} retired` };
    }
  }

  // Cancel if red flag
  if (currentSnapshot.trackStatus === 'RED') {
    return { cancel: true, reason: 'Red flag' };
  }

  return null;
}

/**
 * Check if a question should be paused (SC/VSC after lock)
 */
export function shouldPause(
  instance: QuestionInstanceState,
  currentSnapshot: RaceSnapshot
): boolean {
  if (instance.state === 'LOCKED' || instance.state === 'ACTIVE') {
    return currentSnapshot.trackStatus === 'SC' || currentSnapshot.trackStatus === 'VSC';
  }
  return false;
}

/**
 * Check if a paused question should resume
 */
export function shouldResume(
  instance: QuestionInstanceState,
  currentSnapshot: RaceSnapshot
): boolean {
  // This would need additional state tracking for "paused" status
  // For now, just check if green flag is back
  return currentSnapshot.trackStatus === 'GREEN';
}