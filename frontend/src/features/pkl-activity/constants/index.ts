/**
 * @file constants/index.ts
 * @description Constants for PKL Activity frontend module, including Query Keys and API Endpoints.
 */

export const QUERY_KEYS = {
  STUDENT_DASHBOARD: 'student-dashboard',
  STUDENT_HISTORY: 'student-history',
  MENTOR_STUDENTS: 'mentor-students',
  WEEKLY_REKAP: 'weekly-rekap',
} as const;

export const API_ENDPOINTS = {
  // Student Endpoints
  STUDENT_DASHBOARD: '/api/v1/siswa/aktivitas',
  STUDENT_HISTORY: '/api/v1/siswa/riwayat',
  STUDENT_TOGGLE_TASK: (taskId: string) => `/api/v1/siswa/tugas/${taskId}`,

  // Mentor Endpoints
  MENTOR_STUDENTS: '/api/v1/mentor/siswa',
  MENTOR_SAVE_EVALUATION: '/api/v1/mentor/evaluasi-harian',
  MENTOR_SUBMIT_SESSION: '/api/v1/mentor/evaluasi-harian/kirim',
  MENTOR_WEEKLY_REKAP: '/api/v1/mentor/rekap-mingguan',
  MENTOR_SAVE_FEEDBACK: (studentId: string) => `/api/v1/mentor/rekap-mingguan/${studentId}`,
  MENTOR_PUBLISH_SUMMARY: '/api/v1/mentor/rekap-mingguan/publikasikan',
} as const;
