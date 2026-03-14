'use client';

import { useEffect, useState } from 'react';
import { Button, Card, SectionLabel, ThemeToggle } from '@/components/ui';
import { getSocketClient } from '@/lib/socket';
import { SERVER_EVENTS, type RaceSnapshotEvent, type SessionInfo } from '@/lib/types';

type HealthStatus = {
  state: 'idle' | 'loading' | 'ok' | 'error';
  payload: Record<string, unknown> | null;
  error: string | null;
  updatedAt: string | null;
};

type SocketStatus = {
  connected: boolean;
  socketId: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

type EventSnapshot<T> = {
  payload: T | null;
  updatedAt: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Not yet';

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function StatusBadge({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'error' | 'muted' }) {
  const toneClass =
    tone === 'ok'
      ? 'border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent),transparent_88%)]'
      : tone === 'warn'
        ? 'border-[var(--color-border)] bg-[var(--color-muted)]'
        : tone === 'error'
          ? 'border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent),transparent_92%)] text-[var(--color-accent)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg)]';

  return (
    <span className={`border-2 px-3 py-1 font-display text-xs uppercase tracking-[0.18em] ${toneClass}`}>
      {label}
    </span>
  );
}

export default function DebugPage() {
  const socket = getSocketClient();
  const backendUrl = socket.getResolvedUrl();

  const [health, setHealth] = useState<HealthStatus>({
    state: 'idle',
    payload: null,
    error: null,
    updatedAt: null,
  });
  const [socketStatus, setSocketStatus] = useState<SocketStatus>({
    connected: socket.isConnected(),
    socketId: socket.getSocketId() ?? null,
    lastError: socket.getLastError()?.message ?? null,
    updatedAt: null,
  });
  const [sessions, setSessions] = useState<EventSnapshot<SessionInfo[]>>({
    payload: null,
    updatedAt: null,
  });
  const [feedStatus, setFeedStatus] = useState<EventSnapshot<{ stalled: boolean }>>({
    payload: null,
    updatedAt: null,
  });
  const [snapshot, setSnapshot] = useState<EventSnapshot<RaceSnapshotEvent>>({
    payload: null,
    updatedAt: null,
  });
  const [appError, setAppError] = useState<EventSnapshot<{ message: string }>>({
    payload: socket.getLastError(),
    updatedAt: socket.getLastError() ? nowIso() : null,
  });

  useEffect(() => {
    let active = true;

    const runHealthCheck = async () => {
      setHealth((current) => ({ ...current, state: 'loading', error: null }));

      try {
        const response = await fetch(`${backendUrl}/health`, { cache: 'no-store' });
        const payload = (await response.json()) as Record<string, unknown>;

        if (!active) return;

        setHealth({
          state: response.ok ? 'ok' : 'error',
          payload,
          error: response.ok ? null : `HTTP ${response.status}`,
          updatedAt: nowIso(),
        });
      } catch (error) {
        if (!active) return;

        setHealth({
          state: 'error',
          payload: null,
          error: (error as Error).message,
          updatedAt: nowIso(),
        });
      }
    };

    socket.connect();
    runHealthCheck();
    socket.getSessions(new Date().getFullYear());

    const unsubscribers = [
      socket.on('connected', () => {
        setSocketStatus({
          connected: true,
          socketId: socket.getSocketId() ?? null,
          lastError: null,
          updatedAt: nowIso(),
        });
      }),
      socket.on('disconnected', () => {
        setSocketStatus((current) => ({
          ...current,
          connected: false,
          socketId: null,
          updatedAt: nowIso(),
        }));
      }),
      socket.on(SERVER_EVENTS.SESSIONS_LIST, (payload: SessionInfo[]) => {
        setSessions({ payload, updatedAt: nowIso() });
      }),
      socket.on(SERVER_EVENTS.FEED_STATUS, (payload: { stalled: boolean }) => {
        setFeedStatus({ payload, updatedAt: nowIso() });
      }),
      socket.on(SERVER_EVENTS.RACE_SNAPSHOT_UPDATE, (payload: RaceSnapshotEvent) => {
        setSnapshot({ payload, updatedAt: nowIso() });
      }),
      socket.on(SERVER_EVENTS.ERROR, (payload: { message: string }) => {
        setAppError({ payload, updatedAt: nowIso() });
        setSocketStatus({
          connected: socket.isConnected(),
          socketId: socket.getSocketId() ?? null,
          lastError: payload.message,
          updatedAt: nowIso(),
        });
      }),
    ];

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [backendUrl, socket]);

  const handleRefresh = async () => {
    setHealth((current) => ({ ...current, state: 'loading', error: null }));

    try {
      const response = await fetch(`${backendUrl}/health`, { cache: 'no-store' });
      const payload = (await response.json()) as Record<string, unknown>;

      setHealth({
        state: response.ok ? 'ok' : 'error',
        payload,
        error: response.ok ? null : `HTTP ${response.status}`,
        updatedAt: nowIso(),
      });
    } catch (error) {
      setHealth({
        state: 'error',
        payload: null,
        error: (error as Error).message,
        updatedAt: nowIso(),
      });
    }

    socket.connect();
    socket.getSessions(new Date().getFullYear());
    setSocketStatus({
      connected: socket.isConnected(),
      socketId: socket.getSocketId() ?? null,
      lastError: socket.getLastError()?.message ?? null,
      updatedAt: nowIso(),
    });
  };

  return (
    <main className="app-shell swiss-noise relative">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 lg:py-10">
        <header className="border-2 border-[var(--color-border)] bg-[var(--color-muted)] p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SectionLabel index="03" label="System Debug" />
              <h1 className="mt-2 font-display text-4xl uppercase leading-none tracking-tight md:text-6xl">
                Diagnostics
              </h1>
              <p className="mt-4 max-w-3xl border-l-4 border-[var(--color-accent)] pl-4 font-body text-sm text-[var(--color-muted-fg)] md:text-base">
                Live visibility into the Railway backend, socket connection, and safe realtime signals.
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <StatusBadge label={health.state === 'ok' ? 'Backend Healthy' : health.state === 'loading' ? 'Health Checking' : 'Backend Check Failed'} tone={health.state === 'ok' ? 'ok' : health.state === 'loading' ? 'warn' : 'error'} />
            <StatusBadge label={socketStatus.connected ? 'Socket Connected' : 'Socket Disconnected'} tone={socketStatus.connected ? 'ok' : 'warn'} />
            <Button onClick={handleRefresh}>Refresh Checks</Button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card tone="default" className="p-6">
            <SectionLabel index="04" label="Backend Health" className="mb-4" />
            <div className="space-y-4">
              <div>
                <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Backend URL</p>
                <p className="mt-2 break-all font-body text-sm">{backendUrl}</p>
              </div>
              <div>
                <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Last Updated</p>
                <p className="mt-2 font-body text-sm">{formatTimestamp(health.updatedAt)}</p>
              </div>
              <div>
                <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Result</p>
                <pre className="mt-2 overflow-x-auto border-2 border-[var(--color-border)] bg-[var(--color-bg)] p-4 font-mono text-xs leading-6 whitespace-pre-wrap">
                  {health.error
                    ? `Error: ${health.error}`
                    : JSON.stringify(health.payload ?? { status: 'pending' }, null, 2)}
                </pre>
              </div>
            </div>
          </Card>

          <Card tone="default" className="p-6">
            <SectionLabel index="05" label="Socket Transport" className="mb-4" />
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Connection</p>
                  <p className="mt-2 font-body text-sm">{socketStatus.connected ? 'Connected' : 'Disconnected'}</p>
                </div>
                <div>
                  <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Socket ID</p>
                  <p className="mt-2 break-all font-body text-sm">{socketStatus.socketId ?? 'Unavailable'}</p>
                </div>
              </div>
              <div>
                <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Latest Error</p>
                <p className="mt-2 font-body text-sm">{socketStatus.lastError ?? appError.payload?.message ?? 'None'}</p>
              </div>
              <div>
                <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Last Updated</p>
                <p className="mt-2 font-body text-sm">{formatTimestamp(socketStatus.updatedAt)}</p>
              </div>
            </div>
          </Card>

          <Card tone="default" className="p-6">
            <SectionLabel index="06" label="Session Probe" className="mb-4" />
            <div className="space-y-4">
              <div>
                <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Last Updated</p>
                <p className="mt-2 font-body text-sm">{formatTimestamp(sessions.updatedAt)}</p>
              </div>
              <div>
                <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Latest Sessions</p>
                <pre className="mt-2 overflow-x-auto border-2 border-[var(--color-border)] bg-[var(--color-bg)] p-4 font-mono text-xs leading-6 whitespace-pre-wrap">
                  {JSON.stringify(
                    (sessions.payload ?? []).slice(0, 3).map((session) => ({
                      session_name: session.session_name,
                      year: session.year,
                      location: session.location,
                      mode: session.mode,
                      isCompleted: session.isCompleted,
                    })),
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          </Card>

          <Card tone="default" className="p-6">
            <SectionLabel index="07" label="Realtime Signals" className="mb-4" />
            <div className="space-y-4">
              <div>
                <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Feed Status</p>
                <p className="mt-2 font-body text-sm">
                  {feedStatus.payload ? (feedStatus.payload.stalled ? 'Stalled' : 'Healthy') : 'Awaiting event'}
                </p>
                <p className="mt-1 font-body text-xs text-[var(--color-muted-fg)]">
                  Updated {formatTimestamp(feedStatus.updatedAt)}
                </p>
              </div>
              <div>
                <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">Race Snapshot</p>
                <pre className="mt-2 overflow-x-auto border-2 border-[var(--color-border)] bg-[var(--color-bg)] p-4 font-mono text-xs leading-6 whitespace-pre-wrap">
                  {JSON.stringify(
                    snapshot.payload
                      ? {
                          lapNumber: snapshot.payload.lapNumber,
                          trackStatus: snapshot.payload.trackStatus,
                          sessionMode: snapshot.payload.sessionMode,
                          replaySpeed: snapshot.payload.replaySpeed,
                          isReplayComplete: snapshot.payload.isReplayComplete,
                          leader: snapshot.payload.leader,
                          topThree: snapshot.payload.topThree,
                        }
                      : { status: 'Awaiting event' },
                    null,
                    2
                  )}
                </pre>
                <p className="mt-1 font-body text-xs text-[var(--color-muted-fg)]">
                  Updated {formatTimestamp(snapshot.updatedAt)}
                </p>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
