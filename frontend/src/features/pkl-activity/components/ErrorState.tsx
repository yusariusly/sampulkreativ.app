/**
 * @file components/ErrorState.tsx
 * @description Component for displaying error details with a retry action button.
 */

import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = "Gagal memuat data dari server.",
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-rose-50/50 rounded-2xl border border-rose-100 text-center select-none shadow-xs">
      <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-3">
        <AlertCircle className="text-rose-600" size={24} />
      </div>
      <h3 className="text-sm font-bold text-gray-800 mb-1">Terjadi Kesalahan</h3>
      <p className="text-xs text-rose-600/80 max-w-[240px] leading-normal mb-4">{message}</p>
      
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 active:scale-95 shadow-sm hover:shadow-md cursor-pointer transition-all"
      >
        <RotateCcw size={14} className="text-gray-500" />
        Coba Lagi
      </button>
    </div>
  );
};
export default ErrorState;
