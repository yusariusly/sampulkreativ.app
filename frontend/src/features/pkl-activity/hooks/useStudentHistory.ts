/**
 * @file hooks/useStudentHistory.ts
 * @description React Query custom hook for fetching student weekly evaluation history.
 */

import { useQuery } from "@tanstack/react-query";
import { studentService } from "../services/student.service";
import { QUERY_KEYS } from "../constants";

export const useStudentHistory = (options?: { enabled?: boolean }) => {
  const query = useQuery({
    queryKey: [QUERY_KEYS.STUDENT_HISTORY],
    queryFn: () => studentService.getHistory().then(res => res.data),
    staleTime: 30000, // 30 seconds cache fresh time
    ...options,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};
