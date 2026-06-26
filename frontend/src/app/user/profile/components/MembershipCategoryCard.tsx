import React from "react";

interface MembershipCategoryCardProps {
  currentCategory: string;
  onChangeCategory: (newCategory: string) => void;
  isSubmitting?: boolean;
}

export const MembershipCategoryCard: React.FC<MembershipCategoryCardProps> = ({
  currentCategory,
  onChangeCategory,
  isSubmitting = false,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-xs p-5 mb-4 border border-gray-100/50">
      <h3 className="font-bold text-gray-800 mb-3 text-base">Kategori Keanggotaan Anda</h3>
      <p className="text-gray-400 text-xs mb-4">
        Pilih kategori yang sesuai untuk penyesuaian kartu identitas dan absensi Anda.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => onChangeCategory("Karyawan")}
          className={`py-3 px-3 rounded-xl font-bold text-xs transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
            currentCategory === "Karyawan"
              ? "bg-[#2AB0B2] text-white border-[#2AB0B2]"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          } disabled:opacity-50`}
        >
          💼 Karyawan
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => onChangeCategory("PKL")}
          className={`py-3 px-3 rounded-xl font-bold text-xs transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
            currentCategory === "PKL"
              ? "bg-[#2AB0B2] text-white border-[#2AB0B2]"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          } disabled:opacity-50`}
        >
          🎓 PKL / Magang
        </button>
      </div>
    </div>
  );
};
