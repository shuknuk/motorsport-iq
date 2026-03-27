import type { QuestionInstanceState, RaceSnapshot } from '../types';
import { buildQuestionEventPayload, isUnresolvedQuestionState } from './questionPayload';

function createSnapshot(): RaceSnapshot {
  return {
    sessionId: 'session-1',
    lapNumber: 10,
    totalLaps: 58,
    trackStatus: 'GREEN',
    sessionMode: 'replay',
    replaySpeed: 10,
    isReplayComplete: false,
    drivers: [],
    timestamp: new Date('2025-01-01T00:00:00.000Z'),
    dataFeedStalled: false,
    leaderLapTime: 89.2,
    leaderLapStartTime: '2024-12-31T23:58:31.000Z',
  };
}

function createInstance(state: QuestionInstanceState['state']): QuestionInstanceState {
  return {
    id: 'instance-1',
    lobbyId: 'lobby-1',
    questionId: 'q1',
    state,
    triggeredAt: new Date('2025-01-01T00:00:00.000Z'),
    triggerSnapshot: createSnapshot(),
    windowSize: 2,
    targetLap: 12,
    answer: null,
    outcome: null,
    questionText: 'Will the leader pit this lap?',
    suggestedStatKeys: ['TRACK_STATUS'],
  };
}

describe('questionPayload', () => {
  it('marks LIVE, LOCKED, and ACTIVE as unresolved question states', () => {
    expect(isUnresolvedQuestionState('LIVE')).toBe(true);
    expect(isUnresolvedQuestionState('LOCKED')).toBe(true);
    expect(isUnresolvedQuestionState('ACTIVE')).toBe(true);
    expect(isUnresolvedQuestionState('RESOLVED')).toBe(false);
    expect(isUnresolvedQuestionState('CANCELLED')).toBe(false);
  });

  it('builds reconnect payloads with the current state when requested', () => {
    const payload = buildQuestionEventPayload(
      createInstance('ACTIVE'),
      'GAP_CLOSING',
      'MEDIUM',
      { includeState: true }
    );

    expect(payload.state).toBe('ACTIVE');
    expect(payload.questionText).toBe('Will the leader pit this lap?');
    expect(payload.suggestedStatKeys).toEqual(['TRACK_STATUS']);
  });

  it('uses the provided live answer deadline when present', () => {
    const answerDeadline = new Date('2025-01-01T00:00:25.000Z');
    const payload = buildQuestionEventPayload(
      createInstance('LIVE'),
      'GAP_CLOSING',
      'MEDIUM',
      { includeState: true, answerDeadline }
    );

    expect(payload.answerDeadline).toBe(answerDeadline.toISOString());
  });
});
