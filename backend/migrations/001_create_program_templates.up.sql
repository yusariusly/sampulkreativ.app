-- Migration: Create Program Templates Table
-- Purpose: Store kurikulum PKL bulanan (monthly templates)
CREATE TABLE IF NOT EXISTS pkl_program_templates (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  duration_months INT NOT NULL DEFAULT 4,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
