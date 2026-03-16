// @ts-nocheck
// Type checking disabled for Supabase complex generic types
// @ts-nocheck - Supabase type inference issues with generic client
import { v4 as uuidv4 } from 'uuid';
import type { Lobby, User, QuestionInstance } from '../db/types';
import supabase from '../db/supabaseClient';
import type {
  LobbyState,
  PlayerState,
  LeaderboardEntryState,
  QuestionInstanceState,
  SessionMode,
  ResolutionEvent,
} from '../types';

/**
 * Lobby Manager - Handle lobby creation, joining, and state management
 */

// In-memory lobby state cache (for fast access)
const lobbyStates: Map<string, LobbyState> = new Map();
const userLobbies: Map<string, string> = new Map(); // userId -> lobbyId

interface LobbyRuntimeMeta {
  sessionMode: SessionMode | null;
  replaySpeed: number | null;
  isReplayComplete: boolean;
}

const defaultRuntimeMeta = (): LobbyRuntimeMeta => ({
  sessionMode: null,
  replaySpeed: null,
  isReplayComplete: false,
});

const lobbyRuntimeMeta: Map<string, LobbyRuntimeMeta> = new Map();

/**
 * Generate a random 6-character lobby code
 */
export function generateLobbyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a new lobby
 */
export async function createLobby(username: string, sessionId?: string): Promise<{ lobby: Lobby; user: User }> {
  // Generate unique lobby code
  let code = generateLobbyCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await supabase
      .from('lobbies')
      .select('code')
      .eq('code', code)
      .single();

    if (!existing.data) break;
    code = generateLobbyCode();
    attempts++;
  }

  // Create lobby in database
  const { data: lobby, error: lobbyError } = await supabase
    .from('lobbies')
    .insert({
      code,
      session_id: sessionId ?? null,
      status: 'waiting',
      question_count: 0,
    })
    .select()
    .single();

  if (lobbyError || !lobby) {
    throw new Error(`Failed to create lobby: ${lobbyError?.message}`);
  }

  // Create host user
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      username,
      lobby_id: lobby.id,
      is_host: true,
    })
    .select()
    .single();

  if (userError || !user) {
    // Clean up lobby
    await supabase.from('lobbies').delete().eq('id', lobby.id);
    throw new Error(`Failed to create user: ${userError?.message}`);
  }

  // Update lobby with host
  await supabase
    .from('lobbies')
    .update({ host_id: user.id })
    .eq('id', lobby.id);

  // Initialize leaderboard entry for host
  await supabase.from('leaderboard').insert({
    lobby_id: lobby.id,
    user_id: user.id,
    points: 0,
    streak: 0,
    max_streak: 0,
    correct_answers: 0,
    wrong_answers: 0,
    questions_answered: 0,
    accuracy: 0,
  });

  // Initialize in-memory state
  const lobbyState: LobbyState = {
    id: lobby.id,
    code: lobby.code,
    hostId: user.id,
    sessionId: lobby.session_id,
    status: 'waiting',
    sessionMode: null,
    replaySpeed: null,
    isReplayComplete: false,
    players: [{ id: user.id, username, isHost: true, connected: true }],
    currentQuestion: null,
    latestResolution: null,
    questionCount: 0,
    leaderboard: [],
  };
  lobbyStates.set(lobby.id, lobbyState);
  userLobbies.set(user.id, lobby.id);

  return { lobby, user };
}

/**
 * Join an existing lobby
 */
export async function joinLobby(lobbyCode: string, username: string): Promise<{ lobby: Lobby; user: User }> {
  // Find lobby by code
  const { data: lobby, error: lobbyError } = await supabase
    .from('lobbies')
    .select()
    .eq('code', lobbyCode.toUpperCase())
    .single();

  if (lobbyError || !lobby) {
    throw new Error('Lobby not found');
  }

  if (lobby.status !== 'waiting') {
    throw new Error('Game already in progress');
  }

  // Check if username is taken
  const { data: existingUser } = await supabase
    .from('users')
    .select()
    .eq('lobby_id', lobby.id)
    .eq('username', username)
    .single();

  if (existingUser) {
    throw new Error('Username already taken');
  }

  // Create user
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      username,
      lobby_id: lobby.id,
      is_host: false,
    })
    .select()
    .single();

  if (userError || !user) {
    throw new Error(`Failed to join lobby: ${userError?.message}`);
  }

  // Initialize leaderboard entry
  await supabase.from('leaderboard').insert({
    lobby_id: lobby.id,
    user_id: user.id,
    points: 0,
    streak: 0,
    max_streak: 0,
    correct_answers: 0,
    wrong_answers: 0,
    questions_answered: 0,
    accuracy: 0,
  });

  // Update in-memory state
  const lobbyState = lobbyStates.get(lobby.id);
  if (lobbyState) {
    lobbyState.players.push({
      id: user.id,
      username,
      isHost: false,
      connected: true,
    });
    userLobbies.set(user.id, lobby.id);
  }

  return { lobby, user };
}

/**
 * Get lobby by ID
 */
export async function getLobby(lobbyId: string): Promise<Lobby | null> {
  const { data, error } = await supabase
    .from('lobbies')
    .select()
    .eq('id', lobbyId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Get lobby by code
 */
export async function getLobbyByCode(code: string): Promise<Lobby | null> {
  const { data, error } = await supabase
    .from('lobbies')
    .select()
    .eq('code', code.toUpperCase())
    .single();

  if (error) return null;
  return data;
}

/**
 * Get full lobby state
 */
export async function getLobbyState(lobbyId: string): Promise<LobbyState | null> {
  // Check in-memory cache first
  const cached = lobbyStates.get(lobbyId);
  if (cached) {
    return cached;
  }

  // Fetch from database
  const { data: lobby, error: lobbyError } = await supabase
    .from('lobbies')
    .select()
    .eq('id', lobbyId)
    .single();

  if (lobbyError || !lobby) return null;

  // Fetch players
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select()
    .eq('lobby_id', lobbyId);

  if (usersError) return null;

  // Fetch leaderboard
  const { data: leaderboard, error: lbError } = await supabase
    .from('leaderboard')
    .select()
    .eq('lobby_id', lobbyId);

  if (lbError) return null;

  // Build state
  const lobbyState: LobbyState = {
    id: lobby.id,
    code: lobby.code,
    hostId: lobby.host_id ?? '',
    sessionId: lobby.session_id,
    status: lobby.status,
    sessionMode: lobbyRuntimeMeta.get(lobbyId)?.sessionMode ?? null,
    replaySpeed: lobbyRuntimeMeta.get(lobbyId)?.replaySpeed ?? null,
    isReplayComplete: lobbyRuntimeMeta.get(lobbyId)?.isReplayComplete ?? false,
    players: (users ?? []).map((u) => ({
      id: u.id,
      username: u.username,
      isHost: u.is_host,
      connected: true, // Assume connected on initial load
    })),
    currentQuestion: null, // Would need to fetch active question
    latestResolution: null,
    questionCount: lobby.question_count,
    leaderboard: (leaderboard ?? []).map((lb) => ({
      userId: lb.user_id,
      username: users?.find((u) => u.id === lb.user_id)?.username ?? '',
      points: lb.points,
      streak: lb.streak,
      maxStreak: lb.max_streak,
      correctAnswers: lb.correct_answers,
      wrongAnswers: lb.wrong_answers,
      questionsAnswered: lb.questions_answered,
      accuracy: lb.accuracy,
    })),
  };

  // Cache it
  lobbyStates.set(lobbyId, lobbyState);

  return lobbyState;
}

/**
 * Update lobby status
 */
export async function updateLobbyStatus(
  lobbyId: string,
  status: 'waiting' | 'active' | 'finished'
): Promise<void> {
  const updates: any = { status };

  if (status === 'active') {
    updates.started_at = new Date().toISOString();
  } else if (status === 'finished') {
    updates.finished_at = new Date().toISOString();
  }

  await supabase.from('lobbies').update(updates).eq('id', lobbyId);

  // Update cache
  const lobbyState = lobbyStates.get(lobbyId);
  if (lobbyState) {
    lobbyState.status = status;
  }
}

/**
 * Set lobby session
 */
export async function setLobbySession(lobbyId: string, sessionId: string): Promise<void> {
  await supabase
    .from('lobbies')
    .update({ session_id: sessionId })
    .eq('id', lobbyId);

  const lobbyState = lobbyStates.get(lobbyId);
  if (lobbyState) {
    lobbyState.sessionId = sessionId;
  }
}

export function setLobbyRuntimeMeta(
  lobbyId: string,
  updates: Partial<LobbyRuntimeMeta>
): void {
  const next = {
    ...defaultRuntimeMeta(),
    ...(lobbyRuntimeMeta.get(lobbyId) ?? {}),
    ...updates,
  };
  lobbyRuntimeMeta.set(lobbyId, next);

  const lobbyState = lobbyStates.get(lobbyId);
  if (lobbyState) {
    lobbyState.sessionMode = next.sessionMode;
    lobbyState.replaySpeed = next.replaySpeed;
    lobbyState.isReplayComplete = next.isReplayComplete;
  }
}

/**
 * Increment question count
 */
export async function incrementQuestionCount(lobbyId: string): Promise<number> {
  const lobby = await getLobby(lobbyId);
  const newCount = (lobby?.question_count ?? 0) + 1;
  await supabase
    .from('lobbies')
    .update({ question_count: newCount })
    .eq('id', lobbyId);

  const lobbyState = lobbyStates.get(lobbyId);
  if (lobbyState) {
    lobbyState.questionCount = newCount;
  }

  return newCount;
}

/**
 * Set current question
 */
export function setCurrentQuestion(lobbyId: string, question: QuestionInstanceState | null): void {
  const lobbyState = lobbyStates.get(lobbyId);
  if (lobbyState) {
    lobbyState.currentQuestion = question;
  }
}

export function setLatestResolution(lobbyId: string, resolution: ResolutionEvent | null): void {
  const lobbyState = lobbyStates.get(lobbyId);
  if (lobbyState) {
    lobbyState.latestResolution = resolution;
  }
}

/**
 * Update player connection status
 */
export function updatePlayerConnection(userId: string, connected: boolean): void {
  const lobbyId = userLobbies.get(userId);
  if (!lobbyId) return;

  const lobbyState = lobbyStates.get(lobbyId);
  if (!lobbyState) return;

  const player = lobbyState.players.find((p) => p.id === userId);
  if (player) {
    player.connected = connected;
  }
}

/**
 * Remove player from lobby
 */
export async function removePlayer(userId: string): Promise<void> {
  const lobbyId = userLobbies.get(userId);
  if (!lobbyId) return;

  // Delete from database
  await supabase.from('users').delete().eq('id', userId);

  // Update cache
  const lobbyState = lobbyStates.get(lobbyId);
  if (lobbyState) {
    lobbyState.players = lobbyState.players.filter((p) => p.id !== userId);
    lobbyState.leaderboard = lobbyState.leaderboard.filter((lb) => lb.userId !== userId);
  }

  userLobbies.delete(userId);
}

/**
 * Get lobby ID for a user
 */
export function getUserLobby(userId: string): string | null {
  return userLobbies.get(userId) ?? null;
}

/**
 * Update leaderboard in cache
 */
export function updateLeaderboardCache(
  lobbyId: string,
  userId: string,
  updates: Partial<LeaderboardEntryState>
): void {
  const lobbyState = lobbyStates.get(lobbyId);
  if (!lobbyState) return;

  const entry = lobbyState.leaderboard.find((lb) => lb.userId === userId);
  if (entry) {
    Object.assign(entry, updates);
  } else {
    lobbyState.leaderboard.push({
      userId,
      username: updates.username ?? '',
      points: updates.points ?? 0,
      streak: updates.streak ?? 0,
      maxStreak: updates.maxStreak ?? 0,
      correctAnswers: updates.correctAnswers ?? 0,
      wrongAnswers: updates.wrongAnswers ?? 0,
      questionsAnswered: updates.questionsAnswered ?? 0,
      accuracy: updates.accuracy ?? 0,
    });
  }

  // Sort leaderboard
  lobbyState.leaderboard.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    return b.maxStreak - a.maxStreak;
  });
}

/**
 * Clear lobby from cache
 */
export function clearLobbyCache(lobbyId: string): void {
  const lobbyState = lobbyStates.get(lobbyId);
  if (lobbyState) {
    for (const player of lobbyState.players) {
      userLobbies.delete(player.id);
    }
    lobbyStates.delete(lobbyId);
  }
}
