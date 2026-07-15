-- Migration 024: Certificate Curriculum Settings
-- Purpose: Simpan konfigurasi penilaian sertifikat per kurikulum (bobot aktivitas, bobot KIE, label aspek)
CREATE TABLE IF NOT EXISTS cert_curriculum_settings (
  id SERIAL PRIMARY KEY,
  curriculum_id VARCHAR(50) NOT NULL UNIQUE,
  activity_weight INT NOT NULL DEFAULT 50,
  kie_weight INT NOT NULL DEFAULT 50,
  aspect_label VARCHAR(100) NOT NULL DEFAULT 'Kedisiplinan',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (curriculum_id) REFERENCES pkl_program_templates(id) ON DELETE CASCADE
);
