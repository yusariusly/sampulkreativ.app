/**
 * @file index.ts
 * @description Entry point for the PKL Activity feature module.
 * Exports types, constants, services, and React Query custom hooks.
 */

// Export Types
export * from "./types";

// Export Constants
export * from "./constants";

// Export Services
export { studentService } from "./services/student.service";
export { mentorService } from "./services/mentor.service";
export { savingsService } from "./services/savings.service";

// Export Hooks
export { useStudentDashboard } from "./hooks/useStudentDashboard";
export { useStudentHistory } from "./hooks/useStudentHistory";
export { useMentorStudents } from "./hooks/useMentorStudents";
export { useWeeklySummary } from "./hooks/useWeeklySummary";
export { useDailyEvaluation } from "./hooks/useDailyEvaluation";
export { usePublishWeeklySummary } from "./hooks/usePublishWeeklySummary";

// Export Provider
export { default as QueryProvider } from "./providers/QueryProvider";

// Export Components
export { StudentDashboardView } from "./components/StudentDashboardView";
export { StudentHistoryView } from "./components/StudentHistoryView";
export { WeeklyAccordionItem } from "./components/WeeklyAccordionItem";
export { SkeletonCard } from "./components/SkeletonCard";
export { EmptyState } from "./components/EmptyState";
export { ErrorState } from "./components/ErrorState";
export { SavingsProgressBar } from "./components/SavingsProgressBar";
