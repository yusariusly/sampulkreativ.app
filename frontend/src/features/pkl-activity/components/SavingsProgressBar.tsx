/**
 * @file components/SavingsProgressBar.tsx
 * @description Compact savings progress bar notice for PKL students (Tabungan Buku).
 * Auto-hides when savings target is reached. Uses React Query polling for pseudo-realtime sync.
 */

"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Sparkles, TrendingUp } from "lucide-react";
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
    <div className="bg-white border border-slate-200 rounded-md px-3.5 py-2.5 flex-shrink-0 select-none">
      {/* Header row: icon + label + amounts */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <BookOpen size={13} className="text-[#2AB0B2]" />
          <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">
            Tabungan Buku
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-500">
          {formatRupiah(saved_amount)}{" "}
          <span className="text-slate-350">/</span>{" "}
          {formatRupiah(target_amount)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-200 rounded overflow-hidden">
        <div
          className="h-full rounded transition-all duration-700 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: "#2AB0B2",
          }}
        />
      </div>

      {/* Footer: percentage + motivational hint */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[9px] font-semibold text-slate-400 flex items-center gap-1">
          {percentage >= 80 ? (
            <>
              <span>Hampir selesai, semangat!</span>
              <Sparkles size={10} className="text-[#F6C13B] flex-shrink-0" />
            </>
          ) : percentage >= 50 ? (
            <>
              <span>Sudah lewat setengah jalan!</span>
              <TrendingUp size={10} className="text-[#2AB0B2] flex-shrink-0" />
            </>
          ) : (
            <span>Yuk nabung tiap hari biar cepat lunas!</span>
          )}
        </span>
        <span className="text-[9px] font-black text-[#2AB0B2]">
          {percentage}%
        </span>
      </div>
    </div>
  );
}
