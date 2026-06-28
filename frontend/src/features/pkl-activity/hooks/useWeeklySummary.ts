/**
 * @file hooks/useWeeklySummary.ts
 * @description React Query custom hook for fetching weekly rekap summaries by week number.
 */

import { useQuery } from "@tanstack/react-query";
import { mentorService } from "../services/mentor.service";
import { QUERY_KEYS } from "../constants";

export const useWeeklySummary = (weekNumber: number) => {
  const query = useQuery({
    queryKey: [QUERY_KEYS.WEEKLY_REKAP, weekNumber],
    queryFn: () => mentorService.getWeeklyRekap(weekNumber).then(res => res.data),
    staleTime: 5000,
    enabled: !isNaN(weekNumber) && weekNumber > 0, // only run query if valid week number
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};
