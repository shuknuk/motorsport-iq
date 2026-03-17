-- Migration: Expand answer column to support NO_ANSWER
-- Date: 2026-03-17
-- Description: Expands the answers.answer column from VARCHAR(3) to VARCHAR(10) to support 'NO_ANSWER' value

ALTER TABLE answers ALTER COLUMN answer TYPE VARCHAR(10);
