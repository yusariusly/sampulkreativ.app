-- Migration: Drop Daily Evaluation Check Constraints
-- Purpose: Support points value between 0 and 25 per aspect instead of 0 or 1 binary constraint

ALTER TABLE pkl_daily_evaluations DROP CONSTRAINT IF EXISTS chk_wkt_point;
ALTER TABLE pkl_daily_evaluations DROP CONSTRAINT IF EXISTS chk_skp_point;
ALTER TABLE pkl_daily_evaluations DROP CONSTRAINT IF EXISTS chk_has_point;
ALTER TABLE pkl_daily_evaluations DROP CONSTRAINT IF EXISTS chk_ker_point;
ALTER TABLE pkl_daily_evaluations DROP CONSTRAINT IF EXISTS chk_ini_point;
