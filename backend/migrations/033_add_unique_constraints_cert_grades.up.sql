-- Migration 033: Ensure unique indexes on cert_monthly_grades and cert_criterion_scores for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS uq_cert_monthly_grades
ON cert_monthly_grades (student_id, curriculum_id, month_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cert_criterion_scores
ON cert_criterion_scores (student_id, curriculum_id, month_number, criterion_id);
