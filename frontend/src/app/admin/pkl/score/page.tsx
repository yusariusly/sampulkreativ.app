"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Calendar,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  HelpCircle,
  Loader2,
  MessageSquare,
  Save,
  Send,
  Sparkles,
  User,
  Users,
  Trophy,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  Filter,
  BookOpen,
  EyeOff,
  Info
} from "lucide-react";

// Types
interface AspectSetting {
  aspect_key: string;
  label: string;
  icon_name: string;
  is_active: number;
}

interface StudentRekap {
  student_id: string;
  student_name: string;
  school_name: string;
  start_date?: string;
  week_number: number;
  total_points: number;
  comments: string;
  tags: string[];
  is_published: boolean;
}

interface DailyEval {
  evaluation_date: string;
  wkt_point: number;
  skp_point: number;
  has_point: number;
  ker_point: number;
  ini_point: number;
}

export default function PklScoreboardPage() {
  const router = useRouter();
  const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Scoreboard Visibility States
  const [showPklScoreboard, setShowPklScoreboard] = useState(false);
  const [togglingScoreboard, setTogglingScoreboard] = useState(false);

  // Fetch show_pkl_scoreboard setting
  const fetchScoreboardVisibility = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const json = await res.json();
        if (json.show_pkl_scoreboard !== undefined) {
          setShowPklScoreboard(json.show_pkl_scoreboard === "1");
        }
      }
    } catch (err) {
      console.error("Gagal memuat visibilitas scoreboard:", err);
    }
  }, []);

  const toggleScoreboardVisibility = async () => {
    setTogglingScoreboard(true);
    const newValue = !showPklScoreboard;
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          show_pkl_scoreboard: newValue ? "1" : "0"
        })
      });
      if (res.ok) {
        setShowPklScoreboard(newValue);
        setSuccessMsg(newValue ? "Scoreboard sekarang ditampilkan ke siswa!" : "Scoreboard sekarang disembunyikan dari siswa!");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setErrorMsg("Gagal mengubah visibilitas scoreboard");
        setTimeout(() => setErrorMsg(""), 3000);
      }
    } catch (err) {
      setErrorMsg("Gagal menghubungi server");
      setTimeout(() => setErrorMsg(""), 3000);
    } finally {
      setTogglingScoreboard(false);
    }
  };

  // Mentor Authentication
  const [mentor, setMentor] = useState<any>(null);

  // States
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [aspects, setAspects] = useState<AspectSetting[]>([]);
  const [students, setStudents] = useState<StudentRekap[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [dailyEvals, setDailyEvals] = useState<Record<string, DailyEval>>({}); // Date key -> Eval

  // Scoreboard Tab States
  const [activeTab, setActiveTab] = useState<"evaluation" | "scoreboard">("evaluation");
  const [scoreboardData, setScoreboardData] = useState<any[]>([]);
  const [loadingScoreboard, setLoadingScoreboard] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [allTemplates, setAllTemplates] = useState<any[]>([]);

  // Loading States
  const [loading, setLoading] = useState(false);
  const [loadingEvals, setLoadingEvals] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Feedback form states for selected student
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [commentInput, setCommentInput] = useState("");

  // Tag Presets
  const tagPresets = [
    "Sangat Disiplin",
    "Inisiatif Tinggi",
    "Kerja Sama Bagus",
    "Hasil Kerja Rapi",
    "Sopan & Santun",
    "Problem Solver",
    "Tepat Waktu",
    "Fokus & Teliti",
  ];

  // Helper: Get user from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("v2_user");
    if (!stored) {
      router.push("/");
      return;
    }
    const user = JSON.parse(stored);
    if (user.role !== "mentor" && user.role !== "admin") {
      router.push("/");
      return;
    }
    setMentor(user);
  }, [router]);

  // Auto-switch selectedWeek to selected student's current active week when student changes
  useEffect(() => {
    if (selectedStudentId && students.length > 0) {
      const student = students.find(s => s.student_id === selectedStudentId);
      if (student && student.start_date) {
        // Hitung pekan aktif siswa
        const start = new Date(student.start_date);
        const now = new Date();
        
        const startDay = start.getDay();
        const diffToMondayStart = startDay === 0 ? -6 : 1 - startDay;
        const mondayOfStartWeek = new Date(start);
        mondayOfStartWeek.setDate(start.getDate() + diffToMondayStart);
        mondayOfStartWeek.setHours(0, 0, 0, 0);

        const targetDay = now.getDay();
        const diffToMondayTarget = targetDay === 0 ? -6 : 1 - targetDay;
        const mondayOfTargetWeek = new Date(now);
        mondayOfTargetWeek.setDate(now.getDate() + diffToMondayTarget);
        mondayOfTargetWeek.setHours(0, 0, 0, 0);

        const diffTime = mondayOfTargetWeek.getTime() - mondayOfStartWeek.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        let activeWeek = Math.floor(diffDays / 7) + 1;
        if (activeWeek < 1) activeWeek = 1;
        const cappedWeek = Math.min(activeWeek, 16);
        
        setSelectedWeek(cappedWeek);
      }
    }
  }, [selectedStudentId, students]);

  // API Call: Fetch Aspect Settings
  const fetchAspects = useCallback(async () => {
    try {
      const res = await fetch("/api/pkl-aspect-settings");
      if (!res.ok) throw new Error("Gagal memuat aspek");
      const data = await res.json();
      setAspects(data.filter((a: AspectSetting) => a.is_active === 1));
    } catch (err: any) {
      console.error(err);
    }
  }, []);

  // API Call: Fetch Weekly Recap List
  const fetchWeeklyRecap = useCallback(async (weekNum: number, userId: string, deviceId: string) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/v1/mentor/rekap-mingguan?week_number=${weekNum}`, {
        headers: {
          "x-user-id": userId,
          "x-device-id": deviceId,
        },
      });
      if (!res.ok) throw new Error("Gagal mengambil data rekap mingguan");
      const json = await res.json();
      const list = json.status === "success" ? json.data : [];
      setStudents(list);
      if (list.length > 0 && !selectedStudentId) {
        setSelectedStudentId(list[0].student_id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengambil data rekap");
    } finally {
      setLoading(false);
    }
  }, [selectedStudentId]);

  // API Call: Fetch Scoreboard Rankings
  const fetchScoreboard = useCallback(async (weekNum: number, userId: string, deviceId: string) => {
    setLoadingScoreboard(true);
    try {
      const res = await fetch(`/api/v1/pkl/scoreboard?week=${weekNum}`, {
        headers: {
          "x-user-id": userId,
          "x-device-id": deviceId,
        },
      });
      if (!res.ok) throw new Error("Gagal mengambil data scoreboard");
      const json = await res.json();
      if (json.status === "success" && json.data) {
        setScoreboardData(json.data.rankings || []);
      }
    } catch (err: any) {
      console.error("Gagal mengambil scoreboard:", err);
    } finally {
      setLoadingScoreboard(false);
    }
  }, []);

  // Fetch Templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/pkl-templates");
      if (res.ok) {
        const data = await res.json();
        setAllTemplates(data || []);
      }
    } catch (e) {
      console.error("Gagal mengambil template:", e);
    }
  }, []);

  // Load Initial Data
  useEffect(() => {
    fetchScoreboardVisibility();
    if (mentor) {
      fetchAspects();
      fetchTemplates();
      if (activeTab === "evaluation") {
        fetchWeeklyRecap(selectedWeek, mentor.id, mentor.device_id || "");
      } else {
        fetchScoreboard(selectedWeek, mentor.id, mentor.device_id || "");
      }
    }
  }, [mentor, selectedWeek, activeTab, fetchAspects, fetchTemplates, fetchWeeklyRecap, fetchScoreboard, fetchScoreboardVisibility]);

  // Helper: Get Monday-Friday date range for current week number based on student info
  const getMonFriDates = (startDateStr: string, weekNum: number) => {
    const start = new Date(startDateStr);
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const mondayOfStartWeek = new Date(start);
    mondayOfStartWeek.setDate(start.getDate() + diffToMonday);

    const targetMonday = new Date(mondayOfStartWeek);
    targetMonday.setDate(mondayOfStartWeek.getDate() + (weekNum - 1) * 7);

    const dates = [];
    const daysName = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
    for (let i = 0; i < 5; i++) {
      const d = new Date(targetMonday);
      d.setDate(targetMonday.getDate() + i);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const dateDay = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${dateDay}`;

      dates.push({
        name: daysName[i],
        dateStr,
        formatted: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      });
    }
    return dates;
  };

  // Find selected student details
  const currentStudent = students.find((s) => s.student_id === selectedStudentId);

  // Derived state: Calculate active student's total points from dailyEvals (source of truth)
  const currentStudentTotalPoints = useMemo(() => {
    return Object.values(dailyEvals).reduce((acc, curr) => {
      return (
        acc +
        (curr.wkt_point || 0) +
        (curr.skp_point || 0) +
        (curr.has_point || 0) +
        (curr.ker_point || 0) +
        (curr.ini_point || 0)
      );
    }, 0);
  }, [dailyEvals]);

  // Fetch daily evaluations when selected student or week changes
  useEffect(() => {
    if (!mentor || !selectedStudentId || !currentStudent) return;

    // Immediately clear local evaluation state to prevent student state leakage
    setDailyEvals({});

    const controller = new AbortController();
    const signal = controller.signal;

    const loadDailyEvals = async () => {
      setLoadingEvals(true);
      try {
        const monFri = getMonFriDates(currentStudent.start_date || "2026-06-01", selectedWeek);
        const monDate = monFri[0].dateStr;
        const friDate = monFri[4].dateStr;

        // We fetch student list from backend with date range filters to pull all evaluations for the week
        const res = await fetch(`/api/v1/mentor/siswa?start_date=${monDate}&end_date=${friDate}`, {
          signal,
          headers: {
            "x-user-id": mentor.id,
            "x-device-id": mentor.device_id || "",
          },
        });
        if (!res.ok) throw new Error("Gagal mengambil data evaluasi harian");
        const studentList = await res.json();
        const listData = studentList.status === "success" ? studentList.data : studentList;
        
        // Ensure request is not aborted and selected student is still the same
        if (signal.aborted) return;

        // Find current student from list and extract their evaluations
        const stdDetail = Array.isArray(listData)
          ? listData.find((s: any) => s.student_id === selectedStudentId)
          : null;
        if (stdDetail && stdDetail.evaluations) {
          // If the backend returned a flat object or list, map it.
          // For safety, let's map evaluations by date
          const evalsMap: Record<string, DailyEval> = {};
          // The API returns evaluations inside student detail. Let's trace it.
          if (Array.isArray(stdDetail.evaluations)) {
            stdDetail.evaluations.forEach((ev: any) => {
              evalsMap[ev.evaluation_date.split("T")[0]] = ev;
            });
          } else if (stdDetail.evaluations.evaluation_date) {
            evalsMap[stdDetail.evaluations.evaluation_date.split("T")[0]] = stdDetail.evaluations;
          }
          setDailyEvals(evalsMap);
        } else {
          setDailyEvals({});
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error(err);
        }
      } finally {
        if (!signal.aborted) {
          setLoadingEvals(false);
        }
      }
    };

    loadDailyEvals();

    // Populate feedback form safely
    setSelectedTags(currentStudent.tags || []);
    setCommentInput(currentStudent.comments || "");

    return () => {
      controller.abort();
    };
  }, [selectedStudentId, selectedWeek, mentor]);

  // Handler: Toggle Daily Point Aspek (Auto-Save)
  const handleTogglePoint = async (dateStr: string, aspectKey: string, currentVal: number) => {
    if (!mentor || !selectedStudentId) return;

    const newVal = currentVal === 1 ? 0 : 1;
    const existingEval = dailyEvals[dateStr] || {
      evaluation_date: dateStr,
      wkt_point: 0,
      skp_point: 0,
      has_point: 0,
      ker_point: 0,
      ini_point: 0,
    };

    const updatedEval = {
      ...existingEval,
      [aspectKey]: newVal,
    };

    // Optimistic UI Update
    setDailyEvals((prev) => ({
      ...prev,
      [dateStr]: updatedEval,
    }));

    try {
      const res = await fetch("/api/v1/mentor/evaluasi-harian", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": mentor.id,
          "x-device-id": mentor.device_id || "",
        },
        body: JSON.stringify({
          student_id: selectedStudentId,
          evaluation_date: dateStr,
          wkt_point: updatedEval.wkt_point,
          skp_point: updatedEval.skp_point,
          has_point: updatedEval.has_point,
          ker_point: updatedEval.ker_point,
          ini_point: updatedEval.ini_point,
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal menyimpan poin evaluasi");
      }

      // Automatically refetch weekly recap list to synchronize sidebar student total points
      fetchWeeklyRecap(selectedWeek, mentor.id, mentor.device_id || "");
    } catch (err: any) {
      // Revert Optimistic UI
      setDailyEvals((prev) => ({
        ...prev,
        [dateStr]: existingEval,
      }));
      setErrorMsg("Gagal melakukan auto-save poin: " + err.message);
    }
  };

  // Handler: Save Weekly Recap Feedback (Draft)
  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentor || !selectedStudentId) return;

    if (selectedTags.length === 0) {
      setErrorMsg("Pilih setidaknya 1 Tag Apresiasi Cepat.");
      return;
    }

    setSavingFeedback(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/v1/mentor/rekap-mingguan/${selectedStudentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": mentor.id,
          "x-device-id": mentor.device_id || "",
        },
        body: JSON.stringify({
          week_number: selectedWeek,
          tags: selectedTags,
          comments: commentInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Gagal menyimpan rekap");
      }

      // Update student list with saved details
      setStudents((prev) =>
        prev.map((s) => {
          if (s.student_id === selectedStudentId) {
            return {
              ...s,
              tags: selectedTags,
              comments: commentInput,
            };
          }
          return s;
        })
      );

      if (data.warning) {
        setErrorMsg(data.warning); // Show warning as helper notice
      } else {
        setSuccessMsg("Draft rekapitulasi berhasil disimpan!");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan rekap");
    } finally {
      setSavingFeedback(false);
    }
  };

  // Handler: Publish all summaries for current week
  const handlePublishAll = async () => {
    if (!mentor) return;

    // Validate that all students have at least one tag
    const incomplete = students.filter((s) => !s.tags || s.tags.length === 0);
    if (incomplete.length > 0) {
      const names = incomplete.map((s) => s.student_name).join(", ");
      setErrorMsg(`Semua siswa harus diisi tag apresiasi terlebih dahulu sebelum dipublikasikan. Siswa belum lengkap: ${names}`);
      return;
    }

    if (!confirm("Apakah Anda yakin ingin mempublikasikan seluruh rekap poin minggu ini ke dashboard siswa? Setelah dipublikasikan, data tidak dapat diubah lagi.")) return;

    setPublishing(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/v1/mentor/rekap-mingguan/publikasikan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": mentor.id,
          "x-device-id": mentor.device_id || "",
        },
        body: JSON.stringify({
          week_number: selectedWeek,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Gagal mempublikasikan rekap");
      }

      setSuccessMsg("Poin minggu ini berhasil dipublikasikan ke siswa!");
      fetchWeeklyRecap(selectedWeek, mentor.id, mentor.device_id || "");
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mempublikasikan");
    } finally {
      setPublishing(false);
    }
  };

  // Handler: Unpublish/Hide all summaries for current week
  const handleUnpublishAll = async () => {
    if (!mentor) return;

    if (!confirm("Apakah Anda yakin ingin menyembunyikan poin minggu ini dari dashboard siswa dan mengembalikannya ke Draft?")) return;

    setPublishing(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/v1/mentor/rekap-mingguan/sembunyikan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": mentor.id,
          "x-device-id": mentor.device_id || "",
        },
        body: JSON.stringify({
          week_number: selectedWeek,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Gagal menyembunyikan rekap");
      }

      setSuccessMsg("Poin minggu ini berhasil disembunyikan (dikembalikan ke Draft)!");
      fetchWeeklyRecap(selectedWeek, mentor.id, mentor.device_id || "");
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyembunyikan");
    } finally {
      setPublishing(false);
    }
  };

  // Toggle tag selection
  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Helper Icon Picker
  const getAspectIcon = (iconName: string) => {
    switch (iconName) {
      case "Clock":
        return <Clock size={16} />;
      case "Smile":
        return <SmileIcon size={16} />;
      case "CheckSquare":
        return <CheckSquareIcon size={16} />;
      case "User":
        return <User size={16} />;
      case "Sparkles":
        return <Sparkles size={16} />;
      default:
        return <HelpCircle size={16} />;
    }
  };

  const isAnyPublished = useMemo(() => {
    return students.some((s) => s.is_published);
  }, [students]);

  return (
    <div className="flex-1 bg-[#F0F2F5] p-4 md:p-8 select-none min-h-screen font-sans">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-[#2AB0B2]/10 rounded-xl text-[#2AB0B2]">
              <Award size={22} />
            </span>
            Scoreboard Poin Apresiasi PKL
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 ml-[42px]">
            Input evaluasi harian (+1 atau 0) dan kelola rekap poin apresiasi siswa magang.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Show/Hide Scoreboard Toggle */}
          <button
            onClick={toggleScoreboardVisibility}
            disabled={togglingScoreboard}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 cursor-pointer ${
              showPklScoreboard
                ? "bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100"
                : "bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Trophy size={14} className={showPklScoreboard ? "text-emerald-500" : "text-slate-400"} />
            {showPklScoreboard ? "Scoreboard: Tampil" : "Scoreboard: Sembunyi"}
          </button>

          {/* Week Selector */}
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 border border-slate-200 rounded-xl">
            <Calendar size={15} className="text-slate-400" />
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Minggu Ke
            </span>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
              className="text-xs font-bold text-slate-800 outline-none bg-white cursor-pointer"
            >
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab("evaluation")}
          className={`pb-3 text-sm font-bold border-b-2 px-4 transition-all cursor-pointer ${
            activeTab === "evaluation"
              ? "border-[#2AB0B2] text-[#1C3D3F]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Evaluasi & Input Nilai
        </button>
        <button
          onClick={() => setActiveTab("scoreboard")}
          className={`pb-3 text-sm font-bold border-b-2 px-4 transition-all cursor-pointer ${
            activeTab === "scoreboard"
              ? "border-[#2AB0B2] text-[#1C3D3F]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Klasemen & Scoreboard Mingguan
        </button>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-auto text-rose-400 hover:text-rose-600 cursor-pointer">
            Tutup
          </button>
        </div>
      )}
      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="ml-auto text-emerald-400 hover:text-emerald-600 cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {activeTab === "evaluation" ? (
        /* TAB 1: EVALUATION (ORIGINAL LAYOUT) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Side: Student List & Summary Feed */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Users size={16} className="text-[#2AB0B2]" />
                  Siswa Bimbingan ({students.length})
                </h2>

                {students.length > 0 && (
                  isAnyPublished ? (
                    <button
                      onClick={handleUnpublishAll}
                      disabled={publishing}
                      className="bg-slate-700 hover:bg-slate-800 disabled:bg-slate-350 text-white font-extrabold text-[10px] uppercase tracking-wider py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      {publishing ? (
                        <Loader2 className="animate-spin" size={10} />
                      ) : (
                        <EyeOff size={10} />
                      )}
                      Sembunyikan Poin
                    </button>
                  ) : (
                    <button
                      onClick={handlePublishAll}
                      disabled={publishing}
                      className="bg-[#2AB0B2] hover:bg-[#1E8E90] disabled:bg-slate-350 text-white font-extrabold text-[10px] uppercase tracking-wider py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      {publishing ? (
                        <Loader2 className="animate-spin" size={10} />
                      ) : (
                        <Send size={10} />
                      )}
                      Publikasikan
                    </button>
                  )
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-[#2AB0B2]" size={24} />
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-xs text-slate-400 font-medium">Belum ada siswa bimbingan yang terdaftar.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {students.map((student) => {
                    const isSelected = student.student_id === selectedStudentId;
                    const hasDraft = student.tags && student.tags.length > 0;
                    return (
                      <div
                        key={student.student_id}
                        onClick={() => setSelectedStudentId(student.student_id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                          isSelected
                            ? "bg-[#2AB0B2]/5 border-[#2AB0B2] shadow-xs"
                            : "bg-white border-slate-200/70 hover:bg-slate-50/50 hover:border-slate-300"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-xs font-bold truncate ${isSelected ? "text-[#1E8E90]" : "text-slate-800"}`}>
                              {student.student_name}
                            </h3>
                            {student.is_published ? (
                              <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-wide">
                                Publik
                              </span>
                            ) : hasDraft ? (
                              <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-wide">
                                Draft
                              </span>
                            ) : (
                              <span className="text-[8px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-wide">
                                Belum Dinilai
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-450 truncate mt-1">
                            {student.school_name}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <span className="text-xs font-black text-[#2AB0B2] bg-[#2AB0B2]/10 px-2 py-0.5 rounded-lg border border-[#2AB0B2]/20">
                              {isSelected ? currentStudentTotalPoints : student.total_points} Poin
                            </span>
                          </div>
                          <ChevronRight
                            size={14}
                            className={`transition-transform ${
                              isSelected ? "text-[#2AB0B2] translate-x-0.5" : "text-slate-300 group-hover:text-slate-400"
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Feedback Form for Selected Student */}
            {currentStudent && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6 animate-in fade-in">
                <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <MessageSquare size={16} className="text-[#2AB0B2]" />
                  Rekap & Umpan Balik: {currentStudent.student_name}
                </h2>

                <form onSubmit={handleSaveFeedback} className="space-y-4">
                  {/* Tag Apresiasi Cepat */}
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-455 uppercase tracking-wider mb-2">
                      Tag Apresiasi Cepat (Pilih Min. 1)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {tagPresets.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleToggleTag(tag)}
                            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[#2AB0B2] text-white border-[#2AB0B2] shadow-xs"
                                : "bg-slate-50 text-slate-550 border-slate-200 hover:bg-slate-100/60"
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Comment Input */}
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-455 uppercase tracking-wider mb-1.5">
                      Catatan Pembimbing
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Tulis kritik konstruktif atau apresiasi detail untuk siswa..."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#2AB0B2]/5 focus:border-[#2AB0B2] transition-all bg-white"
                    />
                    {currentStudentTotalPoints < 12 && !commentInput.trim() && (
                      <p className="text-[10px] text-amber-600 font-bold mt-1">
                        💡 Disarankan menulis catatan bimbingan karena total poin minggu ini di bawah 12.
                      </p>
                    )}
                  </div>

                  {/* Submit Feedback */}
                  <button
                    type="submit"
                    disabled={savingFeedback}
                    className="w-full bg-[#2AB0B2] hover:bg-[#1E8E90] disabled:bg-slate-300 text-white font-extrabold text-xs py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {savingFeedback ? (
                      <Loader2 className="animate-spin" size={13} />
                    ) : (
                      <Save size={13} />
                    )}
                    Simpan Draft Rekap Mingguan
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Right Side: Daily Evaluations details */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
              <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                <ClipboardList size={16} className="text-[#2AB0B2]" />
                Evaluasi Harian
              </h2>

              {!selectedStudentId ? (
                <div className="text-center py-12">
                  <p className="text-xs text-slate-400 font-medium">Pilih siswa bimbingan terlebih dahulu.</p>
                </div>
              ) : loadingEvals ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-[#2AB0B2]" size={24} />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Information Header */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[11px] text-slate-600 leading-relaxed">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                      <Info size={14} className="text-[#2AB0B2]" />
                      <span>Auto-Save Aktif:</span>
                    </div>
                    <p className="text-slate-500 font-medium pl-5">
                      Klik badge aspek (+1) di bawah nama hari untuk memberikan poin harian. Nilai tersimpan otomatis ke database. Evaluasi hanya dapat diisi untuk hari kerja yang sedang berjalan atau sudah berlalu.
                    </p>
                  </div>

                  {/* Days Loop */}
                  {currentStudent &&
                    getMonFriDates(currentStudent.start_date || "2026-06-01", selectedWeek).map((day) => {
                      const evalDay = dailyEvals[day.dateStr] || {
                        evaluation_date: day.dateStr,
                        wkt_point: 0,
                        skp_point: 0,
                        has_point: 0,
                        ker_point: 0,
                        ini_point: 0,
                      };
                      const isFuture = day.dateStr > todayStr;
                      const studentStartDateStr = currentStudent.start_date
                        ? new Date(currentStudent.start_date).toISOString().split('T')[0]
                        : "2026-06-01";
                      const isBeforeStart = day.dateStr < studentStartDateStr;
                      const isDisabled = isFuture || isBeforeStart;

                      return (
                        <div
                          key={day.dateStr}
                          className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            isDisabled
                              ? "bg-slate-50/50 border-slate-200/40 opacity-80"
                              : "bg-white border-slate-200/60 hover:border-slate-300"
                          }`}
                        >
                          {/* Day Title & Date */}
                          <div className="flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                {day.name}
                              </h3>
                              {isFuture && (
                                <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  Belum Mulai
                                </span>
                              )}
                              {isBeforeStart && (
                                <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  Belum PKL
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                              {day.formatted}
                            </span>
                          </div>

                          {/* Aspect Points */}
                          <div className="flex flex-wrap gap-2.5 flex-1 md:justify-end">
                            {aspects.map((aspect) => {
                              const currentPoint = (evalDay as any)[aspect.aspect_key] || 0;
                              const hasPoint = currentPoint === 1;

                              return (
                                <button
                                  key={aspect.aspect_key}
                                  type="button"
                                  disabled={isDisabled}
                                  onClick={() =>
                                    handleTogglePoint(day.dateStr, aspect.aspect_key, currentPoint)
                                  }
                                  className={`text-[10px] font-bold py-1.5 px-3 rounded-xl border flex items-center gap-1.5 transition-all ${
                                    isDisabled
                                      ? "bg-slate-100/50 text-slate-300 border-slate-150 cursor-not-allowed opacity-60"
                                      : hasPoint
                                      ? "bg-[#2AB0B2] text-white border-[#2AB0B2] shadow-xs cursor-pointer"
                                      : "bg-slate-50 text-slate-550 border-slate-200/60 hover:bg-slate-100/50 cursor-pointer"
                                  }`}
                                  title={
                                    isFuture
                                      ? `Aspek ${aspect.label} belum dapat dinilai (hari mendatang)`
                                      : isBeforeStart
                                      ? `Siswa belum memulai PKL pada tanggal ini`
                                      : `Klik untuk mengubah nilai aspek ${aspect.label}`
                                  }
                                >
                                  {getAspectIcon(aspect.icon_name)}
                                  <span>{aspect.label.split(" ")[0]}</span>
                                  <span className={`font-black rounded px-1 text-[9px] ${
                                    isFuture
                                      ? "bg-slate-200 text-slate-400"
                                      : hasPoint
                                      ? "bg-white/20"
                                      : "bg-slate-200/80 text-slate-650"
                                  }`}>
                                    {hasPoint ? "+1" : "0"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: SCOREBOARD (RICH VIEW) */
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
              <Filter size={16} className="text-[#2AB0B2]" />
              <span>Filter Klasemen:</span>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              {/* School Filter */}
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase">Sekolah</span>
                <select
                  value={selectedSchool}
                  onChange={(e) => setSelectedSchool(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                >
                  <option value="">Semua Sekolah</option>
                  {Array.from(new Set(scoreboardData.map((s) => s.school_name)))
                    .filter(Boolean)
                    .map((school) => (
                      <option key={school} value={school}>
                        {school}
                      </option>
                    ))}
                </select>
              </div>

              {/* Template Filter */}
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase">Template PKL</span>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                >
                  <option value="">Semua Template</option>
                  {allTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loadingScoreboard ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-2xl border border-slate-200">
              <Loader2 className="animate-spin text-[#2AB0B2]" size={36} />
              <p className="text-xs text-slate-450 font-bold">Menghitung peringkat klasemen...</p>
            </div>
          ) : (
            (() => {
              // Apply Frontend Filters
              const filteredList = scoreboardData.filter((item) => {
                if (selectedSchool && item.school_name !== selectedSchool) return false;
                if (selectedTemplate && String(item.program_template_id) !== String(selectedTemplate)) return false;
                return true;
              });

              // Extract Top 3 Performers
              const topPerformers = filteredList.slice(0, 3);
              // Extract Students Needing Attention (poin < 12)
              const needingAttention = filteredList.filter((s) => s.total_points < 12);

              return (
                <div className="space-y-6">
                  {/* Top Performers Podium */}
                  {filteredList.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-4">
                      {/* Rank 2 (Left) */}
                      {topPerformers[1] && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col items-center text-center order-2 md:order-1 h-fit transform md:scale-95 transition-all">
                          <div className="relative mb-3">
                            {topPerformers[1].student_avatar ? (
                              <img
                                src={topPerformers[1].student_avatar}
                                alt={topPerformers[1].student_name}
                                className="w-16 h-16 rounded-full object-cover border-4 border-slate-200"
                              />
                            ) : (
                              <div className={`w-16 h-16 rounded-full border-4 border-slate-200 flex items-center justify-center font-bold text-lg ${getAvatarColorClass(topPerformers[1].student_id)}`}>
                                {getInitials(topPerformers[1].student_name)}
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-slate-400 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">
                              2
                            </div>
                          </div>
                          <h3 className="text-xs font-bold text-slate-800 line-clamp-1">{topPerformers[1].student_name}</h3>
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{topPerformers[1].school_name}</p>
                          <div className="mt-3 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
                            <span className="text-xs font-extrabold text-[#2AB0B2]">{topPerformers[1].student_id === selectedStudentId ? currentStudentTotalPoints : topPerformers[1].total_points} Poin</span>
                          </div>
                        </div>
                      )}

                      {/* Rank 1 (Center) */}
                      {topPerformers[0] && (
                        <div className="bg-[#1C3D3F] rounded-2xl border border-[#2AB0B2]/30 shadow-md p-8 flex flex-col items-center text-center order-1 md:order-2 transform md:scale-105 transition-all relative overflow-hidden">
                          <div className="absolute top-0 right-0 bg-[#2AB0B2]/10 p-4 rounded-bl-3xl">
                            <Trophy className="text-[#2AB0B2]" size={28} />
                          </div>
                          <div className="relative mb-4">
                            {topPerformers[0].student_avatar ? (
                              <img
                                src={topPerformers[0].student_avatar}
                                alt={topPerformers[0].student_name}
                                className="w-20 h-20 rounded-full object-cover border-4 border-[#2AB0B2]"
                              />
                            ) : (
                              <div className={`w-20 h-20 rounded-full border-4 border-[#2AB0B2] flex items-center justify-center font-bold text-xl ${getAvatarColorClass(topPerformers[0].student_id)}`}>
                                {getInitials(topPerformers[0].student_name)}
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-[#2AB0B2] text-[#1C3D3F] rounded-full w-7 h-7 flex items-center justify-center text-sm font-black">
                              1
                            </div>
                          </div>
                          <h3 className="text-sm font-black text-white line-clamp-1">{topPerformers[0].student_name}</h3>
                          <p className="text-[10px] text-[#2AB0B2] font-semibold line-clamp-1 mt-0.5">{topPerformers[0].school_name}</p>
                          <div className="mt-4 bg-[#2AB0B2]/10 border border-[#2AB0B2]/20 px-4 py-1.5 rounded-xl">
                            <span className="text-sm font-black text-[#2AB0B2]">{topPerformers[0].student_id === selectedStudentId ? currentStudentTotalPoints : topPerformers[0].total_points} Poin</span>
                          </div>
                        </div>
                      )}

                      {/* Rank 3 (Right) */}
                      {topPerformers[2] && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col items-center text-center order-3 h-fit transform md:scale-90 transition-all">
                          <div className="relative mb-3">
                            {topPerformers[2].student_avatar ? (
                              <img
                                src={topPerformers[2].student_avatar}
                                alt={topPerformers[2].student_name}
                                className="w-14 h-14 rounded-full object-cover border-4 border-amber-200"
                              />
                            ) : (
                              <div className={`w-14 h-14 rounded-full border-4 border-amber-200 flex items-center justify-center font-bold text-sm ${getAvatarColorClass(topPerformers[2].student_id)}`}>
                                {getInitials(topPerformers[2].student_name)}
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black">
                              3
                            </div>
                          </div>
                          <h3 className="text-xs font-bold text-slate-800 line-clamp-1">{topPerformers[2].student_name}</h3>
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{topPerformers[2].school_name}</p>
                          <div className="mt-3 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
                            <span className="text-xs font-extrabold text-[#2AB0B2]">{topPerformers[2].student_id === selectedStudentId ? currentStudentTotalPoints : topPerformers[2].total_points} Poin</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Attention panel & Full Rankings Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Full Leaderboard Table */}
                    <div className={`${needingAttention.length > 0 ? "lg:col-span-8" : "lg:col-span-12"} bg-white rounded-2xl border border-slate-200 p-5 md:p-6`}>
                      <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Award size={16} className="text-[#2AB0B2]" />
                        Tabel Klasemen Lengkap
                      </h2>

                      {filteredList.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-xs text-slate-400 font-medium">Tidak ada siswa yang cocok dengan filter saat ini.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100">
                                <th className="py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-2 w-12 text-center">Rank</th>
                                <th className="py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Siswa</th>
                                <th className="py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Sekolah</th>
                                <th className="py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-center w-20">Perfect</th>
                                <th className="py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Apresiasi Badges</th>
                                <th className="py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-right pr-2 w-24">Poin</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredList.map((item) => {
                                const isRank1 = item.rank === 1;
                                const isRank2 = item.rank === 2;
                                const isRank3 = item.rank === 3;
                                
                                return (
                                  <tr key={item.student_id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                                    {/* Rank badge */}
                                    <td className="py-3.5 pl-2 text-center">
                                      <div className="flex flex-col items-center justify-center">
                                        {isRank1 ? (
                                          <Trophy size={16} className="text-[#2AB0B2]" />
                                        ) : isRank2 ? (
                                          <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">2</span>
                                        ) : isRank3 ? (
                                          <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">3</span>
                                        ) : (
                                          <span className="text-xs font-bold text-slate-400">{item.rank}</span>
                                        )}
                                        {/* Rank Movement */}
                                        <div className="flex items-center gap-0.5 mt-0.5">
                                          {item.rank_movement > 0 ? (
                                            <span className="text-[8px] font-extrabold text-emerald-600 flex items-center">
                                              <ArrowUp size={8} /> {item.rank_movement}
                                            </span>
                                          ) : item.rank_movement < 0 ? (
                                            <span className="text-[8px] font-extrabold text-rose-650 flex items-center">
                                              <ArrowDown size={8} /> {Math.abs(item.rank_movement)}
                                            </span>
                                          ) : (
                                            <span className="text-[8px] font-extrabold text-slate-350 flex items-center">
                                              <Minus size={8} />
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    {/* Profile & Name */}
                                    <td className="py-3.5 pr-2">
                                      <div className="flex items-center gap-2.5">
                                        {item.student_avatar ? (
                                          <img
                                            src={item.student_avatar}
                                            alt={item.student_name}
                                            className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                          />
                                        ) : (
                                          <div className={`w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center font-bold text-xs ${getAvatarColorClass(item.student_id)}`}>
                                            {getInitials(item.student_name)}
                                          </div>
                                        )}
                                        <div className="min-w-0">
                                          <h4 className="text-xs font-bold text-slate-800 truncate">{item.student_name}</h4>
                                          <span className="text-[9px] text-slate-400 sm:hidden block truncate mt-0.5">{item.school_name}</span>
                                        </div>
                                      </div>
                                    </td>

                                    {/* School */}
                                    <td className="py-3.5 text-xs font-semibold text-slate-500 hidden sm:table-cell truncate max-w-[120px]">
                                      {item.school_name}
                                    </td>

                                    {/* Perfect days */}
                                    <td className="py-3.5 text-center">
                                      <span className="text-[10px] font-extrabold text-teal-650 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100">
                                        {item.perfect_days} Hari
                                      </span>
                                    </td>

                                    {/* Badges */}
                                    <td className="py-3.5">
                                      <div className="flex flex-wrap gap-1">
                                        {item.badges && item.badges.length > 0 ? (
                                          item.badges.map((badge: string) => (
                                            <span
                                              key={badge}
                                              className="text-[8px] font-extrabold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200/50 flex items-center gap-1"
                                            >
                                              <Sparkles size={8} className="text-[#2AB0B2]" />
                                              {badge}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-[9px] text-slate-350 font-medium italic">-</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Total points */}
                                    <td className="py-3.5 text-right pr-2">
                                      <span className="text-xs font-black text-[#2AB0B2]">
                                        {item.student_id === selectedStudentId ? currentStudentTotalPoints : item.total_points} Pts
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Needs Attention Sidebar */}
                    {needingAttention.length > 0 && (
                      <div className="lg:col-span-4 bg-rose-50/50 rounded-2xl border border-rose-100 p-5 md:p-6 h-fit space-y-4">
                        <h3 className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle size={15} /> Siswa Perlu Perhatian
                        </h3>
                        <p className="text-[10px] text-rose-600 leading-relaxed font-semibold">
                          Daftar siswa dengan performa mingguan di bawah target (kurang dari 12 poin). Harap berikan umpan balik atau bimbingan khusus.
                        </p>
                        <div className="space-y-2.5">
                          {needingAttention.map((student) => (
                            <div key={student.student_id} className="p-3 bg-white rounded-xl border border-rose-100 flex items-center justify-between">
                              <div className="min-w-0 pr-2">
                                <h4 className="text-xs font-bold text-slate-800 truncate">{student.student_name}</h4>
                                <span className="text-[9px] text-slate-400 block mt-0.5 truncate">{student.school_name}</span>
                              </div>
                              <span className="text-xs font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-150 flex-shrink-0">
                                {student.student_id === selectedStudentId ? currentStudentTotalPoints : student.total_points} Pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}

// Helpers for initials and colors consistent generation
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

// Sub components for Lucide icons compatibility
function SmileIcon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size || "24"}
      height={props.size || "24"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
    </svg>
  );
}

function CheckSquareIcon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size || "24"}
      height={props.size || "24"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
