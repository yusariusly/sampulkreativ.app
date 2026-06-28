/**
 * @file components/StudentDashboardView.tsx
 * @description Encapsulates the student dashboard UI view to render inside existing page.tsx.
 */

import React, { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  TrendingUp,
  ClipboardList,
  Award,
  Sparkles,
  Lock,
  Star,
  CheckCircle2,
  Shirt,
  User,
  Smile,
  CheckSquare
} from "lucide-react";

import { StudentDashboardData } from "../types";
import { DiscretePointsRow } from "./DiscretePointsRow";
import { EmptyState } from "./EmptyState";

interface StudentDashboardViewProps {
  data: StudentDashboardData;
  toggleTask: (variables: { taskId: string; isCompleted: boolean }) => void;
  isToggling: boolean;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  data,
  toggleTask,
  isToggling,
}) => {
  const [fullname, setFullname] = useState("Siswa Magang");
  const [sekolahName, setSekolahName] = useState("Instansi Pendidikan");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUserStr = localStorage.getItem("v2_user");
      if (storedUserStr) {
        try {
          const userObj = JSON.parse(storedUserStr);
          setFullname(userObj.nama_lengkap || "Siswa Magang");
          if (userObj.sekolah) {
            setSekolahName(userObj.sekolah);
          }
        } catch (e) {}
      }
    }
  }, []);

  const { today, progress, program_kerja, papan_apresiasi } = data;

  return (
    <div className="flex flex-col h-full bg-[#F0F2F5] px-5 pt-4 pb-6 select-none space-y-4">
      {/* A. Profile & Progress Card */}
      <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider leading-none">Profil Siswa</p>
            <h2 className="text-sm font-extrabold text-gray-800 mt-1">{fullname}</h2>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">{sekolahName}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#2AB0B2]/10 flex items-center justify-center text-[#2AB0B2]">
            <User size={20} />
          </div>
        </div>

        {/* PKL Progress Bar */}
        <div className="pt-2 border-t border-gray-100 flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-gray-500 flex items-center gap-1">
              <TrendingUp size={11} className="text-[#2AB0B2]" /> Progress Magang
            </span>
            <span className="text-gray-700 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
              Minggu {progress.active_week} / {progress.total_weeks}
            </span>
          </div>
          
          {/* Custom styled progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2AB0B2] to-[#209092] rounded-full transition-all duration-500"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          
          <div className="flex justify-between items-center text-[10px] text-gray-400">
            <span>Rasio Kelulusan</span>
            <span className="font-extrabold text-gray-600">{progress.percentage}%</span>
          </div>
        </div>
      </div>

      {/* B. Card Hari Ini (Today Card) */}
      <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-[#2AB0B2]" />
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Aktivitas Hari Ini</span>
          </div>
          <span className="text-[10px] text-gray-400 font-semibold">{today.date}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Seragam */}
          <div className="bg-gray-50 border border-gray-150 rounded-xl p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Shirt size={12} />
              <span className="text-[9px] font-bold uppercase tracking-wider">Ketentuan Pakaian</span>
            </div>
            <p className="text-xs font-bold text-gray-700 truncate leading-snug">
              {today.clothes || "Bebas Rapi"}
            </p>
          </div>

          {/* Status Absen */}
          <div className="bg-gray-50 border border-gray-150 rounded-xl p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Clock size={12} />
              <span className="text-[9px] font-bold uppercase tracking-wider">Kehadiran</span>
            </div>
            <div className="flex items-center gap-1">
              {today.attendance_status === "Hadir" || today.attendance_status === "Terlambat" ? (
                <span className="inline-flex items-center text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                  ✅ {today.attendance_status}
                </span>
              ) : today.attendance_status === "Sakit" ? (
                <span className="inline-flex items-center text-[10px] font-extrabold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md">
                  🤒 Sakit
                </span>
              ) : today.attendance_status === "Izin" ? (
                <span className="inline-flex items-center text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md">
                  📝 Izin
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-extrabold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md">
                  ❌ {today.attendance_status || "Belum Absen"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* C. Program Kerja Mingguan & Checklist */}
      <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <ClipboardList size={14} className="text-[#2AB0B2]" />
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Program Kerja Minggu Ini</span>
          </div>
        </div>

        {program_kerja ? (
          <div className="space-y-3">
            <div className="bg-indigo-50/40 border border-indigo-100/50 rounded-xl p-3">
              <h3 className="text-xs font-extrabold text-indigo-900 leading-snug">{program_kerja.title}</h3>
            </div>

            {/* Task Checklist */}
            <div className="space-y-2 pt-1">
              {program_kerja.tasks && program_kerja.tasks.length > 0 ? (
                program_kerja.tasks.map((task) => (
                  <div
                    key={task.task_id}
                    onClick={() => {
                      if (isToggling) return;
                      toggleTask({ taskId: task.task_id, isCompleted: !task.is_completed });
                    }}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      task.is_completed
                        ? "bg-emerald-50/30 border-emerald-150"
                        : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {/* Checkbox box */}
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                        task.is_completed
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {task.is_completed && <CheckCircle2 size={14} className="stroke-[3px]" />}
                    </div>
                    
                    <p className={`text-xs leading-normal font-semibold ${
                      task.is_completed ? "text-gray-400 line-through" : "text-gray-700"
                    }`}>
                      {task.title}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 italic text-center py-2">
                  Tidak ada detail tugas program kerja minggu ini.
                </p>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="Program Kerja Belum Diset"
            description="Anda belum memiliki roadmap program kerja mingguan yang aktif."
          />
        )}
      </div>

      {/* D. Papan Apresiasi Mingguan */}
      <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Award size={14} className="text-[#2AB0B2]" />
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Apresiasi & Penilaian Pekan Ini</span>
          </div>
        </div>

        {papan_apresiasi && papan_apresiasi.is_published ? (
          <div className="space-y-4">
            {/* Total points badge */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-3 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center text-white">
                  <Star size={20} className="fill-white" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-amber-700/80 uppercase tracking-wider leading-none">Skor Kelulusan Mingguan</p>
                  <p className="text-xs font-bold text-gray-800 mt-1">Minggu Ini</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-amber-600">{papan_apresiasi.total_points} <span className="text-[10px] font-bold text-gray-400">/ 25</span></p>
              </div>
            </div>

            {/* Aspect Points */}
            {papan_apresiasi.aspects && (
              <div className="bg-gray-50 border border-gray-150 rounded-xl p-3 space-y-1">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Rincian Nilai Harian</p>
                <DiscretePointsRow aspectLabel="Ketepatan Waktu (WKT)" pointsEarned={papan_apresiasi.aspects.wkt_point} icon={Clock} />
                <DiscretePointsRow aspectLabel="Sikap & Perilaku (SKP)" pointsEarned={papan_apresiasi.aspects.skp_point} icon={Smile} />
                <DiscretePointsRow aspectLabel="Hasil Kerja (HAS)" pointsEarned={papan_apresiasi.aspects.has_point} icon={CheckSquare} />
                <DiscretePointsRow aspectLabel="Kerapian Kerja (KER)" pointsEarned={papan_apresiasi.aspects.ker_point} icon={User} />
                <DiscretePointsRow aspectLabel="Inisiatif Kerja (INI)" pointsEarned={papan_apresiasi.aspects.ini_point} icon={Sparkles} />
              </div>
            )}

            {/* Tags & Comments */}
            {papan_apresiasi.feedback && papan_apresiasi.feedback.tags && papan_apresiasi.feedback.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {papan_apresiasi.feedback.tags.map((tag: string, idx: number) => (
                  <span
                    key={idx}
                    className="text-[9px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md"
                  >
                    🏷️ {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="p-3 bg-indigo-50/40 border border-indigo-150/50 rounded-xl">
              <p className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider mb-1">Catatan Pembimbing</p>
              <p className="text-xs text-indigo-900 italic leading-relaxed">
                {papan_apresiasi.feedback?.comments || "Tidak ada catatan tertulis dari Pembimbing."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 bg-gray-50 border border-gray-200 rounded-xl text-center">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mb-2 text-[#2AB0B2]">
              <Lock size={18} />
            </div>
            <p className="text-xs font-bold text-gray-700 mb-0.5">Penilaian Sedang Disusun</p>
            <p className="text-[10px] text-gray-400 max-w-[200px] leading-normal">
              {papan_apresiasi?.message || "Rapor mingguan Anda dirilis secara rutin oleh pembimbing magang Anda pada hari Jumat sore."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
export default StudentDashboardView;
