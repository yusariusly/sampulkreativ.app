-- Migration: Add kie_progress_override to pkl_students
ALTER TABLE pkl_students ADD COLUMN IF NOT EXISTS kie_progress_override INT DEFAULT NULL;
