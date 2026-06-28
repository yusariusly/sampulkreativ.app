-- Migration: Revert Split User Role
-- Purpose: Change 'student' and 'employee' roles back to 'user'

UPDATE users
SET role = 'user'
WHERE role IN ('student', 'employee');
