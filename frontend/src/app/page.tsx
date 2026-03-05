'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSocketClient } from '@/lib/socket';
import type { LobbyState } from '@/lib/types';
import { SERVER_EVENTS } from '@/lib/types';

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Load username from localStorage
  useEffect(() => {
    const savedUsername = localStorage.getItem('msp_username');
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  // Set up socket listeners
  useEffect(() => {
    const socket = getSocketClient();
    socket.connect();

    const unsubscribers = [
      socket.on(SERVER_EVENTS.LOBBY_STATE, (state: LobbyState) => {
        setIsLoading(false);
        // Save username
        localStorage.setItem('msp_username', username);
        // Save user ID
        const userId = state.players.find((p) => p.username === username)?.id;
        if (userId) {
          localStorage.setItem('msp_user_id', userId);
        }
        // Navigate to lobby or game
        if (state.status === 'waiting') {
          router.push(`/lobby/${state.code}`);
        } else {
          router.push(`/game/${state.code}`);
        }
      }),
      socket.on(SERVER_EVENTS.ERROR, ({ message }: { message: string }) => {
        setError(message);
        setIsLoading(false);
        setIsJoining(false);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [username, router]);

  const handleCreateLobby = () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setError(null);
    setIsLoading(true);
    const socket = getSocketClient();
    socket.createLobby(username.trim());
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
    const socket = getSocketClient();
    socket.joinLobby(lobbyCode.trim().toUpperCase(), username.trim());
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black flex flex-col items-center justify-center p-4">
      {/* Logo and Title */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black text-white mb-2 tracking-tight">
          Motorsport <span className="text-red-500">IQ</span>
        </h1>
        <p className="text-gray-400 text-lg">
          Predict. Compete. Win.
        </p>
        <p className="text-gray-500 text-sm mt-2 max-w-md">
          Join a lobby and test your F1 race prediction skills against friends in real-time.
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
        {/* Username Input */}
        <div className="mb-6">
          <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Create Lobby Button */}
        <button
          onClick={handleCreateLobby}
          disabled={isLoading && !isJoining}
          className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white font-bold rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] mb-6"
        >
          {isLoading && !isJoining ? 'Creating...' : 'Create Lobby'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 border-t border-gray-600"></div>
          <span className="text-gray-500 text-sm">OR</span>
          <div className="flex-1 border-t border-gray-600"></div>
        </div>

        {/* Join Lobby */}
        <div className="mb-4">
          <label htmlFor="lobbyCode" className="block text-sm font-medium text-gray-300 mb-2">
            Lobby Code
          </label>
          <input
            id="lobbyCode"
            type="text"
            value={lobbyCode}
            onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
            placeholder="Enter 6-character code"
            maxLength={6}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white text-center text-xl tracking-widest font-mono placeholder-gray-500 placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          />
        </div>

        <button
          onClick={handleJoinLobby}
          disabled={isLoading && isJoining}
          className="w-full py-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-bold rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {isLoading && isJoining ? 'Joining...' : 'Join Lobby'}
        </button>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Powered by OpenF1 API</p>
      </div>
    </div>
  );
}