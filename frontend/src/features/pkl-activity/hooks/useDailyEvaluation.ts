/**
 * @file hooks/useDailyEvaluation.ts
 * @description React Query custom hook for saving student daily evaluations and submitting daily sessions.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mentorService } from "../services/mentor.service";
import { QUERY_KEYS } from "../constants";
import { DailyEvaluationPayload, SubmitSessionPayload } from "../types";

export const useDailyEvaluation = () => {
  const queryClient = useQueryClient();

  // Mutation for saving/updating daily evaluation (Idempotent / Auto-save)
  const saveMutation = useMutation({
    mutationFn: (payload: DailyEvaluationPayload) =>
      mentorService.saveDailyEvaluation(payload).then(res => res.data),
    onSuccess: () => {
      // Invalidate student list to reflect new points
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENTOR_STUDENTS] });
    },
  });

  // Mutation for locking and submitting daily session
  const submitMutation = useMutation({
    mutationFn: (payload: SubmitSessionPayload) =>
      mentorService.submitDailySession(payload).then(res => res.data),
    onSuccess: () => {
      // Invalidate student list
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENTOR_STUDENTS] });
    },
  });

  return {
    // Save daily evaluation fields
    saveDailyEvaluation: saveMutation.mutate,
    saveDailyEvaluationAsync: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isSaveError: saveMutation.isError,
    saveError: saveMutation.error,

    // Submit session fields
    submitDailySession: submitMutation.mutate,
    submitDailySessionAsync: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    isSubmitError: submitMutation.isError,
    submitError: submitMutation.error,
  };
};
