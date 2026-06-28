-- Migration: Create Student Tasks Table
-- Purpose: Store status penyelesaian program kerja siswa
CREATE TABLE IF NOT EXISTS pkl_student_tasks (
  id VARCHAR(50) PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  task_id VARCHAR(50) NOT NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES pkl_students(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES pkl_program_tasks(id) ON DELETE CASCADE,
  CONSTRAINT uq_student_task UNIQUE (student_id, task_id)
);
