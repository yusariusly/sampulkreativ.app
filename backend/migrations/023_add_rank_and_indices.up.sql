-- Migration: Add rank column and optimization indices
-- Purpose: Optimize scoreboard history and weekly summary queries
ALTER TABLE pkl_weekly_summaries ADD COLUMN IF NOT EXISTS rank INT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_pkl_daily_evaluations_date ON pkl_daily_evaluations(evaluation_date);
CREATE INDEX IF NOT EXISTS idx_pkl_weekly_summaries_published ON pkl_weekly_summaries(is_published, week_number);
