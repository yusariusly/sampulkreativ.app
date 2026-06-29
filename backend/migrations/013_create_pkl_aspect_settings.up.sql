-- Migration: Create PKL Aspect Settings Table
-- Purpose: Dynamic customization of evaluation aspects without database column restructure (Dynamic Metadata Mapping)

CREATE TABLE IF NOT EXISTS pkl_aspect_settings (
  aspect_key VARCHAR(20) PRIMARY KEY, -- wkt_point, skp_point, has_point, ker_point, ini_point
  label VARCHAR(50) NOT NULL,
  icon_name VARCHAR(50) NOT NULL, -- Clock, Smile, CheckSquare, User, Sparkles
  is_active SMALLINT NOT NULL DEFAULT 1 -- 1: Active, 0: Disabled
);

-- Insert Default Values
INSERT INTO pkl_aspect_settings (aspect_key, label, icon_name, is_active) VALUES
('wkt_point', 'Ketepatan Waktu (WKT)', 'Clock', 1),
('skp_point', 'Sikap & Perilaku (SKP)', 'Smile', 1),
('has_point', 'Hasil Kerja (HAS)', 'CheckSquare', 1),
('ker_point', 'Kerapian Kerja (KER)', 'User', 1),
('ini_point', 'Inisiatif Kerja (INI)', 'Sparkles', 1)
ON CONFLICT (aspect_key) DO NOTHING;
