-- Migration: Create PKL Savings Table
-- Purpose: Menyimpan data progres tabungan buku siswa PKL, berelasi ke pkl_students
CREATE TABLE IF NOT EXISTS pkl_savings (
  student_id VARCHAR(50) PRIMARY KEY,
  saved_amount INT NOT NULL DEFAULT 0,
  target_amount INT NOT NULL DEFAULT 70000,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES pkl_students(id) ON DELETE CASCADE
);
