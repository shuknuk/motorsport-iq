const fromMock = jest.fn();

jest.mock('../db/supabaseClient', () => ({
  __esModule: true,
  default: {
    from: fromMock,
  },
}));

import { getUserLobby, getUserLobbyFromDatabase } from './lobbyManager';

function createQueryMock(result: unknown): { select: jest.Mock } {
  const single = jest.fn(async () => result);
  const eq = jest.fn(() => ({ single }));
  const select = jest.fn(() => ({ eq }));
  return { select };
}

describe('lobbyManager reconnect fallback', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('falls back to Supabase and rehydrates user->lobby mapping', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'users') {
        return createQueryMock({ data: { lobby_id: 'lobby-42' }, error: null });
      }

      if (table === 'lobbies') {
        return createQueryMock({ data: { id: 'lobby-42' }, error: null });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const lobbyId = await getUserLobbyFromDatabase('user-42');
    expect(lobbyId).toBe('lobby-42');
    expect(getUserLobby('user-42')).toBe('lobby-42');
  });

  it('returns null when user no longer exists in Supabase', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'users') {
        return createQueryMock({ data: null, error: { message: 'not found' } });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const lobbyId = await getUserLobbyFromDatabase('missing-user');
    expect(lobbyId).toBeNull();
    expect(getUserLobby('missing-user')).toBeNull();
  });
});
