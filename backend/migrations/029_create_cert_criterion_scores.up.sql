-- Migration 029: Certificate Criterion Scores
-- Purpose: Nilai per kriteria, per bulan, per siswa
CREATE TABLE IF NOT EXISTS cert_criterion_scores (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  curriculum_id VARCHAR(50) NOT NULL,
  month_number INT NOT NULL CHECK (month_number BETWEEN 1 AND 24),
  criterion_id INT NOT NULL,
  score DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, curriculum_id, month_number, criterion_id),
  FOREIGN KEY (criterion_id) REFERENCES cert_grade_criteria(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cert_criterion_scores_student ON cert_criterion_scores(student_id, curriculum_id);
CREATE INDEX IF NOT EXISTS idx_cert_criterion_scores_month ON cert_criterion_scores(student_id, curriculum_id, month_number);
