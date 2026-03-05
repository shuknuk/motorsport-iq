-- Motorsport IQ Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (linked to lobbies)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL,
    lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
    is_host BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(lobby_id, username)
);

-- Lobbies table
CREATE TABLE IF NOT EXISTS lobbies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(6) UNIQUE NOT NULL,
    host_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(50), -- OpenF1 session ID
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, active, finished
    current_question_id UUID, -- Currently active question instance
    question_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE
);

-- Drop the users table and recreate with proper foreign key
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL,
    lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
    is_host BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(lobby_id, username)
);

-- Question instances (triggered questions with full lifecycle)
CREATE TABLE IF NOT EXISTS question_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
    question_id VARCHAR(50) NOT NULL, -- Reference to question bank ID
    state VARCHAR(20) DEFAULT 'TRIGGERED', -- TRIGGERED, LIVE, LOCKED, ACTIVE, RESOLVED, EXPLAINED, CLOSED
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    locked_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    trigger_snapshot JSONB NOT NULL, -- Full RaceSnapshot at trigger time
    window_size INTEGER NOT NULL, -- Number of laps to resolve
    answer VARCHAR(3), -- 'YES' or 'NO' (the correct answer)
    outcome BOOLEAN, -- True if the prediction came true
    explanation TEXT,
    cancelled_reason VARCHAR(50), -- If cancelled, the reason
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Answers table (user submissions)
CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES question_instances(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    answer VARCHAR(3) NOT NULL, -- 'YES' or 'NO'
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_ms INTEGER, -- Time from question live to answer
    UNIQUE(instance_id, user_id) -- One answer per user per question
);

-- Leaderboard table (cached scores per lobby)
CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    wrong_answers INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    accuracy DECIMAL(5,2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(lobby_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_lobby_id ON users(lobby_id);
CREATE INDEX IF NOT EXISTS idx_question_instances_lobby_id ON question_instances(lobby_id);
CREATE INDEX IF NOT EXISTS idx_question_instances_state ON question_instances(state);
CREATE INDEX IF NOT EXISTS idx_answers_instance_id ON answers(instance_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_lobby_id ON leaderboard(lobby_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_code ON lobbies(code);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);

-- Function to update leaderboard
CREATE OR REPLACE FUNCTION update_leaderboard(
    p_lobby_id UUID,
    p_user_id UUID,
    p_points_change INTEGER,
    p_is_correct BOOLEAN
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO leaderboard (lobby_id, user_id, points, streak, max_streak, correct_answers, wrong_answers, questions_answered, accuracy)
    VALUES (
        p_lobby_id,
        p_user_id,
        p_points_change,
        CASE WHEN p_is_correct THEN 1 ELSE 0 END,
        CASE WHEN p_is_correct THEN 1 ELSE 0 END,
        CASE WHEN p_is_correct THEN 1 ELSE 0 END,
        CASE WHEN NOT p_is_correct THEN 1 ELSE 0 END,
        1,
        CASE WHEN p_is_correct THEN 100.00 ELSE 0.00 END
    )
    ON CONFLICT (lobby_id, user_id)
    DO UPDATE SET
        points = leaderboard.points + p_points_change,
        streak = CASE
            WHEN p_is_correct THEN leaderboard.streak + 1
            ELSE 0
        END,
        max_streak = CASE
            WHEN p_is_correct AND leaderboard.streak + 1 > leaderboard.max_streak
            THEN leaderboard.streak + 1
            ELSE leaderboard.max_streak
        END,
        correct_answers = leaderboard.correct_answers + CASE WHEN p_is_correct THEN 1 ELSE 0 END,
        wrong_answers = leaderboard.wrong_answers + CASE WHEN NOT p_is_correct THEN 1 ELSE 0 END,
        questions_answered = leaderboard.questions_answered + 1,
        accuracy = CASE
            WHEN leaderboard.questions_answered + 1 > 0
            THEN ROUND((leaderboard.correct_answers + CASE WHEN p_is_correct THEN 1 ELSE 0 END)::DECIMAL / (leaderboard.questions_answered + 1) * 100, 2)
            ELSE 0.00
        END,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Public read policies (for anonymous users in lobbies)
CREATE POLICY "Anyone can read lobbies" ON lobbies FOR SELECT USING (true);
CREATE POLICY "Anyone can read users" ON users FOR SELECT USING (true);
CREATE POLICY "Anyone can read question instances" ON question_instances FOR SELECT USING (true);
CREATE POLICY "Anyone can read answers" ON answers FOR SELECT USING (true);
CREATE POLICY "Anyone can read leaderboard" ON leaderboard FOR SELECT USING (true);

-- Insert policies (server-side with service role)
-- These are permissive for MVP; tighten for production
CREATE POLICY "Anyone can insert lobbies" ON lobbies FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert question instances" ON question_instances FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert answers" ON answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert leaderboard" ON leaderboard FOR INSERT WITH CHECK (true);

-- Update policies
CREATE POLICY "Anyone can update lobbies" ON lobbies FOR UPDATE USING (true);
CREATE POLICY "Anyone can update users" ON users FOR UPDATE USING (true);
CREATE POLICY "Anyone can update question instances" ON question_instances FOR UPDATE USING (true);
CREATE POLICY "Anyone can update leaderboard" ON leaderboard FOR UPDATE USING (true);