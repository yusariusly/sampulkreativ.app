/**
 * @file hooks/usePublishWeeklySummary.ts
 * @description React Query custom hook for saving draft feedback and publishing weekly summary to student dashboard.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mentorService } from "../services/mentor.service";
import { QUERY_KEYS } from "../constants";
import { WeeklyFeedbackPayload, PublishSummaryPayload } from "../types";

export const usePublishWeeklySummary = () => {
  const queryClient = useQueryClient();

  // Mutation for saving/drafting weekly feedback comments & tags
  const saveFeedbackMutation = useMutation({
    mutationFn: ({ studentId, payload }: { studentId: string; payload: WeeklyFeedbackPayload }) =>
      mentorService.saveWeeklyFeedback(studentId, payload).then(res => res.data),
    onSuccess: (_, variables) => {
      // Invalidate specific week summary
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.WEEKLY_REKAP, variables.payload.week_number]
      });
    },
  });

  // Mutation for publishing the weekly summaries for all students
  const publishMutation = useMutation({
    mutationFn: (payload: PublishSummaryPayload) =>
      mentorService.publishWeeklySummary(payload).then(res => res.data),
    onSuccess: (_, variables) => {
      // Invalidate the published week summaries
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.WEEKLY_REKAP, variables.week_number]
      });
      // Invalidate history query key just in case it is loaded
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STUDENT_HISTORY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STUDENT_DASHBOARD] });
    },
  });

  return {
    // Save draft feedback fields
    saveWeeklyFeedback: saveFeedbackMutation.mutate,
    saveWeeklyFeedbackAsync: saveFeedbackMutation.mutateAsync,
    isSavingFeedback: saveFeedbackMutation.isPending,
    isSaveFeedbackError: saveFeedbackMutation.isError,
    saveFeedbackError: saveFeedbackMutation.error,

    // Publish weekly summary fields
    publishWeeklySummary: publishMutation.mutate,
    publishWeeklySummaryAsync: publishMutation.mutateAsync,
    isPublishing: publishMutation.isPending,
    isPublishError: publishMutation.isError,
    publishError: publishMutation.error,
  };
};
