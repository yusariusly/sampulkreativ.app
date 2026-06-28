-- Migration: Create Weekly Summaries Table
-- Purpose: Store rekapitulasi mingguan, catatan, tag, dan status publish
CREATE TABLE IF NOT EXISTS pkl_weekly_summaries (
  id VARCHAR(50) PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  week_number INT NOT NULL,
  total_points INT NOT NULL DEFAULT 0,
  comments TEXT NULL,
  tags TEXT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES pkl_students(id) ON DELETE CASCADE,
  CONSTRAINT uq_student_week_summary UNIQUE (student_id, week_number),
  CONSTRAINT chk_weekly_total_points CHECK (total_points BETWEEN 0 AND 25)
);

CREATE INDEX IF NOT EXISTS idx_pkl_weekly_summaries_lookup ON pkl_weekly_summaries(student_id, week_number);
