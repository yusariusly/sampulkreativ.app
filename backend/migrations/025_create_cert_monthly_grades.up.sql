-- Migration 025: Certificate Monthly Grades
-- Purpose: Menyimpan nilai aktivitas bulanan per siswa yang diinput manual oleh admin
CREATE TABLE IF NOT EXISTS cert_monthly_grades (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  curriculum_id VARCHAR(50) NOT NULL,
  month_number INT NOT NULL CHECK (month_number BETWEEN 1 AND 24),
  activity_score DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (activity_score BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, curriculum_id, month_number),
  FOREIGN KEY (student_id) REFERENCES pkl_students(id) ON DELETE CASCADE,
  FOREIGN KEY (curriculum_id) REFERENCES pkl_program_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cert_monthly_grades_student ON cert_monthly_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_cert_monthly_grades_curriculum ON cert_monthly_grades(curriculum_id);
