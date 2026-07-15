-- Migration 028: Certificate Grade Criteria (Master Data)
-- Purpose: Kriteria penilaian yang bisa dikustomisasi admin (nama bisa diubah, urutan, aktif/nonaktif)
CREATE TABLE IF NOT EXISTS cert_grade_criteria (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cert_grade_criteria (name, sort_order) VALUES
  ('Kerapihan', 1),
  ('Kreativitas', 2),
  ('Kedisiplinan', 3),
  ('Kerja Sama', 4),
  ('Inisiatif', 5)
ON CONFLICT DO NOTHING;
