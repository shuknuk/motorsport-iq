import { SessionRuntimeManager, toSessionInfo } from './sessionRuntimeManager';
import type { OpenF1Session } from '../types';

function createSession(overrides: Partial<OpenF1Session> = {}): OpenF1Session {
  return {
    session_key: 1001,
    meeting_key: 2001,
    location: 'Monza',
    session_type: 'Race',
    session_name: 'Race',
    date_start: '2025-09-01T13:00:00Z',
    date_end: '2025-09-01T15:00:00Z',
    country_key: 1,
    country_code: 'ITA',
    country_name: 'Italy',
    circuit_key: 1,
    circuit_short_name: 'Monza',
    year: 2025,
    ...overrides,
  };
}

describe('SessionRuntimeManager', () => {
  const fetchMock = jest.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const pathname = new URL(url).pathname;

    let payload: unknown = [];
    if (pathname.endsWith('/drivers')) {
      payload = [
        {
          driver_number: 1,
          broadcast_name: 'VER',
          full_name: 'Max Verstappen',
          name_acronym: 'VER',
          team_name: 'Red Bull',
          team_colour: '3671C6',
          first_name: 'Max',
          last_name: 'Verstappen',
          headshot_url: '',
          country_code: 'NLD',
          session_key: 1,
          meeting_key: 1,
        },
      ];
    }

    return {
      ok: true,
      status: 200,
      json: async () => payload,
    } as Response;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock as typeof fetch);
    fetchMock.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('classifies completed sessions as replay and future sessions as live', () => {
    const manager = new SessionRuntimeManager({
      onSnapshotUpdate: jest.fn(),
      onLapComplete: jest.fn(),
      onFeedStall: jest.fn(),
      onReplayComplete: jest.fn(),
      onError: jest.fn(),
    });

    expect(
      manager.getSessionMode(createSession({ date_end: '2024-09-01T15:00:00Z' }))
    ).toBe('replay');
    expect(
      manager.getSessionMode(createSession({ date_end: '2099-09-01T15:00:00Z', session_key: 1002 }))
    ).toBe('live');
  });

  it('reuses a runtime for the same session and isolates different sessions', async () => {
    const manager = new SessionRuntimeManager({
      onSnapshotUpdate: jest.fn(),
      onLapComplete: jest.fn(),
      onFeedStall: jest.fn(),
      onReplayComplete: jest.fn(),
      onError: jest.fn(),
    });

    const replaySession = createSession({ date_end: '2024-09-01T15:00:00Z', session_key: 3001 });
    const replayRuntimeA = await manager.attachLobbyToSession('lobby-a', replaySession);
    const replayRuntimeB = await manager.attachLobbyToSession('lobby-b', replaySession);
    const liveRuntime = await manager.attachLobbyToSession(
      'lobby-c',
      createSession({
        date_end: '2099-09-01T15:00:00Z',
        session_key: 3002,
      })
    );

    expect(replayRuntimeA).toBe(replayRuntimeB);
    expect(replayRuntimeA).not.toBe(liveRuntime);
    expect(replayRuntimeA.mode).toBe('replay');
    expect(liveRuntime.mode).toBe('live');

    replayRuntimeA.stop();
    liveRuntime.stop();
  });

  it('adds derived session info for the picker', () => {
    const info = toSessionInfo(createSession({ date_end: '2024-09-01T15:00:00Z' }));
    expect(info.isCompleted).toBe(true);
    expect(info.mode).toBe('replay');
  });
});
