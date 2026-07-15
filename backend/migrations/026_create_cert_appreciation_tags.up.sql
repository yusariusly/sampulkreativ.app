-- Migration 026: Certificate Appreciation Tags
-- Purpose: Master data tag apresiasi yang bisa dikustomisasi admin untuk penilaian sertifikat
CREATE TABLE IF NOT EXISTS cert_appreciation_tags (
  id SERIAL PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cert_appreciation_tags (label, sort_order) VALUES
  ('Sangat Disiplin', 1),
  ('Inisiatif Tinggi', 2),
  ('Kerja Sama Bagus', 3),
  ('Hasil Kerja Rapi', 4),
  ('Sopan & Santun', 5),
  ('Problem Solver', 6),
  ('Tepat Waktu', 7),
  ('Fokus & Teliti', 8)
ON CONFLICT DO NOTHING;
