// Shared types for the Motorsport IQ application

// Driver state at a point in time
export interface DriverState {
  driverNumber: number;
  name: string;
  team: string;
  position: number;
  gap: number | null; // Gap to leader in seconds
  interval: number | null; // Gap to car ahead in seconds
  tyreCompound: string | null;
  tyreAge: number;
  drsEnabled: boolean;
  pitCount: number;
  lastLapTime: number | null;
  inPit: boolean;
  retired: boolean;
}

// Track status types
export type TrackStatus = 'GREEN' | 'SC' | 'VSC' | 'RED';

// Race snapshot built on each lap completion
export interface RaceSnapshot {
  sessionId: string;
  lapNumber: number;
  totalLaps: number | null;
  trackStatus: TrackStatus;
  drivers: DriverState[];
  timestamp: Date;
  dataFeedStalled: boolean;
  leaderLapTime: number | null;
}

// OpenF1 API response types
export interface OpenF1Session {
  session_key: number;
  meeting_key: number;
  location: string;
  session_type: string;
  session_name: string;
  date_start: string;
  date_end: string;
  country_key: number;
  country_code: string;
  country_name: string;
  circuit_key: number;
  circuit_short_name: string;
  year: number;
}

export interface OpenF1Driver {
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  first_name: string;
  last_name: string;
  headshot_url: string;
  country_code: string;
  session_key: number;
  meeting_key: number;
}

export interface OpenF1Lap {
  session_key: number;
  meeting_key: number;
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  lap_time: string | null;
  is_pit_out_lap: boolean;
  date_start: string;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  segments_sector_1: number[];
  segments_sector_2: number[];
  segments_sector_3: number[];
}

export interface OpenF1Position {
  date: string;
  meeting_key: number;
  session_key: number;
  driver_number: number;
  position: number;
}

export interface OpenF1Interval {
  date: string;
  meeting_key: number;
  session_key: number;
  driver_number: number;
  gap_to_leader: number | null;
  interval: number | null;
}

export interface OpenF1Pit {
  date: string;
  session_key: number;
  meeting_key: number;
  driver_number: number;
  pit_duration: number;
  lap_number: number;
  number: number; // pit stop number
}

export interface OpenF1CarData {
  date: string;
  session_key: number;
  meeting_key: number;
  driver_number: number;
  brake: number;
  drs: number;
  n_gear: number;
  rpm: number;
  speed: number;
  throttle: number;
}

export interface OpenF1RaceControl {
  date: string;
  session_key: number;
  meeting_key: number;
  category: string;
  flag: string;
  scope: string;
  sector: number;
  driver_number: number;
  message: string;
  lap_number: number;
}

// Question types
export type QuestionCategory =
  | 'OVERTAKE'
  | 'PIT_WINDOW'
  | 'ENERGY_BATTLE'
  | 'FINISH_POSITION'
  | 'STRATEGY'
  | 'GAP_CLOSING';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface Question {
  id: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  template: string; // e.g., "Will {driver1} overtake {driver2} in the next {windowSize} laps?"
  windowSize: number; // Number of laps to resolve
  triggers: TriggerCondition[];
  successCondition: SuccessCondition;
  priority: number; // 1 = highest
  cooldownLaps: number; // Minimum laps between questions of this category
}

export interface TriggerCondition {
  type: string;
  params: Record<string, unknown>;
}

export interface SuccessCondition {
  type: string;
  params: Record<string, unknown>;
}

// Question instance (runtime)
export type InstanceState =
  | 'TRIGGERED'
  | 'LIVE'
  | 'LOCKED'
  | 'ACTIVE'
  | 'RESOLVED'
  | 'EXPLAINED'
  | 'CLOSED'
  | 'CANCELLED';

export interface QuestionInstanceState {
  id: string;
  lobbyId: string;
  questionId: string;
  state: InstanceState;
  triggeredAt: Date;
  lockedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  triggerSnapshot: RaceSnapshot;
  windowSize: number;
  targetLap: number; // The lap by which we need to resolve
  answer: 'YES' | 'NO' | null;
  outcome: boolean | null;
  explanation?: string;
  cancelledReason?: string;
  cancelledAt?: Date;
  // Populated for rendering
  questionText?: string;
  driver1?: DriverState;
  driver2?: DriverState;
}

// Lobby state
export interface LobbyState {
  id: string;
  code: string;
  hostId: string;
  sessionId: string | null;
  status: 'waiting' | 'active' | 'finished';
  players: PlayerState[];
  currentQuestion: QuestionInstanceState | null;
  questionCount: number;
  leaderboard: LeaderboardEntryState[];
}

export interface PlayerState {
  id: string;
  username: string;
  isHost: boolean;
  connected: boolean;
}

export interface LeaderboardEntryState {
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

// Derived signals (used for trigger evaluation)
export interface DerivedSignals {
  closingTrend: Map<number, boolean>; // driverNumber -> isClosing
  pitWindowOpen: Map<number, boolean>; // driverNumber -> inPitWindow
  tyreCliffRisk: Map<number, boolean>; // driverNumber -> atTyreCliff
  undercutWindow: Map<number, boolean>; // driverNumber -> undercutOpportunity
  energyAdvantage: Map<number, { attacker: number; defender: number }[]>; // DRS battles
  closeBattles: { attacker: number; defender: number; gap: number }[];
  recentPitters: number[]; // driverNumbers who pitted recently
}

// Socket event types
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
  scores: ScoreUpdate[];
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