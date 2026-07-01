/**
 * @file services/savings.service.ts
 * @description Frontend API Services for PKL Savings (Tabungan Buku) domain.
 */

import { apiClient } from "../utils/api-client";
import { API_ENDPOINTS } from "../constants";
import { BaseResponse, StudentSavingsData } from "../types";

export const savingsService = {
  /**
   * Mengambil data tabungan siswa yang sedang login
   */
  getStudentSavings(): Promise<BaseResponse<StudentSavingsData>> {
    return apiClient.get<BaseResponse<StudentSavingsData>>(API_ENDPOINTS.STUDENT_SAVINGS);
  },

  /**
   * Mengambil daftar tabungan seluruh siswa aktif (Admin)
   */
  adminGetSavings(): Promise<BaseResponse<StudentSavingsData[]>> {
    return apiClient.get<BaseResponse<StudentSavingsData[]>>(API_ENDPOINTS.ADMIN_SAVINGS);
  },

  /**
   * Memperbarui nominal tabungan siswa (Admin)
   */
  adminUpdateSavings(
    studentId: string,
    saved_amount: number,
    target_amount: number
  ): Promise<BaseResponse<{ success: boolean }>> {
    return apiClient.put<BaseResponse<{ success: boolean }>>(
      API_ENDPOINTS.ADMIN_UPDATE_SAVINGS(studentId),
      { saved_amount, target_amount }
    );
  },
};
