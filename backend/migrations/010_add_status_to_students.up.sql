-- Migration: Add Status to Students
-- Purpose: Track the lifecycle of PKL student profiles (ACTIVE, COMPLETED, ARCHIVED)
ALTER TABLE pkl_students ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
