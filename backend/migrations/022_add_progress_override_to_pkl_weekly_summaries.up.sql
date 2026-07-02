-- Migration: Add progress_override to pkl_weekly_summaries
-- Purpose: Allow admin/mentor to manually set weekly progress percentage (0-100)
ALTER TABLE pkl_weekly_summaries ADD COLUMN IF NOT EXISTS progress_override INT DEFAULT NULL;
