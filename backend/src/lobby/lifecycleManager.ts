// @ts-nocheck - Supabase type inference issues with generic client
// @ts-nocheck - Supabase type inference issues with generic client
import type { QuestionInstanceState, RaceSnapshot } from '../types';
import type { QuestionInstance, Answer } from '../db/types';
import supabase from '../db/supabaseClient';
import { getLobbyState, setCurrentQuestion, incrementQuestionCount, updateLeaderboardCache } from './lobbyManager';
import { resolveQuestion, shouldCancel, shouldPause, shouldResume, shouldResolve } from '../engine/resolutionEngine';
import { recordResolution } from '../engine/questionEngine';
import { calculateScore } from '../engine/scoringEngine';
import { getQuestionById } from '../engine/questionBank';
import { generateResolutionExplanation } from '../ai/explanationGenerator';

/**
 * Lifecycle Manager - Question FSM and state transitions
 *
 * States: TRIGGERED → LIVE → LOCKED → ACTIVE → RESOLVED → EXPLAINED → CLOSED
 * - TRIGGERED: Question just created, waiting to go live
 * - LIVE: Players can answer (20 seconds)
 * - LOCKED: Answer period ended, waiting for resolution window
 * - ACTIVE: Question is active in race, waiting for outcome
 * - RESOLVED: Outcome determined, waiting for explanation
 * - EXPLAINED: Explanation shown, waiting to close
 * - CLOSED: Question complete
 *
 * Special states:
 * - PAUSED: SC/VSC during ACTIVE state
 * - CANCELLED: Question cancelled (SC/VSC before lock, driver retired, red flag)
 */

// Timers
const ANSWER_WINDOW_MS = 20000; // 20 seconds to answer
const EXPLANATION_DURATION_MS = 10000; // 10 seconds to show explanation
const TRIGGER_TO_LIVE_MS = 1000; // 1 second between trigger and live

// Active timers tracking
const questionTimers: Map<string, NodeJS.Timeout> = new Map();
const answerDeadlines: Map<string, Date> = new Map();

// Active questions by lobby
const activeQuestions: Map<string, QuestionInstanceState> = new Map();

// Paused questions (SC/VSC)
const pausedQuestions: Map<string, QuestionInstanceState> = new Map();

/**
 * Create a new question instance in database
 */
export async function createQuestionInstance(
  instance: QuestionInstanceState
): Promise<QuestionInstance> {
  const { data, error } = await supabase
    .from('question_instances')
    .insert({
      id: instance.id,
      lobby_id: instance.lobbyId,
      question_id: instance.questionId,
      state: instance.state,
      triggered_at: instance.triggeredAt.toISOString(),
      trigger_snapshot: instance.triggerSnapshot as any,
      window_size: instance.windowSize,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create question instance: ${error.message}`);
  }

  return data;
}

/**
 * Update question instance state in database
 */
export async function updateQuestionState(
  instanceId: string,
  state: string,
  updates: Partial<QuestionInstance> = {}
): Promise<void> {
  const updateData: Partial<QuestionInstance> = {
    state,
    ...updates,
  };

  // Set timestamps based on state
  if (state === 'LIVE') {
    updateData.locked_at = null; // Will be set when locked
  } else if (state === 'LOCKED') {
    updateData.locked_at = new Date().toISOString();
  } else if (state === 'RESOLVED') {
    updateData.resolved_at = new Date().toISOString();
  } else if (state === 'CLOSED') {
    updateData.closed_at = new Date().toISOString();
  }

  await supabase
    .from('question_instances')
    .update(updateData)
    .eq('id', instanceId);
}

/**
 * Start question lifecycle
 */
export async function startQuestionLifecycle(
  instance: QuestionInstanceState,
  onStateChange: (instance: QuestionInstanceState) => void,
  onResolution: (result: { instance: QuestionInstanceState; outcome: boolean; correctAnswer: 'YES' | 'NO'; explanation: string }) => void
): Promise<void> {
  // Store in active questions
  activeQuestions.set(instance.lobbyId, instance);
  setCurrentQuestion(instance.lobbyId, instance);

  // Create in database
  await createQuestionInstance(instance);

  // Increment question count
  await incrementQuestionCount(instance.lobbyId);

  // TRIGGERED -> LIVE (after brief delay)
  setTimeout(async () => {
    if (instance.state !== 'TRIGGERED') return;

    instance.state = 'LIVE';
    await updateQuestionState(instance.id, 'LIVE');
    onStateChange({ ...instance });

    // Set answer deadline
    const deadline = new Date(Date.now() + ANSWER_WINDOW_MS);
    answerDeadlines.set(instance.id, deadline);

    // LIVE -> LOCKED (after answer window)
    const timer = setTimeout(async () => {
      await transitionToLocked(instance, onStateChange, onResolution);
    }, ANSWER_WINDOW_MS);

    questionTimers.set(instance.id, timer);
  }, TRIGGER_TO_LIVE_MS);
}

/**
 * Transition to LOCKED state
 */
async function transitionToLocked(
  instance: QuestionInstanceState,
  onStateChange: (instance: QuestionInstanceState) => void,
  onResolution: (result: { instance: QuestionInstanceState; outcome: boolean; correctAnswer: 'YES' | 'NO'; explanation: string }) => void
): Promise<void> {
  if (instance.state !== 'LIVE') return;

  instance.state = 'LOCKED';
  await updateQuestionState(instance.id, 'LOCKED');
  onStateChange({ ...instance });

  // LOCKED -> ACTIVE (immediately after lock)
  instance.state = 'ACTIVE';
  await updateQuestionState(instance.id, 'ACTIVE');
  onStateChange({ ...instance });

  // Clear the answer deadline
  answerDeadlines.delete(instance.id);
}

/**
 * Check for resolution (called on each lap completion)
 */
export async function checkForResolution(
  lobbyId: string,
  currentSnapshot: RaceSnapshot,
  onResolution: (result: { instance: QuestionInstanceState; outcome: boolean; correctAnswer: 'YES' | 'NO'; explanation: string }) => void,
  onStateChange: (instance: QuestionInstanceState) => void
): Promise<void> {
  const instance = activeQuestions.get(lobbyId);
  if (!instance || instance.state !== 'ACTIVE') return;

  // Check for cancellation first
  const cancelReason = shouldCancel(instance, currentSnapshot);
  if (cancelReason) {
    await cancelQuestion(instance, cancelReason.reason, onStateChange);
    return;
  }

  // Check if should pause
  if (shouldPause(instance, currentSnapshot)) {
    await pauseQuestion(instance, onStateChange);
    return;
  }

  // Check if should resolve
  if (shouldResolve(instance, currentSnapshot)) {
    await resolveQuestionInstance(instance, currentSnapshot, onResolution, onStateChange);
  }
}

/**
 * Pause question (SC/VSC)
 */
async function pauseQuestion(
  instance: QuestionInstanceState,
  onStateChange: (instance: QuestionInstanceState) => void
): Promise<void> {
  // Store in paused questions
  pausedQuestions.set(instance.lobbyId, instance);

  // Clear any active timer
  const timer = questionTimers.get(instance.id);
  if (timer) {
    clearTimeout(timer);
    questionTimers.delete(instance.id);
  }

  // Note: We don't change state in DB, just track paused status
  onStateChange({ ...instance });
}

/**
 * Resume paused question
 */
export async function resumeQuestion(
  lobbyId: string,
  currentSnapshot: RaceSnapshot,
  onResolution: (result: { instance: QuestionInstanceState; outcome: boolean; correctAnswer: 'YES' | 'NO'; explanation: string }) => void,
  onStateChange: (instance: QuestionInstanceState) => void
): Promise<void> {
  const instance = pausedQuestions.get(lobbyId);
  if (!instance) return;

  // Remove from paused
  pausedQuestions.delete(lobbyId);

  // Check if should resume
  if (shouldResume(instance, currentSnapshot)) {
    // Put back in active
    activeQuestions.set(lobbyId, instance);

    // Check for resolution
    await checkForResolution(lobbyId, currentSnapshot, onResolution, onStateChange);
  }
}

/**
 * Cancel question
 */
async function cancelQuestion(
  instance: QuestionInstanceState,
  reason: string,
  onStateChange: (instance: QuestionInstanceState) => void
): Promise<void> {
  // Clear timer
  const timer = questionTimers.get(instance.id);
  if (timer) {
    clearTimeout(timer);
    questionTimers.delete(instance.id);
  }

  // Update instance
  instance.state = 'CANCELLED' as any;
  instance.cancelledReason = reason;
  instance.cancelledAt = new Date();

  // Update database
  await supabase
    .from('question_instances')
    .update({
      state: 'CANCELLED',
      cancelled_reason: reason,
      cancelled_at: instance.cancelledAt.toISOString(),
    })
    .eq('id', instance.id);

  // Remove from active
  activeQuestions.delete(instance.lobbyId);
  pausedQuestions.delete(instance.lobbyId);
  setCurrentQuestion(instance.lobbyId, null);

  onStateChange({ ...instance });
}

/**
 * Resolve question
 */
async function resolveQuestionInstance(
  instance: QuestionInstanceState,
  currentSnapshot: RaceSnapshot,
  onResolution: (result: { instance: QuestionInstanceState; outcome: boolean; correctAnswer: 'YES' | 'NO'; explanation: string }) => void,
  onStateChange: (instance: QuestionInstanceState) => void
): Promise<void> {
  // Get resolution
  const result = resolveQuestion(instance, currentSnapshot);
  const question = getQuestionById(instance.questionId);
  const explanation = await generateResolutionExplanation(
    instance,
    currentSnapshot,
    result.outcome,
    result.explanation
  );

  // Update instance
  instance.state = 'RESOLVED';
  instance.outcome = result.outcome;
  instance.answer = result.correctAnswer;
  instance.explanation = explanation;
  instance.resolvedAt = new Date();
  if (question) {
    recordResolution(instance.lobbyId, question.category, currentSnapshot.lapNumber);
  }

  // Update database
  await updateQuestionState(instance.id, 'RESOLVED', {
    answer: result.correctAnswer,
    outcome: result.outcome,
    explanation,
    resolved_at: instance.resolvedAt.toISOString(),
  });

  onStateChange({ ...instance });

  // Process answers and update scores
  await processAnswers(instance, result.correctAnswer);

  // RESOLVED -> EXPLAINED -> CLOSED (after delay)
  setTimeout(async () => {
    instance.state = 'EXPLAINED';
    await updateQuestionState(instance.id, 'EXPLAINED');
    onStateChange({ ...instance });

    // Call resolution callback
    onResolution({
      instance: { ...instance },
      outcome: result.outcome,
      correctAnswer: result.correctAnswer,
      explanation,
    });

    // EXPLAINED -> CLOSED
    setTimeout(async () => {
      instance.state = 'CLOSED';
      await updateQuestionState(instance.id, 'CLOSED');
      onStateChange({ ...instance });

      // Remove from active
      activeQuestions.delete(instance.lobbyId);
      setCurrentQuestion(instance.lobbyId, null);
    }, EXPLANATION_DURATION_MS);
  }, 1000);
}

/**
 * Process answers for a resolved question
 */
async function processAnswers(
  instance: QuestionInstanceState,
  correctAnswer: 'YES' | 'NO'
): Promise<void> {
  // Fetch all answers for this question
  const { data: answers, error } = await supabase
    .from('answers')
    .select()
    .eq('instance_id', instance.id);

  if (error || !answers) return;

  // Process each answer
  for (const answer of answers) {
    // Calculate score
    const lobbyState = await getLobbyState(instance.lobbyId);
    const leaderboardEntry = lobbyState?.leaderboard.find((lb) => lb.userId === answer.user_id);
    const currentStreak = leaderboardEntry?.streak ?? 0;

    const scoreResult = calculateScore(answer.answer, correctAnswer, currentStreak);

    // Update leaderboard in database using the stored procedure
    await supabase.rpc('update_leaderboard', {
      p_lobby_id: instance.lobbyId,
      p_user_id: answer.user_id,
      p_points_change: scoreResult.pointsChange,
      p_is_correct: scoreResult.isCorrect,
    });

    // Update cache
    const user = lobbyState?.players.find((p) => p.id === answer.user_id);
    updateLeaderboardCache(instance.lobbyId, answer.user_id, {
      username: user?.username ?? '',
      points: (leaderboardEntry?.points ?? 0) + scoreResult.pointsChange,
      streak: scoreResult.newStreak,
      maxStreak: Math.max(leaderboardEntry?.maxStreak ?? 0, scoreResult.newStreak),
      correctAnswers: (leaderboardEntry?.correctAnswers ?? 0) + (scoreResult.isCorrect ? 1 : 0),
      wrongAnswers: (leaderboardEntry?.wrongAnswers ?? 0) + (scoreResult.isCorrect ? 0 : 1),
      questionsAnswered: (leaderboardEntry?.questionsAnswered ?? 0) + 1,
      accuracy: scoreResult.isCorrect
        ? ((leaderboardEntry?.correctAnswers ?? 0) + 1) / ((leaderboardEntry?.questionsAnswered ?? 0) + 1) * 100
        : (leaderboardEntry?.correctAnswers ?? 0) / ((leaderboardEntry?.questionsAnswered ?? 0) + 1) * 100,
    });
  }
}

/**
 * Submit an answer
 */
export async function submitAnswer(
  instanceId: string,
  userId: string,
  answer: 'YES' | 'NO'
): Promise<{ success: boolean; error?: string }> {
  const instance = [...activeQuestions.values()].find((q) => q.id === instanceId);

  if (!instance) {
    return { success: false, error: 'Question not found' };
  }

  if (instance.state !== 'LIVE') {
    return { success: false, error: 'Answer period has ended' };
  }

  // Check if deadline passed
  const deadline = answerDeadlines.get(instanceId);
  if (deadline && new Date() > deadline) {
    return { success: false, error: 'Answer period has ended' };
  }

  // Check if already answered
  const { data: existingAnswer } = await supabase
    .from('answers')
    .select()
    .eq('instance_id', instanceId)
    .eq('user_id', userId)
    .single();

  if (existingAnswer) {
    return { success: false, error: 'Already answered' };
  }

  // Calculate response time
  const responseTimeMs = Date.now() - instance.triggeredAt.getTime();

  // Save answer
  const { error } = await supabase.from('answers').insert({
    instance_id: instanceId,
    user_id: userId,
    answer,
    response_time_ms: responseTimeMs,
  });

  if (error) {
    return { success: false, error: 'Failed to save answer' };
  }

  return { success: true };
}

/**
 * Get active question for a lobby
 */
export function getActiveQuestion(lobbyId: string): QuestionInstanceState | null {
  return activeQuestions.get(lobbyId) ?? null;
}

/**
 * Get answer deadline for a question
 */
export function getAnswerDeadline(instanceId: string): Date | null {
  return answerDeadlines.get(instanceId) ?? null;
}

/**
 * Get question state for reconnection
 */
export async function getQuestionStateForReconnect(
  instanceId: string
): Promise<QuestionInstanceState | null> {
  const { data, error } = await supabase
    .from('question_instances')
    .select()
    .eq('id', instanceId)
    .single();

  if (error || !data) return null;

  // Get user's answer if any
  // This would need the userId to fetch

  return {
    id: data.id,
    lobbyId: data.lobby_id,
    questionId: data.question_id,
    state: data.state as any,
    triggeredAt: new Date(data.triggered_at),
    lockedAt: data.locked_at ? new Date(data.locked_at) : undefined,
    resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined,
    closedAt: data.closed_at ? new Date(data.closed_at) : undefined,
    triggerSnapshot: data.trigger_snapshot as any,
    windowSize: data.window_size,
    targetLap: 0, // Would need to calculate from snapshot
    answer: data.answer as 'YES' | 'NO' | null,
    outcome: data.outcome,
    explanation: data.explanation ?? undefined,
    cancelledReason: data.cancelled_reason ?? undefined,
    cancelledAt: data.cancelled_at ? new Date(data.cancelled_at) : undefined,
  };
}

/**
 * Clear all timers (cleanup on shutdown)
 */
export function clearAllTimers(): void {
  for (const timer of questionTimers.values()) {
    clearTimeout(timer);
  }
  questionTimers.clear();
  answerDeadlines.clear();
  activeQuestions.clear();
  pausedQuestions.clear();
}
