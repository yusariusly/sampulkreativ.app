-- Migration: Create Students Table
-- Purpose: Store data profil magang siswa PKL, berelasi ke users (siswa dan mentor) dan program template
CREATE TABLE IF NOT EXISTS pkl_students (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL UNIQUE,
  mentor_id VARCHAR(50) NOT NULL,
  program_template_id VARCHAR(50) NOT NULL,
  school_name VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (program_template_id) REFERENCES pkl_program_templates(id) ON DELETE RESTRICT,
  CONSTRAINT chk_end_after_start CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_pkl_students_user ON pkl_students(user_id);
CREATE INDEX IF NOT EXISTS idx_pkl_students_mentor ON pkl_students(mentor_id);
