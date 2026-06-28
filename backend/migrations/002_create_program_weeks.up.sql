-- Migration: Create Program Weeks Table
-- Purpose: Store milestone mingguan target di bawah program template
CREATE TABLE IF NOT EXISTS pkl_program_weeks (
  id VARCHAR(50) PRIMARY KEY,
  template_id VARCHAR(50) NOT NULL,
  week_number INT NOT NULL,
  month_number INT NOT NULL,
  milestone_title VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES pkl_program_templates(id) ON DELETE CASCADE,
  CONSTRAINT uq_template_week UNIQUE (template_id, week_number)
);
