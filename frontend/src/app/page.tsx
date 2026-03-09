'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SERVER_EVENTS, type LobbyState } from '@/lib/types';
import { getSocketClient } from '@/lib/socket';
import { Button, Card, Input, SectionLabel, ThemeToggle } from '@/components/ui';

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('msp_username') ?? '';
  });
  const [lobbyCode, setLobbyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const socket = getSocketClient();
    socket.connect();

    const unsubscribers = [
      socket.on(SERVER_EVENTS.LOBBY_STATE, (state: LobbyState) => {
        setIsLoading(false);
        localStorage.setItem('msp_username', username);

        const userId = state.players.find((player) => player.username === username)?.id;
        if (userId) {
          localStorage.setItem('msp_user_id', userId);
        }

        if (state.status === 'waiting') {
          router.push(`/lobby/${state.code}`);
          return;
        }

        router.push(`/game/${state.code}`);
      }),
      socket.on(SERVER_EVENTS.ERROR, ({ message }: { message: string }) => {
        setError(message);
        setIsLoading(false);
        setIsJoining(false);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [router, username]);

  const handleCreateLobby = () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setError(null);
    setIsLoading(true);
    getSocketClient().createLobby(username.trim());
  };

  const handleJoinLobby = () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (!lobbyCode.trim()) {
      setError('Please enter a lobby code');
      return;
    }

    if (lobbyCode.trim().length !== 6) {
      setError('Lobby code must be 6 characters');
      return;
    }

    setError(null);
    setIsLoading(true);
    setIsJoining(true);
    getSocketClient().joinLobby(lobbyCode.trim().toUpperCase(), username.trim());
  };

  return (
    <main className="app-shell swiss-noise relative">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:px-8 lg:grid-cols-12 lg:gap-8 lg:py-10">
        <section className="swiss-grid-pattern border-2 border-[var(--color-border)] bg-[var(--color-muted)] px-5 py-8 md:px-8 md:py-10 lg:col-span-7 lg:px-10 lg:py-12">
          <div className="mb-8 flex items-start justify-between gap-4">
            <SectionLabel index="01" label="Race Interface" />
            <ThemeToggle />
          </div>
          <h1 className="font-display text-6xl uppercase leading-[0.9] tracking-tight text-[var(--color-fg)] md:text-8xl lg:text-[9rem]">
            Motorsport
            <span className="ml-2 text-[var(--color-accent)]">IQ</span>
          </h1>
          <p className="mt-4 max-w-xl border-l-4 border-[var(--color-accent)] pl-4 font-body text-sm text-[var(--color-muted-fg)] md:text-base">
            Real-time Formula 1 prediction rounds. 20 seconds per question. Server-authoritative scoring. No guesswork in the state model.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Round Window', value: '20s' },
              { label: 'Resolution', value: 'Lap End' },
              { label: 'Feed', value: 'OpenF1' },
              { label: 'Transport', value: 'Socket.io' },
            ].map((item) => (
              <Card key={item.label} className="p-4" tone="default">
                <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">{item.label}</p>
                <p className="mt-2 font-display text-3xl uppercase leading-none md:text-4xl">{item.value}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5">
          <Card tone="default" className="h-full p-6 md:p-8">
            <SectionLabel index="02" label="Lobby Access" className="mb-6" />

            <div className="space-y-4">
              <Input
                id="username"
                label="Driver Name"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your name"
                maxLength={20}
              />
              <Button onClick={handleCreateLobby} disabled={isLoading && !isJoining} className="w-full">
                {isLoading && !isJoining ? 'Creating Lobby...' : 'Create Lobby'}
              </Button>
            </div>

            <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="h-[2px] bg-[var(--color-border)]" />
              <span className="font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">OR</span>
              <div className="h-[2px] bg-[var(--color-border)]" />
            </div>

            <div className="space-y-4">
              <Input
                id="lobbyCode"
                label="Lobby Code"
                value={lobbyCode}
                onChange={(event) => setLobbyCode(event.target.value.toUpperCase())}
                placeholder="6-character code"
                maxLength={6}
                className="text-center font-display text-2xl tracking-[0.28em]"
              />
              <Button
                variant="secondary"
                onClick={handleJoinLobby}
                disabled={isLoading && isJoining}
                className="w-full"
              >
                {isLoading && isJoining ? 'Joining Lobby...' : 'Join Lobby'}
              </Button>
            </div>

            {error && (
              <p className="mt-5 border-2 border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent),transparent_88%)] p-3 text-sm uppercase tracking-[0.12em] text-[var(--color-fg)]">
                {error}
              </p>
            )}

            <p className="mt-8 border-t-2 border-[var(--color-border)] pt-4 font-display text-xs uppercase tracking-[0.22em] text-[var(--color-muted-fg)]">
              Powered by OpenF1 telemetry stream
            </p>
          </Card>
        </section>
      </div>
    </main>
  );
}
