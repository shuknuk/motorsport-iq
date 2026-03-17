import type {
  Difficulty,
  InstanceState,
  QuestionCategory,
  QuestionEvent,
  QuestionInstanceState,
} from '../types';

const UNRESOLVED_STATES: ReadonlySet<InstanceState> = new Set(['LIVE', 'LOCKED', 'ACTIVE']);
const ANSWER_WINDOW_MS = 20_000;

export function isUnresolvedQuestionState(state: InstanceState): boolean {
  return UNRESOLVED_STATES.has(state);
}

interface BuildQuestionEventOptions {
  includeState?: boolean;
  answerDeadline?: Date | null;
}

export function buildQuestionEventPayload(
  instance: QuestionInstanceState,
  category: QuestionCategory,
  difficulty: Difficulty,
  options: BuildQuestionEventOptions = {}
): QuestionEvent {
  const payload: QuestionEvent = {
    instanceId: instance.id,
    questionId: instance.questionId,
    questionText: instance.questionText ?? 'Question in progress',
    category,
    difficulty,
    windowSize: instance.windowSize,
    triggeredAt: instance.triggeredAt.toISOString(),
    answerDeadline: (options.answerDeadline ?? new Date(instance.triggeredAt.getTime() + ANSWER_WINDOW_MS)).toISOString(),
    suggestedStatKeys: instance.suggestedStatKeys ?? [],
  };

  if (options.includeState) {
    payload.state = instance.state;
  }

  return payload;
}
