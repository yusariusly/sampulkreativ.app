/**
 * @file components/StudentHistoryView.tsx
 * @description Encapsulates the student weekly evaluation history UI to render inside user/history/page.tsx.
 */

import React from "react";
import { History } from "lucide-react";
import { useStudentHistory } from "../hooks/useStudentHistory";
import { WeeklyAccordionItem } from "./WeeklyAccordionItem";
import { SkeletonCard } from "./SkeletonCard";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

export const StudentHistoryView: React.FC = () => {
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    refetch: refetchHistory
  } = useStudentHistory();

  return (
    <div className="flex flex-col h-full bg-[#F0F2F5]">
      {/* Header Panel */}
      <div className="flex items-center justify-center gap-2.5 py-5 px-5 select-none bg-[#2AB0B2] shadow-sm">
        <History size={20} color="white" />
        <h1 className="text-white font-bold text-lg">Riwayat Evaluasi PKL</h1>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isHistoryLoading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : isHistoryError ? (
          <ErrorState onRetry={refetchHistory} message="Gagal mengambil riwayat mingguan." />
        ) : historyData && historyData.length > 0 ? (
          <div className="space-y-1.5">
            {historyData.map((item) => (
              <WeeklyAccordionItem key={item.week_number} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={History}
            title="Belum Ada Riwayat"
            description="Evaluasi mingguan resmi yang telah dipublikasikan akan terarsipkan di sini."
          />
        )}
      </div>

      <p className="text-[10px] text-gray-400 text-center py-4 select-none">
        © 2026 sampulkreativ · sampulkreativ.app · All rights reserved
      </p>
    </div>
  );
};
export default StudentHistoryView;
