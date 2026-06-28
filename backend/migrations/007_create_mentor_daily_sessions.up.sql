-- Migration: Create Mentor Daily Sessions Table
-- Purpose: Store status submit evaluasi harian mentor
CREATE TABLE IF NOT EXISTS pkl_mentor_daily_sessions (
  id VARCHAR(50) PRIMARY KEY,
  mentor_id VARCHAR(50) NOT NULL,
  session_date DATE NOT NULL,
  is_submitted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_mentor_session_date UNIQUE (mentor_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_pkl_mentor_daily_sessions_lookup ON pkl_mentor_daily_sessions(mentor_id, session_date);
