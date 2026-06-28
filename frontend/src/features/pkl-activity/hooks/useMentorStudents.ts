/**
 * @file hooks/useMentorStudents.ts
 * @description React Query custom hook for fetching mentor's student list with daily evaluations.
 */

import { useQuery } from "@tanstack/react-query";
import { mentorService } from "../services/mentor.service";
import { QUERY_KEYS } from "../constants";

export const useMentorStudents = (date?: string) => {
  const query = useQuery({
    queryKey: [QUERY_KEYS.MENTOR_STUDENTS, date],
    queryFn: () => mentorService.getStudents(date).then(res => res.data),
    staleTime: 5000, // 5 seconds cache fresh time
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};
