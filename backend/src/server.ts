import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import supabase from './db/supabaseClient';
import type { CreateProblemReportInput, ProblemReportStatus, QuestionInstanceState, RaceSnapshot } from './types';
import {
  createLobby,
  joinLobby,
  getLobbyState,
  updateLobbyStatus,
  setLobbySession,
  setLobbyRuntimeMeta,
  setLatestResolution,
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
import { generateQuestionText } from './ai/explanationGenerator';
import { OpenF1Client } from './data/openf1Client';
import { selectQuestion, clearCooldowns } from './engine/questionEngine';
import { SessionRuntimeManager, toSessionInfo } from './runtime/sessionRuntimeManager';
import {
  clearAdminSessionCookie,
  requireAdminSession,
  setAdminSessionCookie,
  updateAdminPassword,
  validateAdminPassword,
} from './admin/auth';
import {
  createOrUpdateProblemReport,
  isProblemReportStatus,
  listProblemReports,
  updateProblemReportStatus,
} from './admin/reporting';

const app = express();
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PATCH'],
  credentials: true,
};
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
});

const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors(corsOptions));
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

app.post('/reports', async (req, res) => {
  try {
    const { instanceId, userId, reason, note } = req.body as CreateProblemReportInput;
    if (!instanceId || !userId || !reason) {
      res.status(400).json({ message: 'instanceId, userId, and reason are required' });
      return;
    }

    const result = await createOrUpdateProblemReport({ instanceId, userId, reason, note });
    res.json({ success: true, id: result.id });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

app.post('/admin/login', async (req, res) => {
  try {
    const password = String(req.body?.password ?? '');
    if (!password) {
      res.status(400).json({ message: 'Password is required' });
      return;
    }

    const isValid = await validateAdminPassword(password);
    if (!isValid) {
      res.status(401).json({ message: 'Incorrect password' });
      return;
    }

    setAdminSessionCookie(res);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
});

app.post('/admin/logout', requireAdminSession, async (req, res) => {
  clearAdminSessionCookie(res);
  res.json({ success: true });
});

app.post('/admin/change-password', requireAdminSession, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword ?? '');
    const nextPassword = String(req.body?.newPassword ?? '');

    if (!currentPassword || !nextPassword) {
      res.status(400).json({ message: 'Current and new password are required' });
      return;
    }

    if (nextPassword.length < 10) {
      res.status(400).json({ message: 'New password must be at least 10 characters' });
      return;
    }

    await updateAdminPassword(currentPassword, nextPassword);
    clearAdminSessionCookie(res);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

app.get('/admin/reports', requireAdminSession, async (req, res) => {
  try {
    const reports = await listProblemReports();
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
});

app.patch('/admin/reports/:id', requireAdminSession, async (req, res) => {
  try {
    const status = String(req.body?.status ?? '') as ProblemReportStatus;
    const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!isProblemReportStatus(status)) {
      res.status(400).json({ message: 'Invalid report status' });
      return;
    }

    if (!reportId) {
      res.status(400).json({ message: 'Report id is required' });
      return;
    }

    await updateProblemReportStatus(reportId, status);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

const sessionLookupClient = new OpenF1Client();
const runtimeManager = new SessionRuntimeManager({
  onSnapshotUpdate: (snapshot, lobbyIds) => {
    broadcastRaceSnapshot(snapshot, lobbyIds);
  },
  onLapComplete: async (snapshot, lobbyIds) => {
    for (const lobbyId of lobbyIds) {
      await checkAndResolveQuestion(lobbyId, snapshot);
      await checkAndTriggerQuestion(lobbyId, snapshot);
    }
  },
  onFeedStall: (stalled, lobbyIds) => {
    for (const lobbyId of lobbyIds) {
      io.to(lobbyId).emit('feed_status', { stalled });
    }
  },
  onReplayComplete: async (snapshot, lobbyIds) => {
    for (const lobbyId of lobbyIds) {
      await updateLobbyStatus(lobbyId, 'finished');
      setLobbyRuntimeMeta(lobbyId, { isReplayComplete: true });
      clearCooldowns(lobbyId);

      const lobbyState = await getLobbyState(lobbyId);
      if (snapshot) {
        io.to(lobbyId).emit('race_snapshot_update', {
          sessionId: snapshot.sessionId,
          lapNumber: snapshot.lapNumber,
          trackStatus: snapshot.trackStatus,
          sessionMode: snapshot.sessionMode,
          replaySpeed: snapshot.replaySpeed,
          isReplayComplete: true,
          leader: snapshot.drivers[0]?.name ?? '',
          topThree: snapshot.drivers.slice(0, 3).map((driver) => driver.name),
          dataFeedStalled: snapshot.dataFeedStalled,
        });
      }
      if (lobbyState) {
        io.to(lobbyId).emit('lobby_state', lobbyState);
      }
    }
  },
  onError: (error) => {
    console.error('Session runtime error:', error);
  },
});

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
  const previousSnapshot = runtimeManager.getRuntimeForLobby(lobbyId)?.getPreviousSnapshot() ?? null;
  const newQuestion = selectQuestion(
    snapshot,
    previousSnapshot,
    lobbyId,
    activeQuestion,
    lobbyState.questionCount
  );

  if (newQuestion) {
    newQuestion.questionText = await generateQuestionText(newQuestion);
    setLatestResolution(lobbyId, null);
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
  const resolutionPayload = {
    instanceId: result.instance.id,
    questionId: result.instance.questionId,
    questionText: result.instance.questionText ?? '',
    correctAnswer: result.correctAnswer,
    outcome: result.outcome,
    explanation: result.explanation,
  };
  setLatestResolution(lobbyId, resolutionPayload);

  // Broadcast resolution
  io.to(lobbyId).emit('resolution_event', resolutionPayload);

  // Broadcast updated leaderboard
  if (lobbyState) {
    io.to(lobbyId).emit('leaderboard_update', lobbyState.leaderboard);
  }
}

/**
 * Broadcast race snapshot to relevant lobbies
 */
function broadcastRaceSnapshot(snapshot: RaceSnapshot, lobbyIds: Set<string>): void {
  for (const lobbyId of lobbyIds) {
    io.to(lobbyId).emit('race_snapshot_update', {
      sessionId: snapshot.sessionId,
      lapNumber: snapshot.lapNumber,
      trackStatus: snapshot.trackStatus,
      sessionMode: snapshot.sessionMode,
      replaySpeed: snapshot.replaySpeed,
      isReplayComplete: snapshot.isReplayComplete,
      leader: snapshot.drivers[0]?.name ?? '',
      topThree: snapshot.drivers.slice(0, 3).map((d) => d.name),
      dataFeedStalled: snapshot.dataFeedStalled,
    });
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
  socket.on('start_session', async (data: { lobbyId: string; sessionId: string; userId?: string | null }) => {
    try {
      const lobbyState = await getLobbyState(data.lobbyId);
      if (!lobbyState) {
        throw new Error('Lobby not found');
      }

      const actingUserId = currentUserId ?? data.userId ?? null;
      if (!actingUserId || lobbyState.hostId !== actingUserId) {
        throw new Error('Only the host can start the session');
      }

      currentUserId = actingUserId;
      currentLobbyId = data.lobbyId;

      const session = await sessionLookupClient.getSession(parseInt(data.sessionId, 10));
      if (!session) {
        throw new Error('OpenF1 session not found');
      }
      if (new Date(session.date_end).getTime() >= Date.now()) {
        throw new Error('This session has not completed yet');
      }

      // Update lobby status
      await updateLobbyStatus(data.lobbyId, 'active');
      await setLobbySession(data.lobbyId, data.sessionId);
      setLatestResolution(data.lobbyId, null);

      const runtime = await runtimeManager.attachLobbyToSession(data.lobbyId, session);
      setLobbyRuntimeMeta(data.lobbyId, {
        sessionMode: runtime.mode,
        replaySpeed: runtime.replaySpeed,
        isReplayComplete: false,
      });

      // Notify all players
      io.to(data.lobbyId).emit('session_started', {
        sessionId: data.sessionId,
        mode: runtime.mode,
        replaySpeed: runtime.replaySpeed,
      });

      const refreshedLobbyState = await getLobbyState(data.lobbyId);
      if (refreshedLobbyState) {
        io.to(data.lobbyId).emit('lobby_state', refreshedLobbyState);
      }

      const snapshot = runtime.getCurrentSnapshot();
      if (snapshot) {
        broadcastRaceSnapshot(snapshot, new Set([data.lobbyId]));
      }

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

      if (lobbyState.sessionId) {
        const snapshot = runtimeManager.getRuntimeForLobby(lobbyId)?.getCurrentSnapshot();
        if (snapshot) {
          socket.emit('race_snapshot_update', {
            sessionId: snapshot.sessionId,
            lapNumber: snapshot.lapNumber,
            trackStatus: snapshot.trackStatus,
            sessionMode: snapshot.sessionMode,
            replaySpeed: snapshot.replaySpeed,
            isReplayComplete: snapshot.isReplayComplete,
            leader: snapshot.drivers[0]?.name ?? '',
            topThree: snapshot.drivers.slice(0, 3).map((driver) => driver.name),
            dataFeedStalled: snapshot.dataFeedStalled,
          });
        }
      }

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

      if (lobbyState.latestResolution) {
        socket.emit('resolution_event', lobbyState.latestResolution);
      }

      console.log(`User ${data.userId} reconnected to lobby ${lobbyId}`);
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  /**
   * Get available sessions
   */
  socket.on('get_sessions', async (data: { year?: number }) => {
    try {
      const year = data?.year || new Date().getFullYear();
      const sessions = await sessionLookupClient.getSessions(year);
      const supportedSessions = (sessions ?? [])
        .filter((session) => ['Race', 'Sprint'].includes(session.session_name))
        .sort(
          (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
        )
        .map((session) => toSessionInfo(session));
      socket.emit('sessions_list', supportedSessions);
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
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  clearAllTimers();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Motorsport IQ server running on port ${PORT}`);
});

export { io, app, httpServer };
