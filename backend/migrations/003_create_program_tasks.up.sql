-- Migration: Create Program Tasks Table
-- Purpose: Store rincian tugas operasional mingguan
CREATE TABLE IF NOT EXISTS pkl_program_tasks (
  id VARCHAR(50) PRIMARY KEY,
  week_id VARCHAR(50) NOT NULL,
  task_title VARCHAR(255) NOT NULL,
  is_mandatory TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (week_id) REFERENCES pkl_program_weeks(id) ON DELETE CASCADE
);
