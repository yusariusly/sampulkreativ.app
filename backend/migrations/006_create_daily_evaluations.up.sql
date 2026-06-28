-- Migration: Create Daily Evaluations Table
-- Purpose: Store poin aspek harian biner siswa PKL
CREATE TABLE IF NOT EXISTS pkl_daily_evaluations (
  id VARCHAR(50) PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  evaluation_date DATE NOT NULL,
  wkt_point SMALLINT NOT NULL DEFAULT 0,
  skp_point SMALLINT NOT NULL DEFAULT 0,
  has_point SMALLINT NOT NULL DEFAULT 0,
  ker_point SMALLINT NOT NULL DEFAULT 0,
  ini_point SMALLINT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES pkl_students(id) ON DELETE CASCADE,
  CONSTRAINT uq_student_eval_date UNIQUE (student_id, evaluation_date),
  CONSTRAINT chk_wkt_point CHECK (wkt_point IN (0, 1)),
  CONSTRAINT chk_skp_point CHECK (skp_point IN (0, 1)),
  CONSTRAINT chk_has_point CHECK (has_point IN (0, 1)),
  CONSTRAINT chk_ker_point CHECK (ker_point IN (0, 1)),
  CONSTRAINT chk_ini_point CHECK (ini_point IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_pkl_daily_evaluations_lookup ON pkl_daily_evaluations(student_id, evaluation_date);
