'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocketClient } from '@/lib/socket';
import { SERVER_EVENTS, type LobbyState, type SessionInfo } from '@/lib/types';
import { Button, Card, SectionLabel, ThemeToggle } from '@/components/ui';

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const lobbyCode = params.code as string;

  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('msp_user_id') : null;

  useEffect(() => {
    const socket = getSocketClient();
    socket.connect();

    const unsubscribers = [
      socket.on(SERVER_EVENTS.LOBBY_STATE, (state: LobbyState) => {
        setLobbyState(state);
        setIsLoading(false);

        if (state.status === 'active') {
          router.push(`/game/${state.code}`);
        }
      }),
      socket.on(SERVER_EVENTS.PLAYER_JOINED, (data: { userId: string; username: string }) => {
        setLobbyState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: [...prev.players, { id: data.userId, username: data.username, isHost: false, connected: true }],
          };
        });
      }),
      socket.on(SERVER_EVENTS.PLAYER_LEFT, (data: { userId: string }) => {
        setLobbyState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.filter((player) => player.id !== data.userId),
          };
        });
      }),
      socket.on(SERVER_EVENTS.PLAYER_DISCONNECTED, (data: { userId: string }) => {
        setLobbyState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map((player) =>
              player.id === data.userId ? { ...player, connected: false } : player
            ),
          };
        });
      }),
      socket.on(SERVER_EVENTS.SESSION_STARTED, () => {
        router.push(`/game/${lobbyCode}`);
      }),
      socket.on(SERVER_EVENTS.SESSIONS_LIST, (sessionList: SessionInfo[]) => {
        setSessions(sessionList);
        if (sessionList.length > 0 && !selectedSession) {
          setSelectedSession(String(sessionList[0].session_key));
        }
      }),
      socket.on(SERVER_EVENTS.ERROR, ({ message }: { message: string }) => {
        setError(message);
        setIsStarting(false);
      }),
    ];

    socket.getSessions(selectedYear);

    const userId = localStorage.getItem('msp_user_id');
    if (userId) {
      socket.reconnectLobby(userId);
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [lobbyCode, router, selectedSession, selectedYear]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(lobbyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [lobbyCode]);

  const handleStartGame = useCallback(() => {
    if (!lobbyState || !selectedSession) {
      setError('Please select a session');
      return;
    }

    if (lobbyState.players.length < 1) {
      setError('Need at least 1 player to start');
      return;
    }

    setIsStarting(true);
    getSocketClient().startSession(lobbyState.id, selectedSession);
  }, [lobbyState, selectedSession]);

  const isHost = lobbyState?.hostId === currentUserId;

  const years = useMemo(() => [2026, 2025, 2024, 2023], []);

  if (isLoading) {
    return (
      <main className="app-shell flex items-center justify-center">
        <p className="font-display text-2xl uppercase tracking-[0.14em]">Loading Lobby…</p>
      </main>
    );
  }

  if (!lobbyState) {
    return (
      <main className="app-shell flex items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center" tone="default">
          <p className="font-display text-4xl uppercase">Lobby Not Found</p>
          <Button onClick={() => router.push('/')} className="mt-6 w-full">
            Back to Home
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="app-shell swiss-noise relative">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 grid gap-4 border-2 border-[var(--color-border)] bg-[var(--color-muted)] p-5 md:grid-cols-[1fr_auto] md:items-start md:p-6">
          <div>
            <SectionLabel index="03" label="Lobby Control" />
            <h1 className="mt-2 font-display text-5xl uppercase tracking-tight md:text-7xl">{lobbyCode}</h1>
            <p className="mt-2 font-body text-sm text-[var(--color-muted-fg)]">
              Host controls race session. Players receive synchronized state updates on reconnect.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <ThemeToggle />
            <Button variant="secondary" onClick={handleCopyCode}>
              {copied ? 'Code Copied' : 'Copy Code'}
            </Button>
            <Button variant="ghost" onClick={() => router.push('/')}>
              Leave Lobby
            </Button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-5" tone="default">
            <SectionLabel index="03A" label="Players" className="mb-4" />
            <div className="space-y-2">
              {lobbyState.players.map((player) => (
                <div
                  key={player.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-2 border-[var(--color-border)] p-3"
                >
                  <div
                    className="h-3 w-3 border-2 border-[var(--color-border)]"
                    style={{
                      backgroundColor: player.connected ? 'var(--color-accent)' : 'transparent',
                    }}
                  />
                  <p className="font-display text-lg uppercase">
                    {player.username}
                    {player.isHost ? ' · HOST' : ''}
                    {player.id === currentUserId ? ' · YOU' : ''}
                  </p>
                  <p className="font-display text-xs uppercase tracking-[0.15em] text-[var(--color-muted-fg)]">
                    {player.connected ? 'Online' : 'Offline'}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="swiss-grid-pattern lg:col-span-7" tone="muted">
            {isHost ? (
              <>
                <SectionLabel index="03B" label="Session Setup" className="mb-4" />
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">
                      Season Year
                    </span>
                    <select
                      value={selectedYear}
                      onChange={(event) => {
                        setSelectedYear(Number(event.target.value));
                        setSelectedSession('');
                      }}
                      className="h-12 w-full border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-4 font-display text-sm uppercase focus-visible:border-[var(--color-accent)] focus-visible:outline-none"
                    >
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">
                      Race Session
                    </span>
                    <select
                      value={selectedSession}
                      onChange={(event) => setSelectedSession(event.target.value)}
                      className="h-12 w-full border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-4 font-display text-sm uppercase focus-visible:border-[var(--color-accent)] focus-visible:outline-none"
                    >
                      <option value="">Select Session...</option>
                      {sessions.map((session) => (
                        <option key={session.session_key} value={session.session_key}>
                          {session.session_name} - {session.location} ({session.year})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {sessions.length === 0 && (
                  <p className="mt-4 border-2 border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-display text-xs uppercase tracking-[0.14em] text-[var(--color-muted-fg)]">
                    No active sessions detected. Waiting for race feed.
                  </p>
                )}

                <Button
                  onClick={handleStartGame}
                  disabled={isStarting || !selectedSession}
                  size="lg"
                  className="mt-6 w-full"
                >
                  {isStarting ? 'Starting Session...' : 'Start Race Session'}
                </Button>
              </>
            ) : (
              <>
                <SectionLabel index="03B" label="Standby" className="mb-4" />
                <div className="swiss-dots border-2 border-[var(--color-border)] bg-[var(--color-bg)] p-8 text-center">
                  <p className="font-display text-3xl uppercase">Waiting for Host</p>
                  <p className="mt-2 font-body text-sm text-[var(--color-muted-fg)]">
                    Session configuration is controlled by the host.
                  </p>
                </div>
              </>
            )}

            {error && (
              <p className="mt-4 border-2 border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent),transparent_88%)] p-3 font-display text-xs uppercase tracking-[0.14em]">
                {error}
              </p>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}
