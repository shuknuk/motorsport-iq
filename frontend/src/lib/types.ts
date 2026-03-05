// Socket.io event types for the frontend

export type TrackStatus = 'GREEN' | 'SC' | 'VSC' | 'RED';
export type QuestionCategory = 'PIT_WINDOW' | 'STRATEGY' | 'OVERTAKE' | 'ENERGY_BATTLE' | 'GAP_CLOSING' | 'FINISH_POSITION';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionState = 'TRIGGERED' | 'LIVE' | 'LOCKED' | 'ACTIVE' | 'RESOLVED' | 'EXPLAINED' | 'CLOSED' | 'CANCELLED';

export interface PlayerState {
  id: string;
  username: string;
  isHost: boolean;
  connected: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  points: number;
  streak: number;
  maxStreak: number;
  correctAnswers: number;
  wrongAnswers: number;
  questionsAnswered: number;
  accuracy: number;
}

export interface QuestionInstanceState {
  id: string;
  lobbyId: string;
  questionId: string;
  state: QuestionState;
  triggeredAt: string;
  lockedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  triggerSnapshot: RaceSnapshot;
  windowSize: number;
  targetLap: number;
  answer: 'YES' | 'NO' | null;
  outcome: boolean | null;
  explanation?: string;
  questionText?: string;
  cancelledReason?: string;
}

export interface RaceSnapshot {
  sessionId: string;
  lapNumber: number;
  totalLaps: number | null;
  trackStatus: TrackStatus;
  drivers: DriverState[];
  timestamp: string;
  dataFeedStalled: boolean;
  leaderLapTime: number | null;
}

export interface DriverState {
  driverNumber: number;
  name: string;
  team: string;
  position: number;
  gap: number | null;
  interval: number | null;
  tyreCompound: string | null;
  tyreAge: number;
  drsEnabled: boolean;
  pitCount: number;
  lastLapTime: number | null;
  inPit: boolean;
  retired: boolean;
}

export interface LobbyState {
  id: string;
  code: string;
  hostId: string;
  sessionId: string | null;
  status: 'waiting' | 'active' | 'finished';
  players: PlayerState[];
  currentQuestion: QuestionInstanceState | null;
  questionCount: number;
  leaderboard: LeaderboardEntry[];
}

export interface QuestionEvent {
  instanceId: string;
  questionId: string;
  questionText: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  windowSize: number;
  triggeredAt: string;
  answerDeadline: string;
}

export interface ResolutionEvent {
  instanceId: string;
  questionId: string;
  questionText: string;
  correctAnswer: 'YES' | 'NO';
  outcome: boolean;
  explanation: string;
  scores?: ScoreUpdate[];
}

export interface ScoreUpdate {
  userId: string;
  username: string;
  points: number;
  pointsChange: number;
  streak: number;
  accuracy: number;
  answered: boolean;
  wasCorrect: boolean | null;
}

export interface RaceSnapshotEvent {
  sessionId: string;
  lapNumber: number;
  trackStatus: TrackStatus;
  leader: string;
  topThree: string[];
  dataFeedStalled: boolean;
}

export interface SessionInfo {
  session_key: number;
  meeting_key: number;
  location: string;
  session_type: string;
  session_name: string;
  date_start: string;
  date_end: string;
  country_name: string;
  circuit_short_name: string;
  year: number;
}

// Socket event names
export const SERVER_EVENTS = {
  LOBBY_STATE: 'lobby_state',
  QUESTION_EVENT: 'question_event',
  QUESTION_STATE: 'question_state',
  QUESTION_LOCKED: 'question_locked',
  QUESTION_CANCELLED: 'question_cancelled',
  RESOLUTION_EVENT: 'resolution_event',
  LEADERBOARD_UPDATE: 'leaderboard_update',
  RACE_SNAPSHOT_UPDATE: 'race_snapshot_update',
  SESSION_STARTED: 'session_started',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  PLAYER_DISCONNECTED: 'player_disconnected',
  ANSWER_RECEIVED: 'answer_received',
  SESSIONS_LIST: 'sessions_list',
  FEED_STATUS: 'feed_status',
  ERROR: 'error',
} as const;

export const CLIENT_EVENTS = {
  CREATE_LOBBY: 'create_lobby',
  JOIN_LOBBY: 'join_lobby',
  START_SESSION: 'start_session',
  SUBMIT_ANSWER: 'submit_answer',
  RECONNECT_LOBBY: 'reconnect_lobby',
  GET_SESSIONS: 'get_sessions',
  LEAVE_LOBBY: 'leave_lobby',
} as const;