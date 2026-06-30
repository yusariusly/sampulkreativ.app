-- Migration: Add auto_show_recipients to pkl_notices table
-- Purpose: Control automatic display of reward and punishment recipients starting Friday 15:00 WIB

ALTER TABLE pkl_notices ADD COLUMN IF NOT EXISTS auto_show_recipients BOOLEAN DEFAULT TRUE;
