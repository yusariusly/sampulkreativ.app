-- Migration: Create KIE Submissions Table
-- Purpose: Menyimpan data kirim API KIE AI oleh pengguna
CREATE TABLE IF NOT EXISTS kie_submissions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  api_key VARCHAR(32) NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
