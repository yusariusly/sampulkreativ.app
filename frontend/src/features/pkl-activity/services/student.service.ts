/**
 * @file services/student.service.ts
 * @description Frontend API Services for PKL Student domain.
 */

import { apiClient } from "../utils/api-client";
import { API_ENDPOINTS } from "../constants";
import { BaseResponse, StudentDashboardData, StudentHistoryItem } from "../types";

export const studentService = {
  /**
   * Mengambil data dashboard aktif siswa magang
   */
  getDashboard(date?: string): Promise<BaseResponse<StudentDashboardData>> {
    return apiClient.get<BaseResponse<StudentDashboardData>>(
      API_ENDPOINTS.STUDENT_DASHBOARD, 
      date ? { params: { date } } : undefined
    );
  },

  /**
   * Mengambil riwayat poin mingguan siswa magang yang sudah diterbitkan
   */
  getHistory(): Promise<BaseResponse<StudentHistoryItem[]>> {
    return apiClient.get<BaseResponse<StudentHistoryItem[]>>(API_ENDPOINTS.STUDENT_HISTORY);
  },

  /**
   * Mengubah status checklist tugas program kerja mandiri oleh siswa
   */
  toggleTask(taskId: string, is_completed: boolean): Promise<BaseResponse<{ success: boolean }>> {
    return apiClient.patch<BaseResponse<{ success: boolean }>>(
      API_ENDPOINTS.STUDENT_TOGGLE_TASK(taskId),
      { is_completed }
    );
  }
};
