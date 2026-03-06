import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import supabase from './db/supabaseClient';
import type { QuestionInstanceState, RaceSnapshot } from './types';
import {
  createLobby,
  joinLobby,
  getLobbyState,
  getLobbyByCode,
  updateLobbyStatus,
  setLobbySession,
  updatePlayerConnection,
  removePlayer,
  getUserLobby,
} from './lobby/lobbyManager';
import {
  startQuestionLifecycle,
  submitAnswer,
  getActiveQuestion,
  checkForResolution,
  resumeQuestion,
  clearAllTimers,
} from './lobby/lifecycleManager';
import { getOpenF1Client, OpenF1Client } from './data/openf1Client';
import { getSnapshotStore, SnapshotStore } from './data/snapshotStore';
import { selectQuestion, clearCooldowns } from './engine/questionEngine';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test Supabase connection by querying a simple table
    const { data, error } = await supabase.from('lobbies').select('id').limit(1);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      supabase: error ? 'error' : 'connected',
      supabaseError: error?.message || null,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      supabase: 'error',
      error: (err as Error).message,
    });
  }
});

// Supabase connectivity test
app.get('/health/supabase', async (req, res) => {
  try {
    const { data, error } = await supabase.from('lobbies').select('id').limit(1);
    if (error) throw error;
    res.json({ status: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message });
  }
});

// OpenF1 client and snapshot store
let openF1Client: OpenF1Client;
let snapshotStore: SnapshotStore;

// Active session tracking
const activeSessions: Map<string, { lobbyIds: Set<string> }> = new Map();

/**
 * Initialize OpenF1 client and snapshot store
 */
function initializeDataLayer(): void {
  openF1Client = getOpenF1Client({
    onLapCompletion: async (lap) => {
      console.log(`Lap ${lap.lap_number} completed by driver ${lap.driver_number}`);

      // Check for question resolution for all active lobbies in this session
      for (const [sessionId, data] of activeSessions) {
        if (sessionId === String(lap.session_key)) {
          const snapshot = snapshotStore.getCurrentSnapshot();
          if (snapshot) {
            for (const lobbyId of data.lobbyIds) {
              await checkAndResolveQuestion(lobbyId, snapshot);
            }
          }
        }
      }
    },
    onFeedStall: (stalled) => {
      console.log(`Data feed ${stalled ? 'stalled' : 'recovered'}`);
      io.emit('feed_status', { stalled });
    },
    onError: (error) => {
      console.error('OpenF1 client error:', error);
    },
  });

  snapshotStore = getSnapshotStore({
    onSnapshotUpdate: (snapshot) => {
      // Broadcast race snapshot to all clients in session lobbies
      broadcastRaceSnapshot(snapshot);
    },
    onLapComplete: async (snapshot) => {
      // Check for new questions
      for (const [sessionId, data] of activeSessions) {
        if (sessionId === snapshot.sessionId) {
          for (const lobbyId of data.lobbyIds) {
            await checkAndTriggerQuestion(lobbyId, snapshot);
          }
        }
      }
    },
  });
}

/**
 * Check and trigger a new question for a lobby
 */
async function checkAndTriggerQuestion(lobbyId: string, snapshot: RaceSnapshot): Promise<void> {
  const lobbyState = await getLobbyState(lobbyId);
  if (!lobbyState || lobbyState.status !== 'active') return;

  const activeQuestion = getActiveQuestion(lobbyId);

  // Check if SC/VSC - resume paused questions
  if (snapshot.trackStatus === 'GREEN') {
    await resumeQuestion(
      lobbyId,
      snapshot,
      (result) => handleResolution(lobbyId, result),
      (instance) => handleStateChange(lobbyId, instance)
    );
  }

  // Try to select a new question
  const previousSnapshot = snapshotStore.getPreviousSnapshot();
  const newQuestion = selectQuestion(
    snapshot,
    previousSnapshot,
    lobbyId,
    activeQuestion,
    lobbyState.questionCount
  );

  if (newQuestion) {
    console.log(`Triggering question ${newQuestion.questionId} for lobby ${lobbyId}`);

    // Broadcast question event
    io.to(lobbyId).emit('question_event', {
      instanceId: newQuestion.id,
      questionId: newQuestion.questionId,
      questionText: newQuestion.questionText,
      category: getQuestionCategory(newQuestion.questionId),
      difficulty: getQuestionDifficulty(newQuestion.questionId),
      windowSize: newQuestion.windowSize,
      triggeredAt: newQuestion.triggeredAt.toISOString(),
      answerDeadline: new Date(newQuestion.triggeredAt.getTime() + 20000).toISOString(),
    });

    // Start lifecycle
    await startQuestionLifecycle(
      newQuestion,
      (instance) => handleStateChange(lobbyId, instance),
      (result) => handleResolution(lobbyId, result)
    );
  }
}

/**
 * Check and resolve active question
 */
async function checkAndResolveQuestion(lobbyId: string, snapshot: RaceSnapshot): Promise<void> {
  await checkForResolution(
    lobbyId,
    snapshot,
    (result) => handleResolution(lobbyId, result),
    (instance) => handleStateChange(lobbyId, instance)
  );
}

/**
 * Handle question state change
 */
function handleStateChange(lobbyId: string, instance: QuestionInstanceState): void {
  io.to(lobbyId).emit('question_state', {
    instanceId: instance.id,
    state: instance.state,
    cancelledReason: instance.cancelledReason,
  });

  if (instance.state === 'LOCKED') {
    io.to(lobbyId).emit('question_locked', {
      instanceId: instance.id,
    });
  }

  if (instance.state === 'CANCELLED') {
    io.to(lobbyId).emit('question_cancelled', {
      instanceId: instance.id,
      reason: instance.cancelledReason,
    });
  }
}

/**
 * Handle question resolution
 */
async function handleResolution(
  lobbyId: string,
  result: {
    instance: QuestionInstanceState;
    outcome: boolean;
    correctAnswer: 'YES' | 'NO';
    explanation: string;
  }
): Promise<void> {
  // Get updated leaderboard
  const lobbyState = await getLobbyState(lobbyId);

  // Broadcast resolution
  io.to(lobbyId).emit('resolution_event', {
    instanceId: result.instance.id,
    questionId: result.instance.questionId,
    questionText: result.instance.questionText,
    correctAnswer: result.correctAnswer,
    outcome: result.outcome,
    explanation: result.explanation,
  });

  // Broadcast updated leaderboard
  if (lobbyState) {
    io.to(lobbyId).emit('leaderboard_update', lobbyState.leaderboard);
  }
}

/**
 * Broadcast race snapshot to relevant lobbies
 */
function broadcastRaceSnapshot(snapshot: RaceSnapshot): void {
  const sessionData = activeSessions.get(snapshot.sessionId);
  if (sessionData) {
    for (const lobbyId of sessionData.lobbyIds) {
      io.to(lobbyId).emit('race_snapshot_update', {
        sessionId: snapshot.sessionId,
        lapNumber: snapshot.lapNumber,
        trackStatus: snapshot.trackStatus,
        leader: snapshot.drivers[0]?.name ?? '',
        topThree: snapshot.drivers.slice(0, 3).map((d) => d.name),
        dataFeedStalled: snapshot.dataFeedStalled,
      });
    }
  }
}

/**
 * Get question category
 */
function getQuestionCategory(questionId: string): string {
  const { getQuestionById } = require('./engine/questionBank');
  const question = getQuestionById(questionId);
  return question?.category ?? 'UNKNOWN';
}

/**
 * Get question difficulty
 */
function getQuestionDifficulty(questionId: string): string {
  const { getQuestionById } = require('./engine/questionBank');
  const question = getQuestionById(questionId);
  return question?.difficulty ?? 'MEDIUM';
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  let currentUserId: string | null = null;
  let currentLobbyId: string | null = null;

  /**
   * Create a new lobby
   */
  socket.on('create_lobby', async (data: { username: string; sessionId?: string }) => {
    try {
      const { lobby, user } = await createLobby(data.username, data.sessionId);
      currentUserId = user.id;
      currentLobbyId = lobby.id;

      socket.join(lobby.id);

      const lobbyState = await getLobbyState(lobby.id);
      socket.emit('lobby_state', lobbyState);

      console.log(`Lobby created: ${lobby.code} by ${data.username}`);
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  /**
   * Join an existing lobby
   */
  socket.on('join_lobby', async (data: { lobbyCode: string; username: string }) => {
    try {
      const { lobby, user } = await joinLobby(data.lobbyCode, data.username);
      currentUserId = user.id;
      currentLobbyId = lobby.id;

      socket.join(lobby.id);

      const lobbyState = await getLobbyState(lobby.id);
      socket.emit('lobby_state', lobbyState);

      // Notify others in the lobby
      socket.to(lobby.id).emit('player_joined', {
        userId: user.id,
        username: user.username,
      });

      console.log(`${data.username} joined lobby ${lobby.code}`);
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  /**
   * Start the session (host only)
   */
  socket.on('start_session', async (data: { lobbyId: string; sessionId: string }) => {
    try {
      const lobbyState = await getLobbyState(data.lobbyId);
      if (!lobbyState) {
        throw new Error('Lobby not found');
      }

      if (lobbyState.hostId !== currentUserId) {
        throw new Error('Only the host can start the session');
      }

      // Update lobby status
      await updateLobbyStatus(data.lobbyId, 'active');
      await setLobbySession(data.lobbyId, data.sessionId);

      // Track session
      if (!activeSessions.has(data.sessionId)) {
        activeSessions.set(data.sessionId, { lobbyIds: new Set() });
      }
      activeSessions.get(data.sessionId)!.lobbyIds.add(data.lobbyId);

      // Initialize OpenF1 client for this session
      openF1Client.setSession(parseInt(data.sessionId));
      await snapshotStore.initialize(parseInt(data.sessionId));
      openF1Client.startPolling();

      // Notify all players
      io.to(data.lobbyId).emit('session_started', {
        sessionId: data.sessionId,
      });

      console.log(`Session ${data.sessionId} started for lobby ${lobbyState.code}`);
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  /**
   * Submit an answer
   */
  socket.on('submit_answer', async (data: { instanceId: string; answer: 'YES' | 'NO' }) => {
    try {
      if (!currentUserId) {
        throw new Error('Not authenticated');
      }

      const result = await submitAnswer(data.instanceId, currentUserId, data.answer);

      if (result.success) {
        socket.emit('answer_received', { instanceId: data.instanceId });
      } else {
        socket.emit('error', { message: result.error });
      }
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  /**
   * Reconnect to lobby
   */
  socket.on('reconnect_lobby', async (data: { userId: string }) => {
    try {
      const lobbyId = getUserLobby(data.userId);
      if (!lobbyId) {
        throw new Error('User not in any lobby');
      }

      const lobbyState = await getLobbyState(lobbyId);
      if (!lobbyState) {
        throw new Error('Lobby not found');
      }

      currentUserId = data.userId;
      currentLobbyId = lobbyId;

      socket.join(lobbyId);
      updatePlayerConnection(data.userId, true);

      // Send current state
      socket.emit('lobby_state', lobbyState);

      // Send active question if any
      const activeQuestion = getActiveQuestion(lobbyId);
      if (activeQuestion && activeQuestion.state === 'LIVE') {
        socket.emit('question_event', {
          instanceId: activeQuestion.id,
          questionId: activeQuestion.questionId,
          questionText: activeQuestion.questionText,
          category: getQuestionCategory(activeQuestion.questionId),
          difficulty: getQuestionDifficulty(activeQuestion.questionId),
          windowSize: activeQuestion.windowSize,
          triggeredAt: activeQuestion.triggeredAt.toISOString(),
          answerDeadline: new Date(activeQuestion.triggeredAt.getTime() + 20000).toISOString(),
        });
      }

      console.log(`User ${data.userId} reconnected to lobby ${lobbyId}`);
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  /**
   * Get available sessions
   */
  socket.on('get_sessions', async () => {
    try {
      const sessions = await openF1Client.getSessions();
      socket.emit('sessions_list', sessions);
    } catch (error) {
      socket.emit('error', { message: 'Failed to fetch sessions' });
    }
  });

  /**
   * Handle disconnect
   */
  socket.on('disconnect', async () => {
    console.log(`Client disconnected: ${socket.id}`);

    if (currentUserId && currentLobbyId) {
      updatePlayerConnection(currentUserId, false);
      socket.to(currentLobbyId).emit('player_disconnected', { userId: currentUserId });
    }
  });

  /**
   * Leave lobby
   */
  socket.on('leave_lobby', async () => {
    if (currentUserId && currentLobbyId) {
      await removePlayer(currentUserId);
      socket.leave(currentLobbyId);
      socket.to(currentLobbyId).emit('player_left', { userId: currentUserId });
      currentUserId = null;
      currentLobbyId = null;
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  clearAllTimers();
  openF1Client?.stopPolling();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  clearAllTimers();
  openF1Client?.stopPolling();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
initializeDataLayer();
httpServer.listen(PORT, () => {
  console.log(`Motorsport IQ server running on port ${PORT}`);
});

export { io, app, httpServer };