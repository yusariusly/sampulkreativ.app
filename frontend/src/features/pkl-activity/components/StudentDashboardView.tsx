/**
 * @file components/StudentDashboardView.tsx
 * @description Encapsulates the student dashboard UI view to render inside existing page.tsx.
 */

import React, { useEffect, useState, useCallback } from "react";
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
  CheckSquare,
  Trophy,
  ArrowUp,
  ArrowDown,
  Minus,
  Filter,
  BookOpen,
  AlertTriangle,
  Info
} from "lucide-react";

import { StudentDashboardData } from "../types";
import { DiscretePointsRow } from "./DiscretePointsRow";
import { EmptyState } from "./EmptyState";

interface StudentDashboardViewProps {
  data: StudentDashboardData;
  toggleTask: (variables: { taskId: string; isCompleted: boolean }) => void;
  isToggling: boolean;
  embedded?: boolean;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  data,
  toggleTask,
  isToggling,
  embedded = false,
}) => {
  const [fullname, setFullname] = useState("Siswa Magang");
  const [sekolahName, setSekolahName] = useState("Instansi Pendidikan");
  const [selectedWeekNo, setSelectedWeekNo] = useState<number>(data.program_kerja?.active_week || data.progress?.active_week || 1);

  // Scoreboard / Leaderboard Integration States
  const [activeSubTab, setActiveSubTab] = useState<"today" | "curriculum" | "apresiasi" | "scoreboard">("today");
  const [showPklScoreboard, setShowPklScoreboard] = useState(false);
  const [scoreboardData, setScoreboardData] = useState<any[]>([]);
  const [loadingScoreboard, setLoadingScoreboard] = useState(false);
  const [scoreboardWeek, setScoreboardWeek] = useState<number>(1);
  const [userId, setUserId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [dressCodeSchedule, setDressCodeSchedule] = useState<any[]>([]);

  // Fetch Dress Code Schedule
  useEffect(() => {
    const fetchDressCode = async () => {
      try {
        const res = await fetch("/api/pkl-dress-code");
        if (res.ok) {
          const data = await res.json();
          setDressCodeSchedule(data);
        }
      } catch (err) {
        console.error("Gagal memuat jadwal pakaian:", err);
      }
    };
    fetchDressCode();
  }, []);

  // Fetch Settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const json = await res.json();
          if (json.show_pkl_scoreboard !== undefined) {
            setShowPklScoreboard(json.show_pkl_scoreboard === "1");
          }
        }
      } catch (err) {
        console.error("Gagal memuat settings untuk scoreboard:", err);
      }
    };
    fetchSettings();
  }, []);

  // Fetch Scoreboard Data
  const fetchStudentScoreboard = useCallback(async (weekNum: number, uId: string, devId: string) => {
    if (!uId || !devId) return;
    setLoadingScoreboard(true);
    try {
      const res = await fetch(`/api/v1/pkl/scoreboard?week=${weekNum}`, {
        headers: {
          "x-user-id": uId,
          "x-device-id": devId,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success" && json.data) {
          setScoreboardData(json.data.rankings || []);
        }
      }
    } catch (e) {
      console.error("Gagal memuat scoreboard siswa:", e);
    } finally {
      setLoadingScoreboard(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUserStr = localStorage.getItem("v2_user");
      const devId = localStorage.getItem("v2_device_id") || "";
      setDeviceId(devId);
      if (storedUserStr) {
        try {
          const userObj = JSON.parse(storedUserStr);
          setFullname(userObj.nama_lengkap || "Siswa Magang");
          setUserId(userObj.id || "");
          if (userObj.sekolah) {
            setSekolahName(userObj.sekolah);
          }
          if (activeSubTab === "scoreboard" && userObj.id) {
            fetchStudentScoreboard(scoreboardWeek, userObj.id, devId);
          }
        } catch (e) {}
      }
    }
  }, [activeSubTab, scoreboardWeek, fetchStudentScoreboard]);

  useEffect(() => {
    if (data.papan_apresiasi?.is_published && data.papan_apresiasi?.week_number) {
      setScoreboardWeek(data.papan_apresiasi.week_number);
    } else {
      setScoreboardWeek(1);
    }
  }, [data.papan_apresiasi?.is_published, data.papan_apresiasi?.week_number]);

  useEffect(() => {
    if (data.program_kerja?.active_week) {
      setSelectedWeekNo(data.program_kerja.active_week);
    } else if (data.progress?.active_week) {
      setSelectedWeekNo(data.progress.active_week);
    }
  }, [data.program_kerja?.active_week, data.progress?.active_week]);

  const { today, progress, program_kerja, papan_apresiasi } = data;

  const containerClass = embedded
    ? "flex flex-col select-none space-y-4 w-full mt-2 flex-1 min-h-0"
    : "flex flex-col h-full bg-[#F0F2F5] px-5 pt-4 pb-6 select-none space-y-4 max-w-md mx-auto w-full";

  return (
    <div className={containerClass}>
      {/* Tab Switcher */}
      <div className={`grid ${showPklScoreboard ? "grid-cols-4" : "grid-cols-3"} bg-slate-100 p-1 rounded-lg gap-1 select-none border border-slate-200 flex-shrink-0`}>
        <button
          type="button"
          onClick={() => setActiveSubTab("today")}
          className={`py-2 text-[10px] font-black rounded-md transition-colors cursor-pointer ${
            activeSubTab === "today"
              ? "bg-white text-[#1C3D3F] shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Hari Ini
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("curriculum")}
          className={`py-2 text-[10px] font-black rounded-md transition-colors cursor-pointer ${
            activeSubTab === "curriculum"
              ? "bg-white text-[#1C3D3F] shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Kurikulum
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("apresiasi")}
          className={`py-2 text-[10px] font-black rounded-md transition-colors cursor-pointer ${
            activeSubTab === "apresiasi"
              ? "bg-white text-[#1C3D3F] shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Apresiasi
        </button>
        {showPklScoreboard && (
          <button
            type="button"
            onClick={() => setActiveSubTab("scoreboard")}
            className={`py-2 text-[10px] font-black rounded-md transition-colors cursor-pointer ${
              activeSubTab === "scoreboard"
                ? "bg-white text-[#1C3D3F] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Klasemen
          </button>
        )}
      </div>

      {/* Tab Content Container */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pr-0.5">
        {activeSubTab === "today" && (
          <div className="flex flex-col gap-4">
            {/* Kehadiran Hari Ini */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col gap-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-[#2AB0B2]" />
                  <span className="text-xs font-bold text-slate-800">Kehadiran Hari Ini</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{today.date}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock size={14} className="stroke-[2.2px]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status Kehadiran</span>
                </div>
                <div>
                  {today.attendance_status === "Hadir" || today.attendance_status === "Terlambat" ? (
                    <span className="inline-flex items-center text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      {today.attendance_status === "Terlambat" ? "⚠️ Terlambat" : "✓ Hadir"}
                      {today.attendance_time && today.attendance_time !== "-" && (
                        <span className="ml-1 text-[9px] opacity-75 font-semibold">({today.attendance_time})</span>
                      )}
                    </span>
                  ) : today.attendance_status === "Sakit" ? (
                    <span className="inline-flex items-center text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                      🤒 Sakit
                    </span>
                  ) : today.attendance_status === "Izin" ? (
                    <span className="inline-flex items-center text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      📝 Izin
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[10px] font-black text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                      Belum Absen
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Jadwal Ketentuan Pakaian (List/Table) */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Shirt size={15} className="text-[#2AB0B2]" />
                <span className="text-xs font-bold text-slate-800">Jadwal Ketentuan Pakaian</span>
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                {(dressCodeSchedule.length > 0 ? dressCodeSchedule : [
                  { day_number: 1, day_name: 'Senin', clothes_description: 'Kemeja Putih & Celana Bahan Hitam' },
                  { day_number: 2, day_name: 'Selasa', clothes_description: 'Kemeja Putih & Celana Bahan Hitam' },
                  { day_number: 3, day_name: 'Rabu', clothes_description: 'Wearpack Kejuruan' },
                  { day_number: 4, day_name: 'Kamis', clothes_description: 'Wearpack Kejuruan' },
                  { day_number: 5, day_name: 'Jumat', clothes_description: 'Batik & Celana Bahan Hitam' }
                ]).map((item) => {
                  const todayDay = new Date().getDay(); // 0: Minggu, 1: Senin, ..., 5: Jumat
                  const isToday = item.day_number === todayDay;
                  return (
                    <div
                      key={item.day_number}
                      className={`flex items-center justify-between p-2.5 rounded-lg border ${
                        isToday
                          ? "bg-teal-50 border-[#2AB0B2] text-[#1C3D3F] font-black"
                          : "bg-white border-slate-150 text-slate-600 font-semibold"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] tracking-wider uppercase font-black px-1.5 py-0.5 rounded ${
                          isToday ? "bg-[#2AB0B2] text-white" : "bg-slate-150 text-slate-500"
                        }`}>
                          {item.day_name.slice(0, 3)}
                        </span>
                        <span className="text-[11px] truncate">{item.clothes_description}</span>
                      </div>
                      {isToday && (
                        <span className="text-[8px] font-black uppercase bg-[#1C3D3F] text-white px-1.5 py-0.5 rounded select-none shrink-0 ml-2">
                          Hari Ini
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === "curriculum" && (
          <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col gap-3">
            <div className="flex justify-between items-center pb-1">
              <div className="flex items-center gap-1.5">
                <ClipboardList size={14} className="text-[#2AB0B2]" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Materi & Target Belajar PKL</span>
              </div>
              {program_kerja && program_kerja.active_week && (
                <span className="text-[9px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Minggu Aktif: M{program_kerja.active_week}
                </span>
              )}
            </div>

            {program_kerja ? (
              <div className="space-y-3.5">
                {/* Horizontal Week Selector Badges */}
                {program_kerja.weeks && program_kerja.weeks.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                    {program_kerja.weeks.map((wk) => {
                      const isSelected = selectedWeekNo === wk.week_number;
                      const isActiveWeek = program_kerja.active_week === wk.week_number;

                      return (
                        <button
                          key={wk.id}
                          type="button"
                          onClick={() => setSelectedWeekNo(wk.week_number)}
                          className={`flex-shrink-0 flex flex-col items-center justify-center py-2 px-3 rounded-lg border transition-colors min-w-[70px] text-center cursor-pointer select-none active:scale-[0.97] ${
                            isSelected
                              ? "bg-[#2AB0B2] border-[#209092] text-white"
                              : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className={`text-[10px] font-bold tracking-tight ${isSelected ? "text-white" : "text-slate-800"}`}>
                            Minggu {wk.week_number}
                          </span>
                          {isActiveWeek && (
                            <span className={`text-[7px] font-black uppercase mt-1 px-1 rounded-sm ${
                              isSelected ? "bg-white text-[#2AB0B2]" : "bg-[#2AB0B2] text-white"
                            }`}>
                              Aktif
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Selected Week Content */}
                {(() => {
                  const selectedWeekData = (program_kerja.weeks || []).find(w => w.week_number === selectedWeekNo);
                  const activeWeek = program_kerja.active_week || progress.active_week;
                  const isSelectedActive = selectedWeekNo === activeWeek;

                  if (selectedWeekData) {
                    return (
                      <div className="space-y-3.5 mt-1">
                        {/* Target milestone */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Topik Utama Pekan Ini</span>
                          <h3 className="text-xs font-extrabold text-slate-800 leading-snug">{selectedWeekData.milestone_title}</h3>
                        </div>

                        {/* Tasks List (Informational Bullet Points, no checklist) */}
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 flex flex-col gap-2">
                          {selectedWeekData.tasks && selectedWeekData.tasks.length > 0 ? (
                            selectedWeekData.tasks.map((task) => (
                              <div
                                key={task.task_id}
                                className="flex items-start gap-2.5 p-3 bg-white border border-slate-200 rounded-lg"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#2AB0B2] mt-1.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs leading-relaxed font-semibold text-slate-700">
                                    {task.title}
                                  </p>
                                  {task.is_mandatory && (
                                    <span className="inline-block text-[7px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-1 rounded-sm mt-1 tracking-wide uppercase">
                                      Topik Wajib
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : null}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200 mt-1">
                        <ClipboardList size={22} className="text-slate-300 mb-2" />
                        <p className="text-xs font-bold text-slate-500">Materi Belum Diatur</p>
                        <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed mt-1">
                          {isSelectedActive 
                            ? `Tidak ada materi yang diatur untuk Minggu ${selectedWeekNo} (Minggu Aktif Anda).`
                            : `Tidak ada materi yang diatur untuk Minggu ${selectedWeekNo}.`
                          }
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="Program Kerja Belum Diset"
                description="Anda belum memiliki roadmap program kerja mingguan yang aktif."
              />
            )}
          </div>
        )}

        {activeSubTab === "apresiasi" && (
          <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col gap-3">
            <div className="flex justify-between items-center pb-1">
              <div className="flex items-center gap-1.5">
                <Award size={14} className="text-[#2AB0B2]" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Apresiasi & Poin Pekan Ini</span>
              </div>
              {papan_apresiasi && papan_apresiasi.is_published && papan_apresiasi.week_number && (
                <span className="text-[9px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Minggu {papan_apresiasi.week_number}
                </span>
              )}
            </div>

            {papan_apresiasi && papan_apresiasi.is_published ? (
              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1 flex flex-col gap-3">
                {/* Total points */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8.5 h-8.5 rounded-lg bg-[#2AB0B2] flex items-center justify-center text-white">
                      <Star size={15} className="fill-white stroke-[2.5px]" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Poin</p>
                      <p className="text-xs font-bold text-slate-700 mt-0.5">Perolehan Mingguan</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-[#2AB0B2] leading-none">
                      {papan_apresiasi.total_points}
                      <span className="text-[10px] font-bold text-slate-400 ml-0.5">/ 25</span>
                    </p>
                  </div>
                </div>

                {/* Aspect Points */}
                {papan_apresiasi.aspects && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Rincian Poin Aspek</p>
                    {data.aspect_settings && data.aspect_settings.length > 0 ? (
                      data.aspect_settings
                        .filter(a => a.is_active === 1)
                        .map((aspect) => {
                          const pointsEarned = (papan_apresiasi.aspects as any)[aspect.aspect_key] || 0;
                          let IconComp = Star;
                          if (aspect.icon_name === "Clock") IconComp = Clock;
                          else if (aspect.icon_name === "Smile") IconComp = Smile;
                          else if (aspect.icon_name === "CheckSquare") IconComp = CheckSquare;
                          else if (aspect.icon_name === "User") IconComp = User;
                          else if (aspect.icon_name === "Sparkles") IconComp = Sparkles;

                          return (
                            <DiscretePointsRow
                              key={aspect.aspect_key}
                              aspectLabel={aspect.label}
                              pointsEarned={pointsEarned}
                              icon={IconComp}
                            />
                          );
                        })
                    ) : (
                      <>
                        <DiscretePointsRow aspectLabel="Ketepatan Waktu (WKT)" pointsEarned={papan_apresiasi.aspects.wkt_point} icon={Clock} />
                        <DiscretePointsRow aspectLabel="Sikap & Perilaku (SKP)" pointsEarned={papan_apresiasi.aspects.skp_point} icon={Smile} />
                        <DiscretePointsRow aspectLabel="Hasil Kerja (HAS)" pointsEarned={papan_apresiasi.aspects.has_point} icon={CheckSquare} />
                        <DiscretePointsRow aspectLabel="Kerapian Kerja (KER)" pointsEarned={papan_apresiasi.aspects.ker_point} icon={User} />
                        <DiscretePointsRow aspectLabel="Inisiatif Kerja (INI)" pointsEarned={papan_apresiasi.aspects.ini_point} icon={Sparkles} />
                      </>
                    )}
                  </div>
                )}

                {/* Tags */}
                {papan_apresiasi.feedback && papan_apresiasi.feedback.tags && papan_apresiasi.feedback.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {papan_apresiasi.feedback.tags.map((tag: string, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 bg-slate-50 text-slate-650 border border-slate-200 rounded"
                      >
                        <Award size={9} className="text-slate-400" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Mentor Comments */}
                {papan_apresiasi.feedback?.comments && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <BookOpen size={11} className="text-slate-400" />
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Catatan Pembimbing</p>
                    </div>
                    <p className="text-xs text-slate-600 font-medium italic leading-relaxed">
                      &ldquo;{papan_apresiasi.feedback.comments}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center mb-3 text-slate-450">
                  <Lock size={15} className="stroke-[2.5px]" />
                </div>
                <p className="text-xs font-bold text-slate-600 mb-0.5">Poin Sedang Diproses</p>
                <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed mt-1">
                  {papan_apresiasi?.message || "Papan apresiasi mingguan Anda dirilis secara rutin oleh pembimbing magang Anda pada hari Jumat sore."}
                </p>
              </div>
            )}
          </div>
        )}

        {activeSubTab === "scoreboard" && (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            {/* A. Header & Week Filter */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col gap-3 flex-shrink-0">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <Trophy size={15} className="text-[#2AB0B2]" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scoreboard PKL</span>
                </div>
                <span className="text-[9px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Pekan Ke-{scoreboardWeek}
                </span>
              </div>

              {/* Horizontal Week Selector Badges */}
              {program_kerja?.weeks && program_kerja.weeks.length > 0 ? (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                  {program_kerja.weeks.map((wk) => {
                    const isSelected = scoreboardWeek === wk.week_number;
                    const isActiveWeek = program_kerja.active_week === wk.week_number;

                    return (
                      <button
                        key={wk.id}
                        type="button"
                        onClick={() => setScoreboardWeek(wk.week_number)}
                        className={`flex-shrink-0 flex flex-col items-center justify-center py-2 px-3 rounded-lg border transition-colors min-w-[65px] text-center cursor-pointer select-none active:scale-[0.97] ${
                          isSelected
                            ? "bg-[#2AB0B2] border-[#209092] text-white"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className={`text-[10px] font-bold tracking-tight ${isSelected ? "text-white" : "text-slate-800"}`}>
                          M{wk.week_number}
                        </span>
                        {isActiveWeek && (
                          <span className={`inline-block w-1 h-1 rounded-full mt-1 ${
                            isSelected ? "bg-white" : "bg-[#2AB0B2]"
                          }`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[1, 2, 3, 4].map((wk) => (
                    <button
                      key={wk}
                      type="button"
                      onClick={() => setScoreboardWeek(wk)}
                      className={`flex-shrink-0 py-1.5 px-3 rounded-lg border text-[10px] font-bold ${
                        scoreboardWeek === wk
                          ? "bg-[#2AB0B2] border-[#209092] text-white"
                          : "bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      M{wk}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* B. Loading or Scoreboard Content - Scrollable list */}
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-2 pr-0.5">
              {loadingScoreboard ? (
                <div className="bg-white rounded-xl p-8 border border-slate-200 flex flex-col items-center justify-center text-center">
                  <div className="animate-spin rounded-full h-7 w-7 border-2 border-[#2AB0B2] border-t-transparent mb-2" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Memuat klasemen siswa...</p>
                </div>
              ) : scoreboardData.length === 0 ? (
                <div className="bg-white rounded-xl p-8 border border-slate-200 flex flex-col items-center justify-center text-center">
                  <Trophy size={32} className="text-slate-200 mb-2" />
                  <h4 className="text-xs font-bold text-slate-755">Belum Ada Skor Dirilis</h4>
                  <p className="text-[10px] text-slate-400 max-w-[220px] leading-relaxed mt-1">
                    Poin mingguan belum dirilis oleh pembimbing untuk Minggu {scoreboardWeek}.
                  </p>
                </div>
              ) : (
                <>
                  {/* Podium Top 3 */}
                  {(() => {
                    const podiumStudents = scoreboardData.slice(0, 3);
                    const rank1 = podiumStudents[0];
                    const rank2 = podiumStudents[1];
                    const rank3 = podiumStudents[2];

                    return (
                      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center flex-shrink-0">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Top Performers</h4>
                        
                        <div className="flex items-end justify-center w-full max-w-[280px] gap-2.5 pb-2 min-h-[140px]">
                          {/* Rank 2 (Left) */}
                          {rank2 ? (
                            <div className="flex flex-col items-center flex-1">
                              <div className="relative mb-2">
                                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-300 bg-white flex items-center justify-center">
                                  {(rank2.profile_photo || rank2.student_avatar) && (rank2.profile_photo || rank2.student_avatar) !== "/uploads/placeholder.jpg" ? (
                                    <img src={rank2.profile_photo || rank2.student_avatar} alt={rank2.student_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className={`w-full h-full flex items-center justify-center font-black text-[10px] ${getAvatarColorClass(rank2.student_id)}`}>
                                      {getInitials(rank2.student_name)}
                                    </div>
                                  )}
                                </div>
                                <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-slate-400 text-white text-[8px] font-black flex items-center justify-center border border-white">
                                  2
                                </span>
                              </div>
                              <span className={`text-[9px] font-bold truncate max-w-[65px] text-center ${rank2.is_self ? "text-[#2AB0B2] font-black" : "text-slate-700"}`}>
                                {rank2.is_self ? rank2.student_name : maskStudentName(rank2.student_name)}
                              </span>
                              <span className="text-[8px] font-black text-[#2AB0B2] mt-0.5">{rank2.total_points} Pts</span>
                              
                              <div className="w-12 bg-slate-100 border border-slate-200 rounded-t-md mt-2 h-8 flex items-center justify-center">
                                <Trophy size={12} className="text-slate-400" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1" />
                          )}

                          {/* Rank 1 (Center) */}
                          {rank1 ? (
                            <div className="flex flex-col items-center flex-1 relative -top-2">
                              <div className="relative mb-2">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-amber-500 animate-bounce">
                                  <Trophy size={14} className="fill-amber-500 stroke-[2px]" />
                                </div>
                                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-400 bg-white flex items-center justify-center ring-2 ring-amber-400/20">
                                  {(rank1.profile_photo || rank1.student_avatar) && (rank1.profile_photo || rank1.student_avatar) !== "/uploads/placeholder.jpg" ? (
                                    <img src={rank1.profile_photo || rank1.student_avatar} alt={rank1.student_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className={`w-full h-full flex items-center justify-center font-black text-xs ${getAvatarColorClass(rank1.student_id)}`}>
                                      {getInitials(rank1.student_name)}
                                    </div>
                                  )}
                                </div>
                                <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-amber-400 text-white text-[8px] font-black flex items-center justify-center border border-white">
                                  1
                                </span>
                              </div>
                              <span className={`text-[9px] font-bold truncate max-w-[75px] text-center ${rank1.is_self ? "text-[#2AB0B2] font-black" : "text-slate-800"}`}>
                                {rank1.is_self ? rank1.student_name : maskStudentName(rank1.student_name)}
                              </span>
                              <span className="text-[9px] font-black text-amber-600 mt-0.5">{rank1.total_points} Pts</span>

                              <div className="w-14 bg-amber-50 border border-amber-200 rounded-t-md mt-2 h-11 flex items-center justify-center">
                                <Trophy size={14} className="text-amber-500" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1" />
                          )}

                          {/* Rank 3 (Right) */}
                          {rank3 ? (
                            <div className="flex flex-col items-center flex-1">
                              <div className="relative mb-2">
                                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-650 bg-white flex items-center justify-center">
                                  {(rank3.profile_photo || rank3.student_avatar) && (rank3.profile_photo || rank3.student_avatar) !== "/uploads/placeholder.jpg" ? (
                                    <img src={rank3.profile_photo || rank3.student_avatar} alt={rank3.student_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className={`w-full h-full flex items-center justify-center font-black text-[10px] ${getAvatarColorClass(rank3.student_id)}`}>
                                      {getInitials(rank3.student_name)}
                                    </div>
                                  )}
                                </div>
                                <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-amber-600 text-white text-[8px] font-black flex items-center justify-center border border-white">
                                  3
                                </span>
                              </div>
                              <span className={`text-[9px] font-bold truncate max-w-[65px] text-center ${rank3.is_self ? "text-[#2AB0B2] font-black" : "text-slate-700"}`}>
                                {rank3.is_self ? rank3.student_name : maskStudentName(rank3.student_name)}
                              </span>
                              <span className="text-[8px] font-black text-amber-700 mt-0.5">{rank3.total_points} Pts</span>

                              <div className="w-12 bg-amber-50 border border-amber-200 rounded-t-md mt-2 h-6 flex items-center justify-center">
                                <Trophy size={11} className="text-amber-600/70" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1" />
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Complete Leaderboard List */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
                    <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Klasemen Grup PKL</h4>
                    
                    <div className="divide-y divide-slate-100">
                      {scoreboardData.map((item, index) => {
                        const isRankUp = item.rank_change > 0;
                        const isRankDown = item.rank_change < 0;

                        return (
                          <div
                            key={item.student_id}
                            className={`flex items-center justify-between py-2.5 ${
                              item.is_self
                                ? "bg-teal-50/40 -mx-4 px-4 rounded-xl border-y border-teal-100/50"
                                : ""
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex flex-col items-center justify-center w-5 flex-shrink-0">
                                <span className={`text-[10px] font-black ${
                                  item.is_self ? "text-[#2AB0B2]" : "text-slate-800"
                                }`}>
                                  {item.rank}
                                </span>
                                <span className="flex items-center mt-0.5">
                                  {isRankUp && <ArrowUp size={8} className="text-emerald-500 stroke-[3px]" />}
                                  {isRankDown && <ArrowDown size={8} className="text-rose-500 stroke-[3px]" />}
                                  {!isRankUp && !isRankDown && <Minus size={8} className="text-slate-300 stroke-[3px]" />}
                                </span>
                              </div>

                              <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-150 bg-white flex-shrink-0 flex items-center justify-center">
                                {(item.profile_photo || item.student_avatar) && (item.profile_photo || item.student_avatar) !== "/uploads/placeholder.jpg" ? (
                                  <img src={item.profile_photo || item.student_avatar} alt={item.student_name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className={`w-full h-full flex items-center justify-center font-bold text-[9px] ${getAvatarColorClass(item.student_id)}`}>
                                    {getInitials(item.student_name)}
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 pr-2">
                                <h4 className={`text-[11px] truncate ${
                                  item.is_self ? "text-[#2AB0B2] font-black" : "text-slate-700 font-bold"
                                }`}>
                                  {item.is_self ? item.student_name : maskStudentName(item.student_name)}
                                  {item.is_self && (
                                    <span className="ml-1 text-[7px] font-black px-1 py-0.2 rounded bg-[#2AB0B2]/10">
                                      SAYA
                                    </span>
                                  )}
                                </h4>
                                <span className="text-[8px] text-slate-400 block mt-0.5 truncate">{item.school_name}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 flex-shrink-0">
                              <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1">
                                  {item.appreciation_badges > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-100">
                                      <Sparkles size={8} className="fill-amber-500 text-amber-500" />
                                      {item.appreciation_badges}
                                    </span>
                                  )}
                                  {item.perfect_days > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100">
                                      <CheckSquare size={8} className="text-emerald-500" />
                                      {item.perfect_days}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className="text-[11px] font-black text-[#2AB0B2] pr-1">
                                {item.total_points} Pts
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Internal sub-helpers for initial name generation
function getInitials(name: string) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}

const colors = [
  "bg-red-50 text-red-700 border-red-150",
  "bg-blue-50 text-blue-700 border-blue-150",
  "bg-emerald-50 text-emerald-700 border-emerald-150",
  "bg-purple-50 text-purple-700 border-purple-150",
  "bg-pink-50 text-pink-700 border-pink-150",
  "bg-amber-50 text-amber-700 border-amber-150",
  "bg-teal-50 text-teal-700 border-teal-150",
];

function getAvatarColorClass(studentId: string) {
  let hash = 0;
  for (let i = 0; i < studentId.length; i++) {
    hash = studentId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function maskStudentName(name: string) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitials = parts.slice(1).map(p => p[0].toUpperCase() + ".").join(" ");
  return `${firstName} ${lastInitials}`;
}

export default StudentDashboardView;
