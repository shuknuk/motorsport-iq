'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QuestionCard from '@/components/QuestionCard';
import CountdownTimer from '@/components/CountdownTimer';
import Leaderboard from '@/components/Leaderboard';
import { getSocketClient } from '@/lib/socket';
import {
  SERVER_EVENTS,
  type LeaderboardEntry,
  type LobbyState,
  type QuestionEvent,
  type RaceSnapshotEvent,
  type ResolutionEvent,
} from '@/lib/types';
import { Button, Card, SectionLabel, ThemeToggle } from '@/components/ui';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const lobbyCode = params.code as string;

  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionEvent | null>(null);
  const [questionState, setQuestionState] = useState<string | null>(null);
  const [answer, setAnswer] = useState<'YES' | 'NO' | null>(null);
  const [resolution, setResolution] = useState<ResolutionEvent | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [raceSnapshot, setRaceSnapshot] = useState<RaceSnapshotEvent | null>(null);
  const [feedStalled, setFeedStalled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('msp_user_id') : null;

  useEffect(() => {
    const socket = getSocketClient();
    socket.connect();

    const unsubscribers = [
      socket.on(SERVER_EVENTS.LOBBY_STATE, (state: LobbyState) => {
        setLobbyState(state);
        setLeaderboard(state.leaderboard);
      }),
      socket.on(SERVER_EVENTS.QUESTION_EVENT, (event: QuestionEvent) => {
        setCurrentQuestion(event);
        setQuestionState('LIVE');
        setAnswer(null);
        setResolution(null);
      }),
      socket.on(
        SERVER_EVENTS.QUESTION_STATE,
        (data: { instanceId: string; state: string; cancelledReason?: string }) => {
          setQuestionState(data.state);
          if (data.state === 'CANCELLED') {
            setCurrentQuestion(null);
          }
        }
      ),
      socket.on(SERVER_EVENTS.QUESTION_LOCKED, () => {
        setQuestionState('LOCKED');
      }),
      socket.on(SERVER_EVENTS.QUESTION_CANCELLED, (data: { instanceId: string; reason: string }) => {
        setCurrentQuestion(null);
        setResolution(null);
        setError(`Question cancelled: ${data.reason}`);
        setTimeout(() => setError(null), 5000);
      }),
      socket.on(SERVER_EVENTS.RESOLUTION_EVENT, (event: ResolutionEvent) => {
        setResolution(event);
        setQuestionState('RESOLVED');
        setCurrentQuestion(null);
      }),
      socket.on(SERVER_EVENTS.LEADERBOARD_UPDATE, (entries: LeaderboardEntry[]) => {
        setLeaderboard(entries);
      }),
      socket.on(SERVER_EVENTS.RACE_SNAPSHOT_UPDATE, (snapshot: RaceSnapshotEvent) => {
        setRaceSnapshot(snapshot);
      }),
      socket.on(SERVER_EVENTS.FEED_STATUS, ({ stalled }: { stalled: boolean }) => {
        setFeedStalled(stalled);
      }),
      socket.on(SERVER_EVENTS.ERROR, ({ message }: { message: string }) => {
        setError(message);
      }),
    ];

    const userId = localStorage.getItem('msp_user_id');
    if (userId) {
      socket.reconnectLobby(userId);
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const handleSubmitAnswer = useCallback(
    (selectedAnswer: 'YES' | 'NO') => {
      if (!currentQuestion || answer) return;

      getSocketClient().submitAnswer(currentQuestion.instanceId, selectedAnswer);
      setAnswer(selectedAnswer);
    },
    [answer, currentQuestion]
  );

  const getTrackStatusLabel = (status: string) => {
    switch (status) {
      case 'SC':
        return 'Safety Car';
      case 'VSC':
        return 'Virtual SC';
      case 'RED':
        return 'Red Flag';
      default:
        return 'Green Flag';
    }
  };

  if (!lobbyState) {
    return (
      <main className="app-shell flex items-center justify-center">
        <p className="font-display text-2xl uppercase tracking-[0.14em]">Connecting to Race…</p>
      </main>
    );
  }

  return (
    <main className="app-shell swiss-noise relative">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8">
        <header className="mb-6 grid gap-4 border-2 border-[var(--color-border)] bg-[var(--color-muted)] p-5 md:grid-cols-[1fr_auto] md:p-6">
          <div>
            <SectionLabel
              index="04"
              label={lobbyState.sessionMode === 'replay' ? 'Replay Session' : 'Live Session'}
            />
            <h1 className="mt-2 font-display text-4xl uppercase leading-none tracking-tight md:text-6xl">
              Lobby {lobbyCode}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {raceSnapshot && (
                <>
                  <span className="border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 font-display text-xs uppercase tracking-[0.15em]">
                    Lap {raceSnapshot.lapNumber}
                  </span>
                  <span className="border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 font-display text-xs uppercase tracking-[0.15em]">
                    {getTrackStatusLabel(raceSnapshot.trackStatus)}
                  </span>
                  <span className="border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 font-display text-xs uppercase tracking-[0.15em]">
                    Leader {raceSnapshot.leader}
                  </span>
                  {raceSnapshot.sessionMode === 'replay' && (
                    <span className="border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 font-display text-xs uppercase tracking-[0.15em]">
                      Replay {raceSnapshot.replaySpeed}x
                    </span>
                  )}
                  {raceSnapshot.isReplayComplete && (
                    <span className="border-2 border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent),transparent_88%)] px-3 py-1 font-display text-xs uppercase tracking-[0.15em]">
                      Replay Complete
                    </span>
                  )}
                </>
              )}
              {feedStalled && (
                <span className="border-2 border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent),transparent_88%)] px-3 py-1 font-display text-xs uppercase tracking-[0.15em]">
                  Feed Stalled
                </span>
              )}
            </div>
            <p className="mt-3 max-w-3xl font-body text-sm text-[var(--color-muted-fg)]">
              {lobbyState.sessionMode === 'replay'
                ? 'This session is running from OpenF1 historical telemetry at 10x speed. The server watches the replay for question-bank triggers, then Groq/Llama rewrites the prompt and explains each resolution.'
                : 'This session follows live telemetry. Questions appear only when the server-side trigger engine finds a valid race situation.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <ThemeToggle />
            <Button variant="ghost" onClick={() => router.push('/')}>
              Leave Session
            </Button>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div>
            {currentQuestion && questionState === 'LIVE' && (
              <Card tone="muted" className="swiss-grid-pattern p-6 md:p-8">
                <div className="mb-6 flex justify-center">
                  <CountdownTimer deadline={currentQuestion.answerDeadline} size="lg" />
                </div>
                <QuestionCard
                  questionText={currentQuestion.questionText}
                  category={currentQuestion.category}
                  difficulty={currentQuestion.difficulty}
                  instanceId={currentQuestion.instanceId}
                  onSubmit={handleSubmitAnswer}
                  answered={answer}
                />
              </Card>
            )}

            {currentQuestion && questionState === 'LOCKED' && (
              <Card tone="default" className="p-8 text-center">
                <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">Answers Locked</p>
                <p className="mt-4 font-display text-4xl uppercase leading-tight">{currentQuestion.questionText}</p>
                <p className="mt-3 font-body text-sm text-[var(--color-muted-fg)]">Awaiting lap completion and resolution.</p>
              </Card>
            )}

            {resolution && (
              <Card tone="default" className="p-6 md:p-8">
                <SectionLabel index="04A" label="Resolution" className="mb-4" />
                <h2 className="font-display text-4xl uppercase leading-tight md:text-5xl">{resolution.questionText}</h2>
                <p className="mt-3 font-display text-sm uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">
                  Correct Answer: <span className="text-[var(--color-accent)]">{resolution.correctAnswer}</span>
                </p>
                <div className="mt-5 border-2 border-[var(--color-border)] bg-[var(--color-muted)] p-4">
                  <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">Explanation</p>
                  <p className="mt-2 font-body text-sm leading-relaxed">{resolution.explanation}</p>
                </div>
              </Card>
            )}

            {!currentQuestion && !resolution && (
              <Card tone="default" className="swiss-dots p-10 text-center md:p-16">
                <p className="font-display text-4xl uppercase md:text-6xl">Waiting for Question</p>
                <p className="mt-3 font-body text-sm text-[var(--color-muted-fg)]">
                  {lobbyState.isReplayComplete
                    ? 'Replay finished. Final leaderboard is locked in.'
                    : lobbyState.sessionMode === 'replay'
                      ? 'Next trigger arrives from accelerated historical telemetry, not broadcast video.'
                      : 'Next trigger arrives from live race telemetry.'}
                </p>
                <p className="mt-4 font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">
                  Questions asked: {lobbyState.questionCount}/10
                </p>
              </Card>
            )}
          </div>

          <aside>
            <Leaderboard entries={leaderboard} currentUserId={currentUserId ?? undefined} />
          </aside>
        </section>
      </div>

      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 border-2 border-[var(--color-accent)] bg-[var(--color-bg)] px-6 py-3 font-display text-xs uppercase tracking-[0.14em] text-[var(--color-fg)]">
          {error}
        </div>
      )}
    </main>
  );
}
