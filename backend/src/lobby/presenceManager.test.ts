import { PresenceManager } from './presenceManager';

describe('PresenceManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('expires connected users after inactivity timeout', async () => {
    const onExpire = jest.fn();
    const manager = new PresenceManager({
      inactivityTimeoutMs: 5_000,
      disconnectGraceMs: 1_000,
      sweepIntervalMs: 1_000,
      onExpire,
    });

    manager.upsertConnection({ userId: 'user-1', lobbyId: 'lobby-1', socketId: 'socket-1' });

    await jest.advanceTimersByTimeAsync(5_000);

    expect(onExpire).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        lobbyId: 'lobby-1',
        socketId: 'socket-1',
        connected: true,
      }),
      'inactive'
    );

    manager.stop();
  });

  it('does not expire reconnected users within the disconnect grace period', async () => {
    const onExpire = jest.fn();
    const manager = new PresenceManager({
      inactivityTimeoutMs: 60_000,
      disconnectGraceMs: 5_000,
      sweepIntervalMs: 1_000,
      onExpire,
    });

    manager.upsertConnection({ userId: 'user-1', lobbyId: 'lobby-1', socketId: 'socket-1' });
    manager.markDisconnectedBySocket('socket-1');
    await jest.advanceTimersByTimeAsync(2_000);
    manager.upsertConnection({ userId: 'user-1', lobbyId: 'lobby-1', socketId: 'socket-2' });
    await jest.advanceTimersByTimeAsync(5_000);

    expect(onExpire).not.toHaveBeenCalled();

    manager.stop();
  });

  it('expires disconnected users after the grace period', async () => {
    const onExpire = jest.fn();
    const manager = new PresenceManager({
      inactivityTimeoutMs: 60_000,
      disconnectGraceMs: 5_000,
      sweepIntervalMs: 1_000,
      onExpire,
    });

    manager.upsertConnection({ userId: 'user-1', lobbyId: 'lobby-1', socketId: 'socket-1' });
    manager.markDisconnectedBySocket('socket-1');

    await jest.advanceTimersByTimeAsync(5_000);

    expect(onExpire).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        lobbyId: 'lobby-1',
        socketId: null,
        connected: false,
      }),
      'disconnected_timeout'
    );

    manager.stop();
  });
});
