-- Migration: Split User Role to Student and Employee
-- Purpose: Set role = 'student' for PKL students, and role = 'employee' for regular employees (users who are not PKL students)

UPDATE users 
SET role = CASE 
  WHEN EXISTS (SELECT 1 FROM pkl_students WHERE pkl_students.user_id = users.id) THEN 'student'
  ELSE 'employee'
END
WHERE role = 'user';
