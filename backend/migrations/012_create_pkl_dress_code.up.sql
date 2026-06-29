-- Migration: Create PKL Dress Code Schedule Table
-- Purpose: Dynamic customization of daily dress codes for PKL students (Monday - Friday)

CREATE TABLE IF NOT EXISTS pkl_dress_code (
  day_number INT PRIMARY KEY, -- 1: Senin, 2: Selasa, 3: Rabu, 4: Kamis, 5: Jumat
  day_name VARCHAR(15) NOT NULL,
  clothes_description VARCHAR(255) NOT NULL
);

-- Insert Default Values
INSERT INTO pkl_dress_code (day_number, day_name, clothes_description) VALUES
(1, 'Senin', 'Kemeja Putih & Celana Bahan Hitam'),
(2, 'Selasa', 'Kemeja Putih & Celana Bahan Hitam'),
(3, 'Rabu', 'Wearpack Kejuruan'),
(4, 'Kamis', 'Wearpack Kejuruan'),
(5, 'Jumat', 'Batik & Celana Bahan Hitam')
ON CONFLICT (day_number) DO NOTHING;
