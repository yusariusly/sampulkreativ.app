/**
 * @file hooks/useStudentDashboard.ts
 * @description React Query custom hook for fetching student dashboard data and toggling tasks with optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studentService } from "../services/student.service";
import { QUERY_KEYS } from "../constants";
import { BaseResponse, StudentDashboardData } from "../types";

export const useStudentDashboard = (date?: string, options?: { enabled?: boolean }) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEYS.STUDENT_DASHBOARD, date],
    queryFn: () => studentService.getDashboard(date).then(res => res.data),
    staleTime: 5000,
    ...options,
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) =>
      studentService.toggleTask(taskId, isCompleted).then(res => res.data),
    
    // Optimistic Update
    onMutate: async ({ taskId, isCompleted }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.STUDENT_DASHBOARD, date] });

      // Snapshot the previous dashboard state
      const previousDashboard = queryClient.getQueryData<BaseResponse<StudentDashboardData>>([
        QUERY_KEYS.STUDENT_DASHBOARD,
        date
      ]);

      // Optimistically update the cache
      if (previousDashboard?.data?.program_kerja?.tasks) {
        const updatedTasks = previousDashboard.data.program_kerja.tasks.map(task =>
          task.task_id === taskId ? { ...task, is_completed: isCompleted } : task
        );
        
        queryClient.setQueryData<BaseResponse<StudentDashboardData>>(
          [QUERY_KEYS.STUDENT_DASHBOARD, date],
          {
            ...previousDashboard,
            data: {
              ...previousDashboard.data,
              program_kerja: {
                ...previousDashboard.data.program_kerja,
                tasks: updatedTasks
              }
            }
          }
        );
      }

      return { previousDashboard };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousDashboard) {
        queryClient.setQueryData([QUERY_KEYS.STUDENT_DASHBOARD, date], context.previousDashboard);
      }
    },

    // Sync up with server on settlement
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STUDENT_DASHBOARD] });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    
    // Mutation fields
    toggleTask: toggleTaskMutation.mutate,
    isToggling: toggleTaskMutation.isPending,
  };
};
