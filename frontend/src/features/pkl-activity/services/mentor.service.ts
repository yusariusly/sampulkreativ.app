/**
 * @file services/mentor.service.ts
 * @description Frontend API Services for PKL Mentor domain.
 */

import { apiClient } from "../utils/api-client";
import { API_ENDPOINTS } from "../constants";
import {
  BaseResponse,
  MentorStudentCard,
  WeeklyRekapItem,
  DailyEvaluationPayload,
  SubmitSessionPayload,
  WeeklyFeedbackPayload,
  PublishSummaryPayload
} from "../types";

export const mentorService = {
  /**
   * Mengambil daftar siswa bimbingan beserta evaluasi harian
   */
  getStudents(date?: string): Promise<BaseResponse<MentorStudentCard[]>> {
    return apiClient.get<BaseResponse<MentorStudentCard[]>>(
      API_ENDPOINTS.MENTOR_STUDENTS,
      date ? { params: { date } } : undefined
    );
  },

  /**
   * Menyimpan evaluasi harian (Auto-save) untuk siswa tertentu
   */
  saveDailyEvaluation(payload: DailyEvaluationPayload): Promise<BaseResponse<{ success: boolean }>> {
    return apiClient.put<BaseResponse<{ success: boolean }>>(
      API_ENDPOINTS.MENTOR_SAVE_EVALUATION,
      payload
    );
  },

  /**
   * Mengunci dan mengirim seluruh sesi evaluasi harian
   */
  submitDailySession(payload: SubmitSessionPayload): Promise<BaseResponse<{ success: boolean }>> {
    return apiClient.post<BaseResponse<{ success: boolean }>>(
      API_ENDPOINTS.MENTOR_SUBMIT_SESSION,
      payload
    );
  },

  /**
   * Mengambil draf rekap mingguan siswa bimbingan mentor pada minggu tertentu
   */
  getWeeklyRekap(weekNumber: number): Promise<BaseResponse<WeeklyRekapItem[]>> {
    return apiClient.get<BaseResponse<WeeklyRekapItem[]>>(
      API_ENDPOINTS.MENTOR_WEEKLY_REKAP,
      { params: { week_number: weekNumber } }
    );
  },

  /**
   * Menyimpan draf feedback mingguan (tags & comments) untuk siswa tertentu
   */
  saveWeeklyFeedback(studentId: string, payload: WeeklyFeedbackPayload): Promise<BaseResponse<{ success: boolean; warning: string | null }>> {
    return apiClient.put<BaseResponse<{ success: boolean; warning: string | null }>>(
      API_ENDPOINTS.MENTOR_SAVE_FEEDBACK(studentId),
      payload
    );
  },

  /**
   * Mempublikasikan rekap poin mingguan ke dashboard siswa
   */
  publishWeeklySummary(payload: PublishSummaryPayload): Promise<BaseResponse<{ success: boolean }>> {
    return apiClient.post<BaseResponse<{ success: boolean }>>(
      API_ENDPOINTS.MENTOR_PUBLISH_SUMMARY,
      payload
    );
  }
};
