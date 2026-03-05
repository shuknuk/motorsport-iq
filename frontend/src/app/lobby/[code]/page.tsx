'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocketClient } from '@/lib/socket';
import type { LobbyState, SessionInfo, PlayerState } from '@/lib/types';
import { SERVER_EVENTS } from '@/lib/types';

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const lobbyCode = params.code as string;

  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('msp_user_id') : null;

  // Set up socket listeners
  useEffect(() => {
    const socket = getSocketClient();
    socket.connect();

    const unsubscribers = [
      socket.on(SERVER_EVENTS.LOBBY_STATE, (state: LobbyState) => {
        setLobbyState(state);
        setIsLoading(false);

        // If game is active, redirect to game page
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
            players: prev.players.filter((p) => p.id !== data.userId),
          };
        });
      }),
      socket.on(SERVER_EVENTS.PLAYER_DISCONNECTED, (data: { userId: string }) => {
        setLobbyState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === data.userId ? { ...p, connected: false } : p
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

    // Request sessions list
    socket.getSessions();

    // Try to reconnect
    const userId = localStorage.getItem('msp_user_id');
    if (userId) {
      socket.reconnectLobby(userId);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [lobbyCode, router, selectedSession]);

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
    const socket = getSocketClient();
    socket.startSession(lobbyState.id, selectedSession);
  }, [lobbyState, selectedSession]);

  const isHost = lobbyState?.hostId === currentUserId;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!lobbyState) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Lobby not found</div>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Lobby</h1>
          <div className="flex items-center justify-center gap-2">
            <span className="text-gray-400">Code:</span>
            <button
              onClick={handleCopyCode}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-2xl font-mono text-white transition-all"
            >
              {lobbyCode}
            </button>
            <button
              onClick={handleCopyCode}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-all"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Players ({lobbyState.players.length})
          </h2>
          <div className="space-y-2">
            {lobbyState.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  player.connected ? 'bg-gray-700/50' : 'bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${player.connected ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span className={player.connected ? 'text-white' : 'text-gray-400'}>
                    {player.username}
                  </span>
                  {player.isHost && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                      Host
                    </span>
                  )}
                </div>
                {player.id === currentUserId && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                    You
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Session Selection (Host Only) */}
        {isHost && (
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Select Session</h2>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Select a session...</option>
              {sessions.map((session) => (
                <option key={session.session_key} value={session.session_key}>
                  {session.session_name} - {session.location} ({session.year})
                </option>
              ))}
            </select>
            {sessions.length === 0 && (
              <p className="text-gray-400 text-sm mt-2">
                No active sessions. Waiting for live race...
              </p>
            )}
          </div>
        )}

        {/* Waiting Message (Non-Host) */}
        {!isHost && (
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700 mb-6">
            <div className="text-center text-gray-400">
              <div className="animate-pulse mb-2">Waiting for host to start the game...</div>
              <div className="text-sm">Share the lobby code with friends!</div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Start Button */}
        {isHost && (
          <button
            onClick={handleStartGame}
            disabled={isStarting || !selectedSession}
            className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
          >
            {isStarting ? 'Starting...' : 'Start Game'}
          </button>
        )}

        {/* Back Button */}
        <button
          onClick={() => router.push('/')}
          className="w-full mt-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
        >
          Leave Lobby
        </button>
      </div>
    </div>
  );
}