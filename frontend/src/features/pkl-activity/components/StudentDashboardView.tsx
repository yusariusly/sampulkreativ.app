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
    <div className="flex flex-col h-full bg-[#F0F2F5] px-5 pt-4 pb-6 select-none space-y-4 max-w-md mx-auto w-full">
      {/* A. Profile & Progress Card */}
      <div className="bg-white rounded-[20px] p-4 border border-slate-150 shadow-3xs flex flex-col gap-3 hover:border-slate-200 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Profil Siswa</p>
            <h2 className="text-sm font-extrabold text-slate-800 mt-1">{fullname}</h2>
            <p className="text-[11px] text-slate-450 font-medium mt-0.5">{sekolahName}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#2AB0B2]/10 flex items-center justify-center text-[#2AB0B2] border border-[#2AB0B2]/5">
            <User size={18} className="stroke-[2.2px]" />
          </div>
        </div>

        {/* PKL Progress Bar */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-slate-500 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-[#2AB0B2]" /> Progress Magang
            </span>
            <span className="text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full font-semibold">
              Minggu {progress.active_week} / {progress.total_weeks}
            </span>
          </div>
          
          {/* Custom styled progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-150/40 p-[0.5px]">
            <div
              className="h-full bg-gradient-to-r from-[#2AB0B2] to-[#209092] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
            <span>Rasio Kelulusan</span>
            <span className="font-extrabold text-slate-600">{progress.percentage}%</span>
          </div>
        </div>
      </div>

      {/* B. Card Hari Ini (Today Card) */}
      <div className="bg-white rounded-[20px] p-4 border border-slate-150 shadow-3xs flex flex-col gap-3 hover:border-slate-200 transition-all duration-300">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-[#2AB0B2]" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aktivitas Hari Ini</span>
          </div>
          <span className="text-[10px] text-slate-450 font-bold bg-slate-55 px-2 py-0.5 rounded-md border border-slate-100">{today.date}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-0.5">
          {/* Seragam */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex flex-col gap-1 hover:bg-slate-55 transition-colors duration-200">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Shirt size={12} className="stroke-[2.2px]" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Ketentuan Pakaian</span>
            </div>
            <p className="text-xs font-bold text-slate-700 truncate leading-snug">
              {today.clothes || "Bebas Rapi"}
            </p>
          </div>

          {/* Status Absen */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex flex-col gap-1 hover:bg-slate-55 transition-colors duration-200">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock size={12} className="stroke-[2.2px]" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Kehadiran</span>
            </div>
            <div className="flex items-center">
              {today.attendance_status === "Hadir" || today.attendance_status === "Terlambat" ? (
                <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100/60 px-2 py-0.5 rounded-lg">
                  {today.attendance_status === "Terlambat" ? "⚠️ Terlambat" : "✓ Hadir"}
                  {today.attendance_time && today.attendance_time !== "-" && (
                    <span className="ml-1 text-[9px] opacity-75 font-semibold">({today.attendance_time})</span>
                  )}
                </span>
              ) : today.attendance_status === "Sakit" ? (
                <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100/60 px-2 py-0.5 rounded-lg">
                  🤒 Sakit
                </span>
              ) : today.attendance_status === "Izin" ? (
                <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100/60 px-2 py-0.5 rounded-lg">
                  📝 Izin
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded-lg">
                  ✖ Belum Absen
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* C. Program Kerja Mingguan & Checklist */}
      <div className="bg-white rounded-[20px] p-4 border border-slate-150 shadow-3xs flex flex-col gap-3 hover:border-slate-200 transition-all duration-300">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <ClipboardList size={14} className="text-[#2AB0B2]" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Program Kerja Minggu Ini</span>
          </div>
        </div>

        {program_kerja ? (
          <div className="space-y-3">
            <div className="bg-indigo-50/30 border border-indigo-100/40 rounded-xl p-3">
              <h3 className="text-xs font-extrabold text-indigo-900 leading-snug">{program_kerja.title}</h3>
            </div>

            {/* Task Checklist */}
            <div className="space-y-2 pt-0.5">
              {program_kerja.tasks && program_kerja.tasks.length > 0 ? (
                program_kerja.tasks.map((task) => (
                  <div
                    key={task.task_id}
                    onClick={() => {
                      if (isToggling) return;
                      toggleTask({ taskId: task.task_id, isCompleted: !task.is_completed });
                    }}
                    className={`flex items-start gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-[0.99] select-none ${
                      task.is_completed
                        ? "bg-slate-50/40 border-slate-100/80 hover:bg-slate-50/60"
                        : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-3xs"
                    }`}
                  >
                    {/* Checkbox box */}
                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all duration-250 ${
                        task.is_completed
                          ? "bg-emerald-500 border-emerald-500 text-white scale-100"
                          : "border-slate-300 bg-white hover:border-slate-400"
                      }`}
                    >
                      {task.is_completed && <CheckCircle2 size={13} className="stroke-[3.5px] fill-emerald-500 text-white" />}
                    </div>
                    
                    <p className={`text-xs leading-relaxed font-semibold transition-colors duration-250 ${
                      task.is_completed ? "text-slate-400 line-through font-normal" : "text-slate-700"
                    }`}>
                      {task.title}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
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
      <div className="bg-white rounded-[20px] p-4 border border-slate-150 shadow-3xs flex flex-col gap-3 hover:border-slate-200 transition-all duration-300">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Award size={14} className="text-[#2AB0B2]" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Apresiasi & Penilaian Pekan Ini</span>
          </div>
        </div>

        {papan_apresiasi && papan_apresiasi.is_published ? (
          <div className="space-y-4.5">
            {/* Total points badge */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-100 rounded-xl p-3 flex items-center justify-between shadow-3xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-sm shadow-amber-500/20">
                  <Star size={16} className="fill-white stroke-[2.5px]" />
                </div>
                <div>
                  <p className="text-[9px] font-bold text-amber-700/80 uppercase tracking-widest leading-none">Skor Kelulusan Mingguan</p>
                  <p className="text-xs font-bold text-slate-800 mt-1">Minggu Ini</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-amber-600 leading-none">
                  {papan_apresiasi.total_points}
                  <span className="text-[10px] font-bold text-slate-450 ml-1">/ 25</span>
                </p>
              </div>
            </div>

            {/* Aspect Points */}
            {papan_apresiasi.aspects && (
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 space-y-1.5">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Rincian Nilai Harian</p>
                <DiscretePointsRow aspectLabel="Ketepatan Waktu (WKT)" pointsEarned={papan_apresiasi.aspects.wkt_point} icon={Clock} />
                <DiscretePointsRow aspectLabel="Sikap & Perilaku (SKP)" pointsEarned={papan_apresiasi.aspects.skp_point} icon={Smile} />
                <DiscretePointsRow aspectLabel="Hasil Kerja (HAS)" pointsEarned={papan_apresiasi.aspects.has_point} icon={CheckSquare} />
                <DiscretePointsRow aspectLabel="Kerapian Kerja (KER)" pointsEarned={papan_apresiasi.aspects.ker_point} icon={User} />
                <DiscretePointsRow aspectLabel="Inisiatif Kerja (INI)" pointsEarned={papan_apresiasi.aspects.ini_point} icon={Sparkles} />
              </div>
            )}

            {/* Tags & Comments */}
            {papan_apresiasi.feedback && papan_apresiasi.feedback.tags && papan_apresiasi.feedback.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {papan_apresiasi.feedback.tags.map((tag: string, idx: number) => (
                  <span
                    key={idx}
                    className="text-[9px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md shadow-3xs"
                  >
                    🏷️ {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="p-3 bg-indigo-50/30 border border-indigo-100/40 rounded-xl">
              <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Catatan Pembimbing</p>
              <p className="text-xs text-indigo-950 font-medium italic leading-relaxed">
                "{papan_apresiasi.feedback?.comments || "Tidak ada catatan tertulis dari Pembimbing."}"
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50/50 border border-slate-100 rounded-xl text-center">
            <div className="w-10 h-10 rounded-xl bg-indigo-50/70 flex items-center justify-center mb-3 text-[#2AB0B2] shadow-3xs border border-indigo-100/20">
              <Lock size={15} className="stroke-[2.5px]" />
            </div>
            <p className="text-xs font-bold text-slate-700 mb-0.5">Penilaian Sedang Disusun</p>
            <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed mt-1">
              {papan_apresiasi?.message || "Rapor mingguan Anda dirilis secara rutin oleh pembimbing magang Anda pada hari Jumat sore."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
export default StudentDashboardView;
