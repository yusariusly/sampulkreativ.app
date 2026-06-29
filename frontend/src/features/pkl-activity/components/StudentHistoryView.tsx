/**
 * @file components/StudentHistoryView.tsx
 * @description Encapsulates the student weekly evaluation history UI to render inside user/history/page.tsx.
 */

import React from "react";
import { useRouter } from "next/navigation";
import { History, ArrowLeft } from "lucide-react";
import { useStudentHistory } from "../hooks/useStudentHistory";
import { WeeklyAccordionItem } from "./WeeklyAccordionItem";
import { SkeletonCard } from "./SkeletonCard";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

export const StudentHistoryView: React.FC = () => {
  const router = useRouter();
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    refetch: refetchHistory
  } = useStudentHistory();

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header Panel */}
      <div className="flex items-center justify-between py-4 px-5 select-none bg-[#2AB0B2] shadow-sm text-white">
        <button
          onClick={() => router.push("/user?view=pkl")}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
        >
          <ArrowLeft size={16} /> Kembali
        </button>
        <div className="flex items-center gap-2">
          <History size={18} />
          <h1 className="font-bold text-sm">Riwayat Evaluasi PKL</h1>
        </div>
        <div className="w-16" />
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
