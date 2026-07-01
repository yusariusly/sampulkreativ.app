/**
 * @file components/SavingsProgressBar.tsx
 * @description Compact savings progress bar notice for PKL students (Tabungan Buku).
 * Auto-hides when savings target is reached. Uses React Query polling for pseudo-realtime sync.
 */

"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { savingsService } from "../services/savings.service";
import { QUERY_KEYS } from "../constants";
import type { BaseResponse, StudentSavingsData } from "../types";

const POLLING_INTERVAL_MS = 30_000; // Refetch setiap 30 detik untuk pseudo-realtime

/**
 * Format angka ke format Rupiah (Rp 45.000)
 */
function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function SavingsProgressBar() {
  const { data: savings, isLoading } = useQuery<BaseResponse<StudentSavingsData>>({
    queryKey: [QUERY_KEYS.STUDENT_SAVINGS],
    queryFn: () => savingsService.getStudentSavings(),
    staleTime: POLLING_INTERVAL_MS,
    refetchInterval: POLLING_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  // Jangan tampilkan saat loading atau error
  if (isLoading || !savings?.data) return null;

  const { saved_amount, target_amount } = savings.data;

  // Sembunyikan jika sudah lunas
  if (saved_amount >= target_amount) return null;

  const percentage = Math.min(Math.round((saved_amount / target_amount) * 100), 100);

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 flex-shrink-0 select-none">
      {/* Header row: icon + label + amounts */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0">
            <BookOpen size={11} className="text-amber-600 stroke-[2.5px]" />
          </div>
          <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">
            Tabungan Buku
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-500">
          {formatRupiah(saved_amount)}{" "}
          <span className="text-slate-300">/</span>{" "}
          {formatRupiah(target_amount)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: percentage >= 80 ? "#0d9488" : "#2AB0B2",
          }}
        />
      </div>

      {/* Footer: percentage + motivational hint */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] font-semibold text-slate-400">
          {percentage >= 80
            ? "Hampir selesai, semangat! 🎉"
            : percentage >= 50
              ? "Sudah lewat setengah jalan! 💪"
              : "Yuk nabung tiap hari biar cepat lunas!"}
        </span>
        <span className="text-[9px] font-black text-[#2AB0B2]">
          {percentage}%
        </span>
      </div>
    </div>
  );
}
