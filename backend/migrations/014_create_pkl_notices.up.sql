CREATE TABLE IF NOT EXISTS pkl_notices (
  id SERIAL PRIMARY KEY,
  week_number INT NOT NULL UNIQUE,
  reward_title VARCHAR(255) NOT NULL,
  reward_description TEXT NOT NULL,
  prize_name VARCHAR(255) NOT NULL,
  prize_image_url TEXT NULL,
  show_congrats BOOLEAN DEFAULT FALSE,
  show_recipients BOOLEAN DEFAULT TRUE,
  punishment_title VARCHAR(255) NOT NULL,
  punishment_description TEXT NOT NULL,
  consequence VARCHAR(255) NOT NULL,
  consequence_image_url TEXT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
