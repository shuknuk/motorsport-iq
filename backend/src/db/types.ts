export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      lobbies: {
        Row: {
          id: string;
          code: string;
          host_id: string | null;
          session_id: string | null;
          status: 'waiting' | 'active' | 'finished';
          current_question_id: string | null;
          question_count: number;
          created_at: string;
          started_at: string | null;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          host_id?: string | null;
          session_id?: string | null;
          status?: 'waiting' | 'active' | 'finished';
          current_question_id?: string | null;
          question_count?: number;
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          host_id?: string | null;
          session_id?: string | null;
          status?: 'waiting' | 'active' | 'finished';
          current_question_id?: string | null;
          question_count?: number;
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
        };
      };
      users: {
        Row: {
          id: string;
          username: string;
          lobby_id: string;
          is_host: boolean;
          created_at: string;
          last_active_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          lobby_id: string;
          is_host?: boolean;
          created_at?: string;
          last_active_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          lobby_id?: string;
          is_host?: boolean;
          created_at?: string;
          last_active_at?: string;
        };
      };
      question_instances: {
        Row: {
          id: string;
          lobby_id: string;
          question_id: string;
          state: QuestionState;
          triggered_at: string;
          locked_at: string | null;
          resolved_at: string | null;
          closed_at: string | null;
          trigger_snapshot: Json;
          window_size: number;
          answer: 'YES' | 'NO' | null;
          outcome: boolean | null;
          explanation: string | null;
          cancelled_reason: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          lobby_id: string;
          question_id: string;
          state?: QuestionState;
          triggered_at?: string;
          locked_at?: string | null;
          resolved_at?: string | null;
          closed_at?: string | null;
          trigger_snapshot: Json;
          window_size: number;
          answer?: 'YES' | 'NO' | null;
          outcome?: boolean | null;
          explanation?: string | null;
          cancelled_reason?: string | null;
          cancelled_at?: string | null;
        };
        Update: {
          id?: string;
          lobby_id?: string;
          question_id?: string;
          state?: QuestionState;
          triggered_at?: string;
          locked_at?: string | null;
          resolved_at?: string | null;
          closed_at?: string | null;
          trigger_snapshot?: Json;
          window_size?: number;
          answer?: 'YES' | 'NO' | null;
          outcome?: boolean | null;
          explanation?: string | null;
          cancelled_reason?: string | null;
          cancelled_at?: string | null;
        };
      };
      answers: {
        Row: {
          id: string;
          instance_id: string;
          user_id: string;
          answer: 'YES' | 'NO';
          submitted_at: string;
          response_time_ms: number | null;
        };
        Insert: {
          id?: string;
          instance_id: string;
          user_id: string;
          answer: 'YES' | 'NO';
          submitted_at?: string;
          response_time_ms?: number | null;
        };
        Update: {
          id?: string;
          instance_id?: string;
          user_id?: string;
          answer?: 'YES' | 'NO';
          submitted_at?: string;
          response_time_ms?: number | null;
        };
      };
      leaderboard: {
        Row: {
          id: string;
          lobby_id: string;
          user_id: string;
          points: number;
          streak: number;
          max_streak: number;
          correct_answers: number;
          wrong_answers: number;
          questions_answered: number;
          accuracy: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lobby_id: string;
          user_id: string;
          points?: number;
          streak?: number;
          max_streak?: number;
          correct_answers?: number;
          wrong_answers?: number;
          questions_answered?: number;
          accuracy?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lobby_id?: string;
          user_id?: string;
          points?: number;
          streak?: number;
          max_streak?: number;
          correct_answers?: number;
          wrong_answers?: number;
          questions_answered?: number;
          accuracy?: number;
          updated_at?: string;
        };
      };
    };
    Functions: {
      update_leaderboard: {
        Args: {
          p_lobby_id: string;
          p_user_id: string;
          p_points_change: number;
          p_is_correct: boolean;
        };
        Returns: void;
      };
    };
  };
}

export type QuestionState =
  | 'TRIGGERED'
  | 'LIVE'
  | 'LOCKED'
  | 'ACTIVE'
  | 'RESOLVED'
  | 'EXPLAINED'
  | 'CLOSED'
  | 'CANCELLED';

export type Lobby = Database['public']['Tables']['lobbies']['Row'];
export type User = Database['public']['Tables']['users']['Row'];
export type QuestionInstance = Database['public']['Tables']['question_instances']['Row'];
export type Answer = Database['public']['Tables']['answers']['Row'];
export type LeaderboardEntry = Database['public']['Tables']['leaderboard']['Row'];