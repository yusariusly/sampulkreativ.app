-- Migration 031: Custom Certificate Student Month Intervals
-- Purpose: Menyimpan kustomisasi tanggal periode bulanan sertifikat per siswa
CREATE TABLE IF NOT EXISTS cert_student_months (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  curriculum_id VARCHAR(50) NOT NULL,
  month_number INT NOT NULL CHECK (month_number BETWEEN 1 AND 24),
  month_label VARCHAR(100) NOT NULL DEFAULT 'Bulan 1',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, curriculum_id, month_number),
  FOREIGN KEY (student_id) REFERENCES pkl_students(id) ON DELETE CASCADE,
  FOREIGN KEY (curriculum_id) REFERENCES pkl_program_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cert_student_months_lookup ON cert_student_months(student_id, curriculum_id);
