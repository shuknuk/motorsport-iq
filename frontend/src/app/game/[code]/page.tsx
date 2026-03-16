'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QuestionCard from '@/components/QuestionCard';
import CountdownTimer from '@/components/CountdownTimer';
import Leaderboard from '@/components/Leaderboard';
import { getSocketClient } from '@/lib/socket';
import { apiFetch } from '@/lib/api';
import {
  SERVER_EVENTS,
  type CreateProblemReportInput,
  type LeaderboardEntry,
  type LobbyState,
  type ProblemReportReason,
  type QuestionEvent,
  type RaceSnapshotEvent,
  type ResolutionEvent,
} from '@/lib/types';
import { Button, Card, SectionLabel, ThemeToggle } from '@/components/ui';

const REPORT_REASON_OPTIONS: Array<{ value: ProblemReportReason; label: string }> = [
  { value: 'WRONG_ANSWER', label: 'Wrong Answer' },
  { value: 'BAD_EXPLANATION', label: 'Bad Explanation' },
  { value: 'UNCLEAR_QUESTION', label: 'Unclear Question' },
  { value: 'TELEMETRY_MISMATCH', label: 'Telemetry Mismatch' },
  { value: 'OTHER', label: 'Other' },
];

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
  const [reportReason, setReportReason] = useState<ProblemReportReason>('WRONG_ANSWER');
  const [reportNote, setReportNote] = useState('');
  const [isReportFormOpen, setIsReportFormOpen] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('msp_user_id') : null;

  useEffect(() => {
    const socket = getSocketClient();
    socket.connect();

    const unsubscribers = [
      socket.on(SERVER_EVENTS.LOBBY_STATE, (state: LobbyState) => {
        setLobbyState(state);
        setLeaderboard(state.leaderboard);
        if (state.latestResolution && !state.currentQuestion) {
          setResolution(state.latestResolution);
          setQuestionState('RESOLVED');
        }
      }),
      socket.on(SERVER_EVENTS.QUESTION_EVENT, (event: QuestionEvent) => {
        setCurrentQuestion(event);
        setQuestionState('LIVE');
        setAnswer(null);
        setResolution(null);
        setIsReportFormOpen(false);
        setIsSubmittingReport(false);
        setReportSuccess(false);
        setReportError(null);
        setReportNote('');
        setReportReason('WRONG_ANSWER');
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
        setIsReportFormOpen(false);
        setIsSubmittingReport(false);
        setReportSuccess(false);
        setReportError(null);
        setReportNote('');
        setReportReason('WRONG_ANSWER');
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
      socket.on(SERVER_EVENTS.PRESENCE_EXPIRED, () => {
        localStorage.removeItem('msp_user_id');
        router.push('/');
      }),
    ];

    const userId = localStorage.getItem('msp_user_id');
    if (userId) {
      socket.reconnectLobby(userId);
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [router]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const socket = getSocketClient();
    socket.sendPresencePing();
    const interval = window.setInterval(() => {
      socket.sendPresencePing();
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [currentUserId]);

  const handleSubmitAnswer = useCallback(
    (selectedAnswer: 'YES' | 'NO') => {
      if (!currentQuestion || answer) return;

      getSocketClient().submitAnswer(currentQuestion.instanceId, selectedAnswer);
      setAnswer(selectedAnswer);
    },
    [answer, currentQuestion]
  );

  const handleSubmitReport = useCallback(async () => {
    if (!resolution || !currentUserId || isSubmittingReport) {
      return;
    }

    setIsSubmittingReport(true);
    setReportError(null);

    try {
      const payload: CreateProblemReportInput = {
        instanceId: resolution.instanceId,
        userId: currentUserId,
        reason: reportReason,
        note: reportNote,
      };

      const response = await apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? 'Failed to submit report');
      }

      setReportSuccess(true);
      setIsReportFormOpen(false);
      setReportNote('');
    } catch (submissionError) {
      setReportError((submissionError as Error).message);
    } finally {
      setIsSubmittingReport(false);
    }
  }, [currentUserId, isSubmittingReport, reportNote, reportReason, resolution]);

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

  const handleLeaveSession = useCallback(() => {
    localStorage.removeItem('msp_user_id');
    getSocketClient().leaveLobby();
    router.push('/');
  }, [router]);

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
            <Button variant="ghost" onClick={handleLeaveSession}>
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
                <div className="mt-5 border-2 border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">Problem Reporting</p>
                      <p className="mt-2 font-body text-sm text-[var(--color-muted-fg)]">
                        If the AI resolved this question incorrectly, send it to the admin review queue.
                      </p>
                    </div>
                    <Button
                      variant={reportSuccess ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={reportSuccess}
                      onClick={() => setIsReportFormOpen((current) => !current)}
                    >
                      {reportSuccess ? 'Reported' : isReportFormOpen ? 'Close Report' : 'Report a Problem'}
                    </Button>
                  </div>

                  {isReportFormOpen && !reportSuccess && (
                    <div className="mt-4 grid gap-4 border-t-2 border-[var(--color-border)] pt-4">
                      <label className="block">
                        <span className="mb-2 block font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">
                          Reason
                        </span>
                        <select
                          value={reportReason}
                          onChange={(event) => setReportReason(event.target.value as ProblemReportReason)}
                          className="h-12 w-full border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-4 font-display text-sm uppercase focus-visible:border-[var(--color-accent)] focus-visible:outline-none"
                        >
                          {REPORT_REASON_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block font-display text-xs uppercase tracking-[0.2em] text-[var(--color-muted-fg)]">
                          Optional Note
                        </span>
                        <textarea
                          value={reportNote}
                          onChange={(event) => setReportNote(event.target.value)}
                          rows={4}
                          placeholder="Add the telemetry detail or answer mismatch you think is wrong."
                          className="w-full border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 font-body text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted-fg)] focus-visible:border-[var(--color-accent)] focus-visible:outline-none"
                        />
                      </label>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-body text-xs text-[var(--color-muted-fg)]">
                          One report per player per question. Re-submitting updates your previous report.
                        </p>
                        <Button size="sm" onClick={handleSubmitReport} disabled={isSubmittingReport}>
                          {isSubmittingReport ? 'Submitting…' : 'Send Report'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {reportSuccess && (
                    <p className="mt-4 font-display text-xs uppercase tracking-[0.16em] text-[var(--color-accent)]">
                      Report submitted to admin review.
                    </p>
                  )}

                  {reportError && (
                    <p className="mt-4 font-display text-xs uppercase tracking-[0.16em] text-[var(--color-accent)]">
                      {reportError}
                    </p>
                  )}
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
