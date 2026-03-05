'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocketClient } from '@/lib/socket';
import type {
  LobbyState,
  QuestionEvent,
  ResolutionEvent,
  LeaderboardEntry,
  RaceSnapshotEvent,
} from '@/lib/types';
import { SERVER_EVENTS } from '@/lib/types';
import QuestionCard from '@/components/QuestionCard';
import CountdownTimer from '@/components/CountdownTimer';
import Leaderboard from '@/components/Leaderboard';

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

  // Set up socket listeners
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
      socket.on(SERVER_EVENTS.QUESTION_STATE, (data: { instanceId: string; state: string; cancelledReason?: string }) => {
        setQuestionState(data.state);
        if (data.state === 'CANCELLED') {
          setCurrentQuestion(null);
        }
      }),
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

    // Try to reconnect
    const userId = localStorage.getItem('msp_user_id');
    if (userId) {
      socket.reconnectLobby(userId);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  const handleSubmitAnswer = useCallback(
    (selectedAnswer: 'YES' | 'NO') => {
      if (!currentQuestion || answer) return;

      const socket = getSocketClient();
      socket.submitAnswer(currentQuestion.instanceId, selectedAnswer);
      setAnswer(selectedAnswer);
    },
    [currentQuestion, answer]
  );

  const getTrackStatusColor = (status: string) => {
    switch (status) {
      case 'GREEN':
        return 'bg-green-500';
      case 'SC':
        return 'bg-yellow-500';
      case 'VSC':
        return 'bg-yellow-400';
      case 'RED':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (!lobbyState) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black">
      {/* Header */}
      <div className="bg-gray-800/50 border-b border-gray-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">
              Motorsport <span className="text-red-500">IQ</span>
            </h1>
            <span className="text-gray-400 text-sm">Lobby: {lobbyCode}</span>
          </div>

          {/* Race Status */}
          {raceSnapshot && (
            <div className="flex items-center gap-4">
              {feedStalled && (
                <span className="text-yellow-400 text-sm animate-pulse">⚠️ Data Feed Stalled</span>
              )}
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getTrackStatusColor(raceSnapshot.trackStatus)}`} />
                <span className="text-gray-300 text-sm">
                  Lap {raceSnapshot.lapNumber}
                </span>
              </div>
              <div className="text-gray-400 text-sm">
                Leader: {raceSnapshot.leader}
              </div>
            </div>
          )}

          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-4 flex gap-6">
        {/* Left Side - Question */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
          {/* Current Question */}
          {currentQuestion && questionState === 'LIVE' && (
            <div className="w-full max-w-md">
              <div className="mb-6 flex items-center justify-center">
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
            </div>
          )}

          {/* Question Locked */}
          {currentQuestion && questionState === 'LOCKED' && (
            <div className="w-full max-w-md">
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 text-center">
                <div className="text-gray-400 mb-2">Answers Locked</div>
                <div className="text-white text-lg">{currentQuestion.questionText}</div>
                <div className="mt-4 text-gray-500">Waiting for outcome...</div>
              </div>
            </div>
          )}

          {/* Resolution */}
          {resolution && (
            <div className="w-full max-w-md">
              <div
                className={`rounded-xl p-6 border ${
                  answer === resolution.correctAnswer
                    ? 'bg-green-500/20 border-green-500'
                    : answer
                    ? 'bg-red-500/20 border-red-500'
                    : 'bg-gray-800/50 border-gray-700'
                }`}
              >
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">
                    {answer === resolution.correctAnswer ? '✅' : answer ? '❌' : '⏭️'}
                  </div>
                  <div className="text-xl font-bold text-white">
                    {answer === resolution.correctAnswer
                      ? 'Correct!'
                      : answer
                      ? 'Wrong!'
                      : 'No Answer'}
                  </div>
                  {answer && (
                    <div className="text-gray-400 mt-1">
                      The answer was <span className="font-bold text-white">{resolution.correctAnswer}</span>
                    </div>
                  )}
                </div>

                <div className="text-white text-lg mb-4 text-center">
                  {resolution.questionText}
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Explanation</div>
                  <div className="text-gray-200">{resolution.explanation}</div>
                </div>
              </div>
            </div>
          )}

          {/* Waiting for Question */}
          {!currentQuestion && !resolution && (
            <div className="text-center">
              <div className="text-gray-400 text-xl mb-2">Waiting for next question...</div>
              <div className="text-gray-500 text-sm">
                Questions will appear automatically during the race
              </div>
              <div className="mt-8 text-gray-600">
                Questions asked: {lobbyState.questionCount}/10
              </div>
            </div>
          )}
        </div>

        {/* Right Side - Leaderboard */}
        <div className="w-80">
          <Leaderboard entries={leaderboard} currentUserId={currentUserId ?? undefined} />
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-red-500 text-white rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}