-- Migration 027: Certificate Student Tags
-- Purpose: Junction table - tag apresiasi yang dipilih untuk seorang siswa dalam suatu kurikulum
CREATE TABLE IF NOT EXISTS cert_student_tags (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  curriculum_id VARCHAR(50) NOT NULL,
  tag_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, curriculum_id, tag_id),
  FOREIGN KEY (tag_id) REFERENCES cert_appreciation_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cert_student_tags_student ON cert_student_tags(student_id, curriculum_id);
