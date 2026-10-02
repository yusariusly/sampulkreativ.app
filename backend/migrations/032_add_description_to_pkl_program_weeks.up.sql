-- Migration: Add description to pkl_program_weeks
-- Purpose: Store detailed description for weekly activity / task
ALTER TABLE pkl_program_weeks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;
