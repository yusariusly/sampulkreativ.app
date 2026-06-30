-- Migration: Drop Weekly Summary Total Points Check Constraint
-- Purpose: Support weekly total points greater than 25 now that daily points can be up to 25 per aspect

ALTER TABLE pkl_weekly_summaries DROP CONSTRAINT IF EXISTS chk_weekly_total_points;
