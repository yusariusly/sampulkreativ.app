"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Key, ChevronDown, ChevronUp, Copy, Check, ShieldCheck, Pencil, Trash2, X, RefreshCw, Unlink, CalendarClock, Calendar, CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List, Palmtree, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

function parseSafeDate(dateStr: string) {
  if (!dateStr) return new Date();
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-").map(Number);
    if (parts[0] > 1000) {
      // YYYY-MM-DD
      return new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      // DD-MM-YYYY
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
  }
  return new Date(dateStr);
}


interface KieSubmission {
  id: number;
  user_id: string;
  api_key: string;
  submitted_at: string;
}

interface UserKieData {
  id: string;
  username: string;
  nama_lengkap: string;
  role: string;
  foto_profile?: string;
  kie_debt?: number;
  telegram_chat_id?: string;
  telegram_chat_name?: string;
  created_at?: string;
  pkl_start_date?: string;
  pkl_end_date?: string;
  kie_start_date?: string;
  submissions: KieSubmission[];
}

const ROLE_LABELS: Record<string, string> = {
  student: "Siswa PKL",
  employee: "Karyawan",
  mentor: "Mentor",
};

const ROLE_COLORS: Record<string, string> = {
  student: "bg-purple-50 text-purple-600 border-purple-100",
  employee: "bg-blue-50 text-blue-600 border-blue-100",
  mentor: "bg-amber-50 text-amber-600 border-amber-100",
};

const groupSubmissionsByDate = (subs: KieSubmission[]) => {
  const groups: Record<string, KieSubmission[]> = {};
  subs.forEach((sub) => {
    const dateObj = new Date(sub.submitted_at);
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(dateObj);
    if (!groups[dateStr]) {
      groups[dateStr] = [];
    }
    groups[dateStr].push(sub);
  });
  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map((dateStr) => ({
      dateStr,
      items: groups[dateStr],
    }));
};

const getDailyAuditList = (subs: KieSubmission[], userPklStartDate?: string, holidayMap: Record<string, string> = {}, userKieStartDate?: string, userPklEndDate?: string) => {
  const groups: Record<string, KieSubmission[]> = {};
  subs.forEach((sub) => {
    const dateObj = new Date(sub.submitted_at);
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(dateObj);
    if (!groups[dateStr]) {
      groups[dateStr] = [];
    }
    groups[dateStr].push(sub);
  });

  const todayFormatted = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const [ty, tm, td] = todayFormatted.split('-').map(Number);
  const todayDate = new Date(Date.UTC(ty, tm - 1, td));

  // PKL start date (tanggal masuk PKL)
  let pklDate = new Date(todayDate.getTime());
  if (userPklStartDate) {
    const parsedReg = new Date(userPklStartDate);
    const formatted = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(parsedReg);
    const [y, m, d] = formatted.split('-').map(Number);
    pklDate = new Date(Date.UTC(y, m - 1, d));
  }

  // KIE start date (tanggal mulai perhitungan kewajiban KIE yang diatur admin)
  let kieStartDate = pklDate;
  if (userKieStartDate) {
    const parsedKie = new Date(userKieStartDate);
    const formatted = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(parsedKie);
    const [y, m, d] = formatted.split('-').map(Number);
    kieStartDate = new Date(Date.UTC(y, m - 1, d));
  }
  
  const startDate = kieStartDate;

  let earliestSubDate = startDate;
  const groupKeys = Object.keys(groups).sort();
  if (groupKeys.length > 0) {
    const earliestSubStr = groupKeys[0];
    const [y, m, d] = earliestSubStr.split('-').map(Number);
    const subDate = new Date(Date.UTC(y, m - 1, d));
    if (subDate.getTime() < startDate.getTime()) {
      earliestSubDate = subDate;
    }
  }

  // Build list of dates chronologically (oldest to newest)
  const chronologicalDates: Date[] = [];
  let current = new Date(earliestSubDate);
  while (current.getTime() <= todayDate.getTime()) {
    chronologicalDates.push(new Date(current));
    current.setTime(current.getTime() + 24 * 60 * 60 * 1000);
  }

  // Calculate strict running balance (Backend Logic - Opsi A)
  let C = 0;
  let totalTarget = 0;
  const auditList: any[] = [];

  chronologicalDates.forEach((date) => {
    const dateStr = date.toISOString().split('T')[0];
    const items = groups[dateStr] || [];
    const count = items.length;
    const dayOfWeek = date.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = !!holidayMap[dateStr];
    const holidayName = holidayMap[dateStr] || "Tanggal Merah";
    const isToday = dateStr === todayFormatted;
    
    const isBeforeKieStart = date.getTime() < kieStartDate.getTime();
    const isBeforePkl = date.getTime() < pklDate.getTime();
    
    // If before KIE start date and no submissions, don't show the empty row in list
    if (isBeforeKieStart && count === 0) {
      return;
    }

    const targetToday = (isWeekend || isBeforeKieStart || isHoliday) ? 0 : 4;
    totalTarget += targetToday;
    
    C = Math.min(C + count, totalTarget);
    const currentKieDebt = Math.max(0, totalTarget - C);

    let statusLabel = "";
    let statusColor = "";

    if (isBeforeKieStart) {
      statusLabel = `Setor Sebelum Mulai KIE (${count} Keys)`;
      statusColor = "text-purple-600 bg-purple-50 border-purple-200/60 font-medium";
    } else if (isHoliday) {
      if (count === 0) {
        statusLabel = `Libur: ${holidayName}`;
        statusColor = "text-rose-600 bg-rose-50 border-rose-200/70 font-semibold";
      } else {
        statusLabel = `Setor Saat Libur (${count} Keys) - ${holidayName} (Sisa Hutang: ${currentKieDebt})`;
        statusColor = "text-emerald-600 bg-emerald-50 border-emerald-250/60 font-medium";
      }
    } else if (isWeekend) {
      if (count === 0) {
        statusLabel = "Hari Libur (Rest Day)";
        statusColor = "text-slate-500 bg-slate-50 border-slate-200";
      } else {
        statusLabel = `Setor Saat Libur (${count} Keys) - Sisa Hutang: ${currentKieDebt}`;
        statusColor = "text-emerald-600 bg-emerald-50 border-emerald-250/60";
      }
    } else {
      if (count >= targetToday) {
        if (currentKieDebt > 0) {
          statusLabel = `Target Harian Tercapai (Sisa Hutang: ${currentKieDebt})`;
          statusColor = "text-amber-600 bg-amber-50 border-amber-200/60";
        } else {
          statusLabel = "Target Tercapai & Bebas Hutang";
          statusColor = "text-emerald-600 bg-emerald-50 border-emerald-250/60";
        }
      } else {
        const missedToday = targetToday - count;
        statusLabel = `Kurang Setor Harian (-${missedToday}) | Total Hutang: ${currentKieDebt}`;
        statusColor = "text-red-600 bg-red-50 border-red-200/60 font-black";
      }
    }

    auditList.unshift({ // Add to beginning so newest is first
      dateStr,
      items,
      count,
      target: targetToday,
      accumulatedTarget: totalTarget,
      accumulatedCounted: C,
      debt: currentKieDebt,
      statusLabel,
      statusColor,
      isToday,
      isWeekend,
      isHoliday,
      isBeforeKieStart,
      isBeforePkl,
      holidayName
    });
  });

  return auditList;
};

export default function AdminKiePage() {
  const [users, setUsers] = useState<UserKieData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [filter, setFilter] = useState<"all" | "debt" | "nodebt">("all");
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({});
  const [userCalMonths, setUserCalMonths] = useState<Record<string, Date>>({});
  const [userSelectedDates, setUserSelectedDates] = useState<Record<string, string>>({});
  const [userViewModes, setUserViewModes] = useState<Record<string, "calendar" | "list">>({});

  useEffect(() => {
    fetch('/api/holidays')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const map: Record<string, string> = {};
          data.forEach((h: any) => {
            if (h.tanggal) {
              map[h.tanggal.slice(0, 10)] = h.keterangan || 'Tanggal Merah';
            }
          });
          setHolidayMap(map);
        }
      })
      .catch(err => console.error("Gagal memuat daftar hari libur:", err));
  }, []);
  
  // Telegram monitoring states
  const [activeTab, setActiveTab] = useState<"submissions" | "telegram">("submissions");
  const [telegramUsers, setTelegramUsers] = useState<any[]>([]);
  const [loadingTelegram, setLoadingTelegram] = useState(false);

  // Set Start Date Modal states
  const [showStartDateModal, setShowStartDateModal] = useState(false);
  const [startDateStudents, setStartDateStudents] = useState<{id: string, nama_lengkap: string}[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedStartDate, setSelectedStartDate] = useState("");
  const [submittingStartDate, setSubmittingStartDate] = useState(false);

  // Sentinel for infinite scroll
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  const fetchSubmissions = useCallback(async (pageNum: number, currentFilter: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/kie/admin/users-submissions?page=${pageNum}&limit=3&filter=${currentFilter}`);
      if (res.ok) {
        const data = await res.json();
        if (pageNum === 1) {
          setUsers(data.users);
        } else {
          setUsers((prev) => {
            const existingIds = prev.map((u) => u.id);
            const filteredNew = data.users.filter((u: UserKieData) => !existingIds.includes(u.id));
            return [...prev, ...filteredNew];
          });
        }
        setHasMore(data.hasMore);
      }
    } catch (err) {
      console.error("Gagal mengambil data submissions KIE:", err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const handleFilterChange = (newFilter: "all" | "debt" | "nodebt") => {
    setFilter(newFilter);
    setPage(1);
    setUsers([]);
    setHasMore(true);
  };

  // Fetch when page or filter changes
  useEffect(() => {
    fetchSubmissions(page, filter);
  }, [page, filter, fetchSubmissions]);

  // Infinite scroll Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current && users.length > 0) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [hasMore, users.length]);

  const toggleAccordion = (userId: string) => {
    setExpandedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const copyToClipboard = (keyText: string, submissionId: number) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(submissionId);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const startEdit = (submissionId: number, currentKey: string) => {
    setEditingId(submissionId);
    setEditValue(currentKey);
  };

  const handleSaveEdit = async (submissionId: number, userId: string) => {
    const cleanVal = editValue.trim();
    if (cleanVal.length !== 32) {
      alert("Kunci API harus tepat 32 karakter");
      return;
    }
    try {
      const res = await fetch(`/api/kie/admin/submissions/${submissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: cleanVal })
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => {
          if (u.id === userId) {
            return {
              ...u,
              submissions: u.submissions.map(s => {
                if (s.id === submissionId) {
                  return { ...s, api_key: cleanVal };
                }
                return s;
              })
            };
          }
          return u;
        }));
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id === userId) {
              return {
                ...u,
                submissions: u.submissions.map((sub) =>
                  sub.id === submissionId ? { ...sub, api_key: cleanVal } : sub
                ),
              };
            }
            return u;
          })
        );
        setEditingId(null);
        setEditValue("");
        handleFilterChange(filter);
      } else {
        const data = await res.json();
        alert(data.error || "Gagal memperbarui API KIE");
      }
    } catch (err) {
      console.error("Error editing KIE:", err);
      alert("Gagal menghubungi server");
    }
  };

  const openStartDateModal = async () => {
    setShowStartDateModal(true);
    setSelectedStudentIds([]);
    setSelectedStartDate("");
    try {
      const res = await fetch("/api/kie/admin/students");
      if (res.ok) {
        const data = await res.json();
        setStartDateStudents(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveStartDate = async () => {
    if (selectedStudentIds.length === 0 || !selectedStartDate) {
      alert("Pilih minimal satu siswa dan isi tanggalnya.");
      return;
    }
    setSubmittingStartDate(true);
    try {
      const res = await fetch("/api/kie/admin/set-start-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_ids: selectedStudentIds,
          start_date: selectedStartDate
        }),
      });
      if (res.ok) {
        alert("Tanggal KIE berhasil diatur!");
        setShowStartDateModal(false);
        handleFilterChange(filter);
      } else {
        const err = await res.json();
        alert(err.error || "Gagal mengatur tanggal");
      }
    } catch (error) {
      alert("Terjadi kesalahan saat menyimpan tanggal.");
    } finally {
      setSubmittingStartDate(false);
    }
  };

  const handleDeleteSubmission = async (submissionId: number, userId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus API KIE ini?")) return;
    try {
      const res = await fetch(`/api/kie/admin/submissions/${submissionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => {
          if (u.id === userId) {
            return {
              ...u,
              submissions: u.submissions.filter(s => s.id !== submissionId)
            };
          }
          return u;
        }));
      } else {
        alert("Gagal menghapus API KIE");
      }
    } catch (err) {
      console.error("Error deleting KIE:", err);
      alert("Gagal menghubungi server");
    }
  };

  const fetchTelegramGroups = async () => {
    setLoadingTelegram(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        const registered = data.filter((u: any) => u.telegram_chat_id);
        setTelegramUsers(registered);
      }
    } catch (err) {
      console.error("Gagal memuat grup Telegram:", err);
    } finally {
      setLoadingTelegram(false);
    }
  };

  const handleDisconnectTelegram = async (userId: string, fullname: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin memutuskan koneksi Telegram untuk "${fullname}"?`)) return;
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          telegram_chat_id: ""
        })
      });
      if (res.ok) {
        fetchTelegramGroups();
      } else {
        alert("Gagal memutuskan koneksi Telegram");
      }
    } catch (err) {
      console.error("Error disconnecting Telegram:", err);
      alert("Gagal menghubungi server");
    }
  };

  useEffect(() => {
    if (activeTab === "telegram") {
      fetchTelegramGroups();
    }
  }, [activeTab]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1C3D3F] tracking-tight">API KIE</h1>
          <p className="text-gray-400 text-xs mt-1">Daftar kunci API KIE yang dikirimkan oleh tiap pengguna (Karyawan & Siswa PKL).</p>
        </div>
        <div className="flex items-center gap-2 bg-[#2AB0B2]/10 border border-[#2AB0B2]/20 px-3.5 py-1.5 rounded-full">
          <ShieldCheck size={16} className="text-[#2AB0B2]" />
          <span className="text-xs font-bold text-[#1C3D3F]">Panel Keamanan Admin</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => setActiveTab("submissions")}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "submissions"
              ? "border-[#2AB0B2] text-[#2AB0B2]"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          🔑 Setoran KIE API
        </button>
        <button
          onClick={() => setActiveTab("telegram")}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "telegram"
              ? "border-[#2AB0B2] text-[#2AB0B2]"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          💬 Monitor Grup Telegram
        </button>
        <button
          onClick={openStartDateModal}
          className="pb-3 text-xs font-bold border-b-2 border-transparent text-[#2AB0B2] hover:text-[#1C3D3F] transition-all cursor-pointer ml-auto flex items-center gap-1.5"
        >
          <CalendarClock className="w-4 h-4" /> Atur Tanggal Mulai KIE
        </button>
      </div>

      {/* Conditionally render Tab Content */}
      {activeTab === "submissions" ? (
        <>
          {/* Filter Bar */}
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-150 w-fit select-none">
            <button
              onClick={() => handleFilterChange("all")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === "all"
                  ? "bg-[#1C3D3F] text-white shadow-3xs"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => handleFilterChange("debt")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === "debt"
                  ? "bg-red-600 text-white shadow-3xs"
                  : "text-red-500 hover:bg-red-50/50"
              }`}
            >
              Mempunyai Hutang
            </button>
            <button
              onClick={() => handleFilterChange("nodebt")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === "nodebt"
                  ? "bg-emerald-600 text-white shadow-3xs"
                  : "text-emerald-500 hover:bg-emerald-50/50"
              }`}
            >
              Bebas Hutang
            </button>
          </div>

          {/* Main content list */}
          <div className="space-y-4">
            {users.map((user) => {
              const isExpanded = !!expandedUsers[user.id];
              return (
                <div
                  key={user.id}
                  className="bg-white border border-gray-150 rounded-2xl shadow-xs overflow-hidden transition-all duration-200"
                >
                  {/* Accordion Trigger */}
                  <button
                    onClick={() => toggleAccordion(user.id)}
                    className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      {/* User Profile / Icon */}
                      <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-150 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {user.foto_profile && user.foto_profile !== "/uploads/placeholder.jpg" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.foto_profile} alt={user.nama_lengkap} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-black text-[#1C3D3F] uppercase">
                            {user.nama_lengkap.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-[#1C3D3F]">{user.nama_lengkap}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400 font-bold">@{user.username}</span>
                          <span className="text-gray-300">•</span>
                          <span
                            className={`text-[8.5px] px-2 py-0.5 rounded-md font-black border uppercase tracking-wider ${
                              ROLE_COLORS[user.role] || "bg-gray-50 text-gray-500 border-gray-200"
                            }`}
                          >
                            {ROLE_LABELS[user.role] || user.role}
                          </span>
                          {user.telegram_chat_id && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-[#2AB0B2]/10 text-[#2AB0B2] border border-[#2AB0B2]/25 font-bold font-mono">
                                💬 {user.telegram_chat_name || "Grup Terhubung"}
                              </span>
                            </>
                          )}
                          {user.role === "student" && (
                            <>
                              <span className="text-gray-300">•</span>
                              {user.kie_debt && user.kie_debt > 0 ? (
                                <span className="text-[8.5px] px-2 py-0.5 rounded-md font-black bg-red-50 text-red-600 border border-red-100 uppercase tracking-wider">
                                  Hutang: {user.kie_debt} KIE
                                </span>
                              ) : (
                                <span className="text-[8.5px] px-2 py-0.5 rounded-md font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider">
                                  Bebas Hutang
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] font-black bg-[#1C3D3F] text-white px-2 py-0.5 rounded-full select-none">
                          {user.submissions.length} Keys
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-slate-50/50 p-4.5">
                      {(() => {
                        if (user.role === "student") {
                          const auditList = getDailyAuditList(user.submissions, user.pkl_start_date, holidayMap, user.kie_start_date, user.pkl_end_date);
                          const viewMode = userViewModes[user.id] || "calendar";

                          // Dates setup
                          const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
                          
                          // Format PKL start date, KIE start date, and PKL end date
                          const rawPklStart = user.pkl_start_date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(user.pkl_start_date)) : '';
                          const rawPklEnd = user.pkl_end_date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(user.pkl_end_date)) : '';
                          const rawKieStart = user.kie_start_date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(user.kie_start_date)) : (rawPklStart || todayStr);

                          const formattedPklStart = rawPklStart ? parseSafeDate(rawPklStart).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "Belum Diatur";
                          const formattedKieStart = rawKieStart ? parseSafeDate(rawKieStart).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "Sama dg PKL";
                          const formattedPklEnd = rawPklEnd ? parseSafeDate(rawPklEnd).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "Belum Diatur";

                          // Calendar month navigation
                          const userMonth = userCalMonths[user.id] || new Date();
                          const calYear = userMonth.getFullYear();
                          const calMonth = userMonth.getMonth();
                          const monthNames = [
                            "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                            "Juli", "Agustus", "September", "Oktober", "November", "Desember"
                          ];
                          const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

                          const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
                          const totalDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

                          // Direct submissions map for all days
                          const directSubMap: Record<string, any[]> = {};
                          user.submissions.forEach((sub) => {
                            const dStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(sub.submitted_at));
                            if (!directSubMap[dStr]) directSubMap[dStr] = [];
                            directSubMap[dStr].push(sub);
                          });

                          // --- EXACT DATE-BY-DATE FIFO MATCHING LEDGER ---
                          const deficitLedger: Record<string, { originalDeficit: number; remainingDeficit: number; paidBy: { dateStr: string; keys: number }[] }> = {};
                          const surplusLedger: Record<string, { originalSurplus: number; remainingSurplus: number; usedFor: { dateStr: string; keys: number }[] }> = {};

                          if (rawKieStart && rawKieStart <= todayStr) {
                            const [sy, sm, sd] = rawKieStart.split('-').map(Number);
                            const [ty, tm, td] = todayStr.split('-').map(Number);
                            let curDate = new Date(Date.UTC(sy, sm - 1, sd));
                            
                            // Upper boundary for evaluation (stops at PKL end date if reached, or today)
                            const upperDateStr = rawPklEnd && rawPklEnd < todayStr ? rawPklEnd : todayStr;
                            const [uy, um, ud] = upperDateStr.split('-').map(Number);
                            const maxDate = new Date(Date.UTC(uy, um - 1, ud));

                            const activeDays: { dateStr: string; target: number; count: number }[] = [];
                            while (curDate.getTime() <= maxDate.getTime()) {
                              const dStr = curDate.toISOString().split('T')[0];
                              const dOfWeek = curDate.getUTCDay();
                              const isWknd = (dOfWeek === 0 || dOfWeek === 6);
                              const isHldy = !!holidayMap[dStr];
                              const isAfterEnd = rawPklEnd ? dStr > rawPklEnd : false;
                              const target = (isWknd || isHldy || isAfterEnd) ? 0 : 4;
                              const count = (directSubMap[dStr] || []).length;

                              activeDays.push({ dateStr: dStr, target, count });
                              curDate.setUTCDate(curDate.getUTCDate() + 1);
                            }

                            // 1. Register Deficits & Surpluses
                            activeDays.forEach((d) => {
                              if (d.target === 0) return;
                              if (d.count < d.target) {
                                deficitLedger[d.dateStr] = {
                                  originalDeficit: d.target - d.count,
                                  remainingDeficit: d.target - d.count,
                                  paidBy: []
                                };
                              } else if (d.count > d.target) {
                                surplusLedger[d.dateStr] = {
                                  originalSurplus: d.count - d.target,
                                  remainingSurplus: d.count - d.target,
                                  usedFor: []
                                };
                              }
                            });

                            // 2. FIFO Allocation: Match Surpluses to Deficits
                            const defDates = Object.keys(deficitLedger).sort();
                            const surDates = Object.keys(surplusLedger).sort();

                            surDates.forEach((sDate) => {
                              const surObj = surplusLedger[sDate];
                              for (const dDate of defDates) {
                                if (surObj.remainingSurplus <= 0) break;
                                const defObj = deficitLedger[dDate];
                                if (defObj.remainingDeficit <= 0) continue;

                                // Aturan Bisnis: Kelebihan setor pada sDate HANYA BISA melunasi hutang masa lalu / hari yang sama (sDate >= dDate).
                                // Kelebihan di masa lalu TIDAK BISA dipakai untuk melunasi kekurangan setor di masa depan!
                                if (sDate < dDate) continue;

                                const alloc = Math.min(surObj.remainingSurplus, defObj.remainingDeficit);
                                defObj.remainingDeficit -= alloc;
                                defObj.paidBy.push({ dateStr: sDate, keys: alloc });

                                surObj.remainingSurplus -= alloc;
                                surObj.usedFor.push({ dateStr: dDate, keys: alloc });
                              }
                            });
                          }

                          // Map audit list items by dateStr for instant lookup
                          const auditMap: Record<string, any> = {};
                          auditList.forEach((item) => {
                            auditMap[item.dateStr] = item;
                          });

                          // Selected date in right panel
                          const selectedDate = userSelectedDates[user.id] || todayStr;
                          const selectedDirectSubs = directSubMap[selectedDate] || [];
                          const selectedCount = selectedDirectSubs.length;
                          const selectedDeficit = deficitLedger[selectedDate];
                          const selectedSurplus = surplusLedger[selectedDate];

                          // Calendar cells matrix
                          const calendarCells = [];
                          for (let i = 0; i < firstDayIndex; i++) {
                            calendarCells.push(null);
                          }
                          for (let d = 1; d <= totalDaysInMonth; d++) {
                            const mm = String(calMonth + 1).padStart(2, "0");
                            const dd = String(d).padStart(2, "0");
                            const dateStr = `${calYear}-${mm}-${dd}`;
                            calendarCells.push({ dayNum: d, dateStr });
                          }

                          // Totals for KPI header
                          const totalTarget = auditList.reduce((acc, curr) => acc + (curr.target || 0), 0);
                          const totalSubmitted = user.submissions.length;
                          const debt = user.kie_debt || 0;

                          // Month breakdown
                          const monthDeficitsList: { dateStr: string; count: number; originalDeficit: number; remainingDeficit: number; isCovered: boolean; paidBy: { dateStr: string; keys: number }[] }[] = [];
                          const monthSurplusesList: { dateStr: string; count: number; originalSurplus: number; usedFor: { dateStr: string; keys: number }[] }[] = [];

                          for (let d = 1; d <= totalDaysInMonth; d++) {
                            const mm = String(calMonth + 1).padStart(2, "0");
                            const dd = String(d).padStart(2, "0");
                            const dStr = `${calYear}-${mm}-${dd}`;
                            if (dStr < rawKieStart || dStr > todayStr) continue;
                            if (rawPklEnd && dStr > rawPklEnd) continue;

                            const dOfWeek = new Date(calYear, calMonth, d).getDay();
                            const isWknd = (dOfWeek === 0 || dOfWeek === 6);
                            const isHldy = !!holidayMap[dStr];
                            if (isWknd || isHldy) continue;

                            const c = (directSubMap[dStr] || []).length;
                            if (deficitLedger[dStr]) {
                              const dInfo = deficitLedger[dStr];
                              monthDeficitsList.push({
                                dateStr: dStr,
                                count: c,
                                originalDeficit: dInfo.originalDeficit,
                                remainingDeficit: dInfo.remainingDeficit,
                                isCovered: dInfo.remainingDeficit === 0,
                                paidBy: dInfo.paidBy
                              });
                            } else if (surplusLedger[dStr]) {
                              const sInfo = surplusLedger[dStr];
                              monthSurplusesList.push({
                                dateStr: dStr,
                                count: c,
                                originalSurplus: sInfo.originalSurplus,
                                usedFor: sInfo.usedFor
                              });
                            }
                          }

                          return (
                            <div className="space-y-5">
                              {/* KPI & Info Banner */}
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-150 shadow-3xs">
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 flex-1">
                                  <div className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-150">
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                      🎓 Masuk PKL
                                    </div>
                                    <div className="text-xs font-black text-gray-700 mt-0.5 truncate">{formattedPklStart}</div>
                                  </div>
                                  <div className="px-2.5 py-2 rounded-xl bg-blue-50/60 border border-blue-150">
                                    <div className="text-[9px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                                      📅 Mulai KIE
                                    </div>
                                    <div className="text-xs font-black text-blue-800 mt-0.5 truncate">{formattedKieStart}</div>
                                  </div>
                                  <div className="px-2.5 py-2 rounded-xl bg-purple-50/60 border border-purple-150">
                                    <div className="text-[9px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1">
                                      🏁 Selesai PKL
                                    </div>
                                    <div className="text-xs font-black text-purple-800 mt-0.5 truncate">{formattedPklEnd}</div>
                                  </div>
                                  <div className="px-2.5 py-2 rounded-xl bg-emerald-50/70 border border-emerald-150">
                                    <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                                      Total Disetor
                                    </div>
                                    <div className="text-xs font-black text-emerald-800 mt-0.5">{totalSubmitted} / {totalTarget} Keys</div>
                                  </div>
                                  <div className={`px-2.5 py-2 rounded-xl border ${debt > 0 ? 'bg-rose-50 border-rose-150' : 'bg-teal-50 border-teal-150'}`}>
                                    <div className={`text-[9px] font-bold uppercase tracking-wider ${debt > 0 ? 'text-rose-600' : 'text-teal-600'}`}>
                                      {debt > 0 ? 'Sisa Hutang' : 'Status'}
                                    </div>
                                    <div className={`text-xs font-black ${debt > 0 ? 'text-rose-700' : 'text-teal-700'} mt-0.5`}>
                                      {debt > 0 ? `${debt} Keys` : 'Bebas Hutang'}
                                    </div>
                                  </div>
                                </div>

                                {/* View Switcher */}
                                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-end lg:self-center">
                                  <button
                                    type="button"
                                    onClick={() => setUserViewModes(prev => ({ ...prev, [user.id]: "calendar" }))}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                      viewMode === "calendar" ? "bg-white text-[#1C3D3F] shadow-2xs" : "text-gray-500 hover:text-gray-800"
                                    }`}
                                  >
                                    <CalendarDays size={14} />
                                    <span>Kalender</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setUserViewModes(prev => ({ ...prev, [user.id]: "list" }))}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                      viewMode === "list" ? "bg-white text-[#1C3D3F] shadow-2xs" : "text-gray-500 hover:text-gray-800"
                                    }`}
                                  >
                                    <List size={14} />
                                    <span>Daftar</span>
                                  </button>
                                </div>
                              </div>

                              {viewMode === "calendar" ? (
                                /* CALENDAR VIEW */
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                                    {/* Left: Monthly Calendar */}
                                    <div className="lg:col-span-7 bg-white p-4.5 rounded-2xl border border-gray-150 shadow-3xs space-y-3.5">
                                      {/* Month Navigation */}
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                          <Calendar size={16} className="text-[#2AB0B2]" />
                                          <span>{monthNames[calMonth]} {calYear}</span>
                                        </h4>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setUserCalMonths(prev => ({ ...prev, [user.id]: new Date(calYear, calMonth - 1, 1) }))}
                                            className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 transition-colors cursor-pointer"
                                            title="Bulan Sebelumnya"
                                          >
                                            <ChevronLeft size={16} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setUserCalMonths(prev => ({ ...prev, [user.id]: new Date() }));
                                              setUserSelectedDates(prev => ({ ...prev, [user.id]: todayStr }));
                                            }}
                                            className="px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[10px] font-bold text-gray-700 transition-colors cursor-pointer"
                                          >
                                            Hari Ini
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setUserCalMonths(prev => ({ ...prev, [user.id]: new Date(calYear, calMonth + 1, 1) }))}
                                            className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 transition-colors cursor-pointer"
                                            title="Bulan Berikutnya"
                                          >
                                            <ChevronRight size={16} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Weekdays */}
                                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold">
                                        {dayNames.map((d, i) => (
                                          <div key={d} className={`py-1 rounded ${i === 0 || i === 6 ? 'text-rose-500 bg-rose-50/40' : 'text-gray-400 bg-gray-50'}`}>
                                            {d}
                                          </div>
                                        ))}
                                      </div>

                                      {/* Days Matrix */}
                                      <div className="grid grid-cols-7 gap-1.5">
                                        {calendarCells.map((cell, idx) => {
                                          if (!cell) {
                                            return <div key={`empty-${idx}`} className="h-14 rounded-xl bg-transparent"></div>;
                                          }

                                          const dateStr = cell.dateStr;
                                          const dayOfWeek = (firstDayIndex + cell.dayNum - 1) % 7;
                                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                          const isHoliday = !!holidayMap[dateStr];
                                          const isSelected = selectedDate === dateStr;
                                          const isToday = dateStr === todayStr;

                                          // Boundaries
                                          const isPklFirstDay = (dateStr === rawPklStart);
                                          const isKieStartDay = (dateStr === rawKieStart);
                                          const isPklEndDay = (dateStr === rawPklEnd);
                                          const isBeforeKie = (dateStr < rawKieStart);
                                          const isAfterPkl = (rawPklEnd && dateStr > rawPklEnd);
                                          const isFuture = (dateStr > todayStr);

                                          // Deficit & Surplus status
                                          const defObj = deficitLedger[dateStr];
                                          const isFullyPaid = defObj && defObj.remainingDeficit === 0;
                                          const isPartiallyPaid = defObj && defObj.remainingDeficit > 0 && defObj.paidBy.length > 0;
                                          const isUnpaid = defObj && defObj.remainingDeficit > 0 && defObj.paidBy.length === 0;

                                          // Submissions count on this day
                                          const directSubs = directSubMap[dateStr] || [];
                                          const count = directSubs.length;

                                          // Color & Badge Logic
                                          let bgClass = "bg-white border-gray-200 text-gray-700 hover:border-[#2AB0B2]";
                                          let badgeColor = "bg-gray-100 text-gray-500";
                                          let badgeText = `${count} Key`;
                                          let extraMarker = null;

                                          if (isPklFirstDay) {
                                            extraMarker = <span className="text-[7.5px] px-1 py-0.2 rounded bg-blue-100 text-blue-700 font-bold" title="Hari Pertama Masuk PKL">PKL</span>;
                                          } else if (isKieStartDay) {
                                            extraMarker = <span className="text-[7.5px] px-1 py-0.2 rounded bg-teal-100 text-teal-700 font-bold" title="Hari Pertama Mulai KIE">KIE</span>;
                                          } else if (isPklEndDay) {
                                            extraMarker = <span className="text-[7.5px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-bold" title="Hari Terakhir Masa PKL">Selesai</span>;
                                          }

                                          if (isBeforeKie) {
                                            // Before KIE start date: NEVER RED!
                                            if (count > 0) {
                                              bgClass = "bg-purple-50/80 border-purple-200 hover:bg-purple-100";
                                              badgeColor = "bg-purple-600 text-white font-bold";
                                              badgeText = `+${count}`;
                                            } else if (isPklFirstDay) {
                                              bgClass = "bg-blue-50/50 border-blue-200 hover:bg-blue-100/50 text-blue-900";
                                              badgeColor = "bg-blue-100 text-blue-700 font-bold";
                                              badgeText = "Masuk";
                                            } else {
                                              bgClass = "bg-gray-50/50 border-dashed border-gray-200 text-gray-300";
                                              badgeColor = "bg-gray-100 text-gray-300";
                                              badgeText = "-";
                                            }
                                          } else if (isAfterPkl) {
                                            // After PKL graduation date: NEVER RED, Target = 0!
                                            if (count > 0) {
                                              bgClass = "bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100";
                                              badgeColor = "bg-emerald-500 text-white font-bold";
                                              badgeText = `+${count}`;
                                            } else {
                                              bgClass = "bg-slate-50/50 border-dashed border-slate-200 text-slate-300";
                                              badgeColor = "bg-slate-100 text-slate-400";
                                              badgeText = "Selesai";
                                            }
                                          } else if (isFuture) {
                                            // Future date within PKL period
                                            if (isHoliday) {
                                              bgClass = "bg-rose-50/40 border-rose-200/50 text-rose-400";
                                              badgeColor = "bg-rose-100/70 text-rose-600 font-bold";
                                              badgeText = "Libur";
                                            } else if (isWeekend) {
                                              bgClass = "bg-gray-50/40 border-gray-150 text-gray-300";
                                              badgeColor = "bg-gray-100 text-gray-400";
                                              badgeText = "Off";
                                            } else {
                                              bgClass = "bg-white border-dashed border-gray-200 text-gray-400";
                                              badgeColor = "bg-gray-50 text-gray-400";
                                              badgeText = "4 Key";
                                            }
                                          } else if (isHoliday) {
                                            // Holiday
                                            if (count > 0) {
                                              bgClass = "bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100";
                                              badgeColor = "bg-emerald-500 text-white font-bold";
                                              badgeText = `+${count}`;
                                            } else {
                                              bgClass = "bg-rose-50/60 border-rose-200/80 hover:bg-rose-100/60";
                                              badgeColor = "bg-rose-100 text-rose-700 font-bold";
                                              badgeText = "Libur";
                                            }
                                          } else if (isWeekend) {
                                            // Weekend
                                            if (count > 0) {
                                              bgClass = "bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100";
                                              badgeColor = "bg-emerald-500 text-white font-bold";
                                              badgeText = `+${count}`;
                                            } else {
                                              bgClass = "bg-gray-50 border-gray-150/70 text-gray-400";
                                              badgeColor = "bg-gray-100 text-gray-400";
                                              badgeText = "Off";
                                            }
                                          } else {
                                            // Active working day within PKL
                                            if (count >= 4) {
                                              bgClass = "bg-emerald-50/90 border-emerald-200 hover:bg-emerald-100/80 text-emerald-900";
                                              badgeColor = "bg-emerald-600 text-white font-black";
                                              badgeText = count > 4 ? `${count} (+${count - 4})` : `${count} Key`;
                                            } else if (isFullyPaid) {
                                              // Fully Paid off by subsequent surplus!
                                              bgClass = "bg-teal-50/85 border-teal-200 hover:bg-teal-100/80 text-teal-900";
                                              badgeColor = "bg-teal-600 text-white font-bold";
                                              badgeText = `${count}/4 (Lunas ✓)`;
                                            } else if (isPartiallyPaid) {
                                              bgClass = "bg-amber-50/90 border-amber-200 hover:bg-amber-100/80 text-amber-900";
                                              badgeColor = "bg-amber-500 text-white font-black";
                                              badgeText = `${count}/4 (Kurang ${defObj.remainingDeficit})`;
                                            } else {
                                              // Completely Unpaid
                                              bgClass = "bg-rose-50/90 border-rose-200 hover:bg-rose-100 text-rose-900";
                                              badgeColor = "bg-rose-500 text-white font-black";
                                              badgeText = count === 0 ? "0/4 (Hutang)" : `${count}/4 (Hutang)`;
                                            }
                                          }

                                          return (
                                            <button
                                              key={dateStr}
                                              type="button"
                                              onClick={() => setUserSelectedDates(prev => ({ ...prev, [user.id]: dateStr }))}
                                              className={`h-14 p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${bgClass} ${
                                                isSelected ? "ring-2 ring-[#2AB0B2] border-[#2AB0B2] shadow-xs scale-[1.02]" : ""
                                              }`}
                                            >
                                              <div className="flex items-center justify-between w-full">
                                                <span className={`text-xs font-black rounded-md w-5 h-5 flex items-center justify-center ${
                                                  isToday ? 'bg-[#1C3D3F] text-white' : ''
                                                }`}>
                                                  {cell.dayNum}
                                                </span>
                                                {extraMarker || (
                                                    (defObj && defObj.remainingDeficit > 0) ? (
                                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title={`Hutang ${defObj.remainingDeficit} Keys`}></span>
                                                    ) : (isHoliday ? (
                                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title="Tanggal Merah"></span>
                                                    ) : null)
                                                  )}
                                              </div>
                                              <div className={`text-[8px] px-1 py-0.2 rounded text-center truncate ${badgeColor}`}>
                                                {badgeText}
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>

                                      {/* Legend */}
                                      <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-gray-500 pt-2 border-t border-gray-100">
                                        <div className="flex items-center gap-1">
                                          <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                                          <span>Setor Langsung (≥4)</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="w-2.5 h-2.5 rounded bg-teal-600"></span>
                                          <span>Lunas Tercover (✓)</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="w-2.5 h-2.5 rounded bg-rose-500"></span>
                                          <span>Belum Lunas (Hutang)</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="w-2.5 h-2.5 rounded bg-rose-100 border border-rose-300"></span>
                                          <span>Tanggal Merah</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="w-2.5 h-2.5 rounded bg-gray-100 border border-dashed border-gray-300"></span>
                                          <span>Belum / Selesai PKL</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right: Selected Day Inspection Panel */}
                                    <div className="lg:col-span-5 bg-white p-4.5 rounded-2xl border border-gray-150 shadow-3xs space-y-3.5">
                                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                        <div>
                                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Detail Setoran Harian</div>
                                          <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 mt-0.5">
                                            📅 {parseSafeDate(selectedDate).toLocaleDateString("id-ID", {
                                              weekday: "long",
                                              day: "2-digit",
                                              month: "long",
                                              year: "numeric"
                                            })}
                                          </h4>
                                        </div>
                                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${
                                          selectedDate < rawKieStart
                                            ? "text-purple-600 bg-purple-50 border-purple-200"
                                            : (rawPklEnd && selectedDate > rawPklEnd)
                                              ? "text-slate-600 bg-slate-100 border-slate-200"
                                              : selectedCount >= 4
                                                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                                : (selectedDeficit && selectedDeficit.remainingDeficit === 0)
                                                  ? "text-teal-700 bg-teal-50 border-teal-200"
                                                  : "text-rose-700 bg-rose-50 border-rose-200"
                                        }`}>
                                          {selectedDate < rawKieStart
                                            ? "Sebelum Periode KIE"
                                            : (rawPklEnd && selectedDate > rawPklEnd)
                                              ? "Selesai Masa PKL"
                                              : selectedCount >= 4
                                                ? (selectedCount > 4 ? `Surplus +${selectedCount - 4} Keys` : `Target Terpenuhi (4/4)`)
                                                : (selectedDeficit && selectedDeficit.remainingDeficit === 0)
                                                  ? `Status: LUNAS (Disetor ${selectedCount}/4)`
                                                  : selectedCount > 0
                                                    ? `Belum Lunas (${selectedCount}/4, Kurang ${selectedDeficit?.remainingDeficit || (4 - selectedCount)})`
                                                    : "Belum Lunas (0/4, Kurang 4)"}
                                        </span>
                                      </div>

                                      {/* Detailed Explanation for Deficits / Surpluses / Graduation */}
                                      {(() => {
                                        if (selectedDate < rawKieStart) {
                                          return (
                                            <div className="text-center py-8 text-gray-400 text-xs font-medium bg-slate-50/70 border border-dashed border-gray-200 rounded-xl space-y-1">
                                              <p className="font-bold text-gray-600">Sebelum Periode Wajib KIE</p>
                                              <p className="text-[10px] text-gray-400">Kewajiban setor KIE dimulai pada {formattedKieStart}. Target hari ini 0 Keys.</p>
                                            </div>
                                          );
                                        }

                                        if (rawPklEnd && selectedDate > rawPklEnd) {
                                          return (
                                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-center">
                                              <div className="font-black text-slate-800 flex items-center justify-center gap-1.5 text-sm">
                                                <span>🏁</span>
                                                <span>Masa PKL Telah Berakhir</span>
                                              </div>
                                              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                                Siswa telah menyelesaikan seluruh masa PKL pada <b>{formattedPklEnd}</b>.
                                                Mulai tanggal <b>{parseSafeDate(selectedDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</b> sudah <b>bebas kewajiban target KIE (Target: 0 Keys)</b> dan tidak akan menambah hutang.
                                              </p>
                                            </div>
                                          );
                                        }

                                        // Case 1: Deficit day that is ALREADY PAID OFF (LUNAS)
                                        if (selectedDeficit && selectedDeficit.remainingDeficit === 0) {
                                          return (
                                            <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2 text-xs">
                                              <div className="font-black text-teal-900 flex items-center gap-1.5">
                                                <span>✨</span>
                                                <span>Status: SUDAH LUNAS 100%</span>
                                              </div>
                                              <p className="text-[11px] text-teal-700 leading-relaxed font-medium">
                                                Hari ini disetor <b>{selectedCount} dari target 4 KIE</b> (kurang {selectedDeficit.originalDeficit} Keys).
                                              </p>
                                              <div className="pt-2 border-t border-teal-200/60 space-y-1">
                                                <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">
                                                  💸 Dilunasi oleh kelebihan setoran:
                                                </div>
                                                <div className="space-y-1">
                                                  {selectedDeficit.paidBy.map((p, idx) => (
                                                    <div key={idx} className="flex items-center justify-between px-2.5 py-1 bg-white/80 rounded-lg text-[10.5px] font-bold text-teal-800 border border-teal-150">
                                                      <span>📅 {parseSafeDate(p.dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                                                      <span className="bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-mono">+{p.keys} Keys</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        }

                                        // Case 2: Deficit day that is STILL UNPAID (HUTANG AKTIF)
                                        if (selectedDeficit && selectedDeficit.remainingDeficit > 0) {
                                          return (
                                            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2 text-xs">
                                              <div className="font-black text-rose-900 flex items-center gap-1.5">
                                                <span>❌</span>
                                                <span>Status: BELUM LUNAS (Hutang Aktif)</span>
                                              </div>
                                              <p className="text-[11px] text-rose-700 leading-relaxed font-medium">
                                                Disetor <b>{selectedCount} dari target 4 KIE</b>. Masih terdapat kekurangan <b>{selectedDeficit.remainingDeficit} Keys</b> yang belum tertutupi sampai saat ini.
                                              </p>
                                              {selectedDeficit.paidBy.length > 0 && (
                                                <div className="pt-2 border-t border-rose-200/60 space-y-1">
                                                  <div className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                                                    💸 Sebagian telah dicicil dari:
                                                  </div>
                                                  <div className="space-y-1">
                                                    {selectedDeficit.paidBy.map((p, idx) => (
                                                      <div key={idx} className="flex items-center justify-between px-2.5 py-1 bg-white/80 rounded-lg text-[10.5px] font-bold text-rose-800 border border-rose-150">
                                                        <span>📅 {parseSafeDate(p.dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                                                        <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-mono">+{p.keys} Keys</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        }

                                        // Case 3: Surplus day (Setor > 4)
                                        if (selectedSurplus && selectedSurplus.originalSurplus > 0) {
                                          return (
                                            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                                              <div className="font-black text-emerald-900 flex items-center gap-1.5">
                                                <span>🌟</span>
                                                <span>Surplus +{selectedSurplus.originalSurplus} Keys (Pelunas Hutang)</span>
                                              </div>
                                              <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
                                                Target harian 4 KIE terpenuhi. Kelebihan <b>{selectedSurplus.originalSurplus} Keys</b> hari ini dialokasikan untuk melunasi hutang di hari-hari sebelumnya:
                                              </p>
                                              <div className="pt-2 border-t border-emerald-200/60 space-y-1">
                                                <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                                                  🎯 Dipakai melunasi kekurangan tanggal:
                                                </div>
                                                <div className="space-y-1">
                                                  {selectedSurplus.usedFor.map((u, idx) => (
                                                    <div key={idx} className="flex items-center justify-between px-2.5 py-1 bg-white/80 rounded-lg text-[10.5px] font-bold text-emerald-800 border border-emerald-150">
                                                      <span>📅 {parseSafeDate(u.dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                                                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono">-{u.keys} Keys Hutang</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        }

                                        return null;
                                      })()}

                                      {/* Submissions list for selected date */}
                                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                        {selectedDirectSubs.map((sub: any) => {
                                          const isCopied = copiedKey === sub.id;
                                          const isEditing = editingId === sub.id;
                                          return (
                                            <div
                                              key={sub.id}
                                              className="bg-slate-50/80 border border-gray-200/80 rounded-xl p-2.5 flex flex-col gap-2 shadow-3xs"
                                            >
                                              <div className="min-w-0 w-full">
                                                {isEditing ? (
                                                  <div className="relative w-full">
                                                    <input
                                                      type="text"
                                                      value={editValue}
                                                      onChange={(e) => {
                                                        const val = e.target.value.replace(/\s/g, "");
                                                        if (val.length <= 32) setEditValue(val);
                                                      }}
                                                      className="w-full text-xs font-mono font-bold text-gray-700 bg-white border border-[#2AB0B2] focus:border-[#1C3D3F] outline-none px-2.5 py-1.5 rounded-lg select-all tracking-wider"
                                                      placeholder="32 karakter kunci API KIE"
                                                    />
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400 bg-gray-100 px-1 py-0.5 rounded select-none">
                                                      {editValue.length}/32
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <p className="text-[11px] font-mono font-bold text-gray-700 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg select-all break-all tracking-wider">
                                                    {sub.api_key}
                                                  </p>
                                                )}
                                                <p className="text-[9px] text-gray-400 font-semibold mt-1 pl-0.5">
                                                  Disetor pada: {new Date(sub.submitted_at).toLocaleString("id-ID", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                  })} WIB
                                                </p>
                                              </div>

                                              <div className="flex items-center gap-1.5 self-end">
                                                {isEditing ? (
                                                  <>
                                                    <button
                                                      onClick={() => handleSaveEdit(sub.id, user.id)}
                                                      disabled={editValue.length !== 32}
                                                      className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-40 transition-all cursor-pointer"
                                                      title="Simpan"
                                                    >
                                                      <Check size={14} />
                                                    </button>
                                                    <button
                                                      onClick={() => {
                                                        setEditingId(null);
                                                        setEditValue("");
                                                      }}
                                                      className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 transition-all cursor-pointer"
                                                      title="Batal"
                                                    >
                                                      <X size={14} />
                                                    </button>
                                                  </>
                                                ) : (
                                                  <>
                                                    <button
                                                      onClick={() => copyToClipboard(sub.api_key, sub.id)}
                                                      className={`p-1.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                                                        isCopied ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                                                      }`}
                                                      title={isCopied ? "Tersalin" : "Salin Kunci"}
                                                    >
                                                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                                    </button>
                                                    <button
                                                      onClick={() => startEdit(sub.id, sub.api_key)}
                                                      className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                                                      title="Edit"
                                                    >
                                                      <Pencil size={14} />
                                                    </button>
                                                    <button
                                                      onClick={() => handleDeleteSubmission(sub.id, user.id)}
                                                      className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                                                      title="Hapus"
                                                    >
                                                      <Trash2 size={14} />
                                                    </button>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Bottom: Deficit & Surplus Breakdown Summary for the Current Month */}
                                  <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-3xs space-y-2.5">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                        <span>📊</span>
                                        <span>Rincian Pelunasan & Status Bulan {monthNames[calMonth]} {calYear}</span>
                                      </h5>
                                      <div className="flex items-center gap-2 text-[10px] font-bold">
                                        <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                                          {monthDeficitsList.filter(d => d.isCovered).length} Hari Lunas Tercover (✓)
                                        </span>
                                        <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                          {monthDeficitsList.filter(d => !d.isCovered).length} Hari Belum Lunas
                                        </span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                      {/* Deficits list */}
                                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                                        <div className="text-[10px] font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                                          <span>📋 Riwayat Hari Kurang Setor</span>
                                          <span>Total: {monthDeficitsList.length} Hari</span>
                                        </div>
                                        {monthDeficitsList.length === 0 ? (
                                          <div className="text-[10.5px] text-gray-400 py-1">Semua hari kerja di bulan ini setor penuh (≥4 Keys).</div>
                                        ) : (
                                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                                            {monthDeficitsList.map((d) => (
                                              <button
                                                key={d.dateStr}
                                                type="button"
                                                onClick={() => setUserSelectedDates(prev => ({ ...prev, [user.id]: d.dateStr }))}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 border ${
                                                  d.isCovered
                                                    ? 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100'
                                                    : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                                                }`}
                                                title="Klik untuk lihat detail pelunasan"
                                              >
                                                <span>{parseSafeDate(d.dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}:</span>
                                                <span>{d.count}/4</span>
                                                <span>{d.isCovered ? '✓ LUNAS' : `❌ Sisa ${d.remainingDeficit}`}</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Surpluses list */}
                                      <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-150 space-y-1.5">
                                        <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                                          <span>🔺 Hari Surplus (Pelunas Hutang)</span>
                                          <span>Total: +{monthSurplusesList.reduce((acc, d) => acc + d.originalSurplus, 0)} Keys</span>
                                        </div>
                                        {monthSurplusesList.length === 0 ? (
                                          <div className="text-[10.5px] text-gray-400 py-1">Tidak ada hari surplus di bulan ini.</div>
                                        ) : (
                                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                                            {monthSurplusesList.map((d) => (
                                              <button
                                                key={d.dateStr}
                                                type="button"
                                                onClick={() => setUserSelectedDates(prev => ({ ...prev, [user.id]: d.dateStr }))}
                                                className="px-2 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                                                title="Klik untuk lihat daftar pelunasan"
                                              >
                                                <span>{parseSafeDate(d.dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                                                <span className="text-emerald-600 font-mono">({d.count} Keys, +{d.originalSurplus})</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                /* LIST VIEW */
                                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                                  {auditList.map((group) => {
                                    const formattedDate = parseSafeDate(group.dateStr).toLocaleDateString("id-ID", {
                                      weekday: "long",
                                      day: "2-digit",
                                      month: "long",
                                      year: "numeric",
                                    });
                                    return (
                                      <div key={group.dateStr} className="space-y-2 bg-white p-3.5 rounded-xl border border-gray-150 shadow-3xs">
                                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                          <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                            📅 {formattedDate}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black bg-[#1C3D3F] text-white px-2 py-0.5 rounded-full">
                                              {group.items.length} Keys
                                            </span>
                                            <span className={`text-[8.5px] px-2 py-0.5 rounded-md border tracking-wide font-black ${group.statusColor}`}>
                                              {group.statusLabel}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="space-y-1.5">
                                          {group.items.length === 0 ? (
                                            <div className="text-center py-2 text-gray-400 text-[10px] font-bold">
                                              Tidak ada setoran pada tanggal ini.
                                            </div>
                                          ) : (
                                            group.items.map((sub: any) => {
                                              const isCopied = copiedKey === sub.id;
                                              return (
                                                <div key={sub.id} className="flex items-center justify-between bg-gray-50 px-2.5 py-1.5 rounded-lg text-xs font-mono">
                                                  <span className="truncate">{sub.api_key}</span>
                                                  <button
                                                    onClick={() => copyToClipboard(sub.api_key, sub.id)}
                                                    className="text-gray-400 hover:text-gray-700 ml-2"
                                                    title="Salin"
                                                  >
                                                    {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                                  </button>
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          // Employees/Mentors
                          if (user.submissions.length === 0) {
                            return (
                              <div className="text-center py-6 text-gray-400 text-xs font-semibold select-none">
                                Belum ada API KIE yang disetor oleh pengguna ini.
                              </div>
                            );
                          }
                          const grouped = groupSubmissionsByDate(user.submissions);
                          return (
                            <div className="space-y-6">
                              {grouped.map((group) => {
                                const [y, m, d] = group.dateStr.split('-').map(Number);
                                const dateObj = new Date(y, m - 1, d);
                                const formattedDate = dateObj.toLocaleDateString("id-ID", {
                                  weekday: "long",
                                  day: "2-digit",
                                  month: "long",
                                  year: "numeric",
                                });
                                return (
                                  <div key={group.dateStr} className="space-y-2.5">
                                    <div className="flex items-center justify-between px-1 bg-slate-100/50 py-1 rounded-lg">
                                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pl-1.5">
                                        📅 {formattedDate}
                                      </span>
                                      <span className="text-[9px] font-black bg-[#1C3D3F] text-white px-2 py-0.5 rounded-full pr-1.5">
                                        {group.items.length} Keys
                                      </span>
                                    </div>
                                    <div className="space-y-2">
                                      {group.items.map((sub) => {
                                        const isCopied = copiedKey === sub.id;
                                        const isEditing = editingId === sub.id;
                                        return (
                                          <div
                                            key={sub.id}
                                            className="bg-white border border-gray-150 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-3xs"
                                          >
                                            <div className="min-w-0 flex-1 w-full">
                                              {isEditing ? (
                                                <div className="relative w-full">
                                                  <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => {
                                                      const val = e.target.value.replace(/\s/g, "");
                                                      if (val.length <= 32) setEditValue(val);
                                                    }}
                                                    className="w-full text-xs font-mono font-bold text-gray-700 bg-white border border-[#2AB0B2] focus:border-[#1C3D3F] outline-none px-3 py-1.5 rounded-lg select-all tracking-wider"
                                                    placeholder="Masukkan 32 karakter kunci API KIE"
                                                  />
                                                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md select-none">
                                                    {editValue.length}/32
                                                  </div>
                                                </div>
                                              ) : (
                                                <p className="text-xs font-mono font-bold text-gray-700 bg-slate-50/80 border border-slate-100 px-3 py-1.5 rounded-lg select-all break-all tracking-wider">
                                                  {sub.api_key}
                                                </p>
                                              )}
                                              <p className="text-[10px] text-gray-400 font-semibold mt-1.5 pl-1">
                                                Disetor pada: {new Date(sub.submitted_at).toLocaleString("id-ID", {
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                })} WIB
                                              </p>
                                            </div>

                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                              {isEditing ? (
                                                <>
                                                  <button
                                                    onClick={() => handleSaveEdit(sub.id, user.id)}
                                                    disabled={editValue.length !== 32}
                                                    className="p-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:bg-gray-50 disabled:border-gray-200 disabled:text-gray-400 transition-all cursor-pointer flex items-center justify-center"
                                                    title="Simpan"
                                                  >
                                                    <Check size={16} />
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setEditingId(null);
                                                      setEditValue("");
                                                    }}
                                                    className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center"
                                                    title="Batal"
                                                  >
                                                    <X size={16} />
                                                  </button>
                                                </>
                                              ) : (
                                                <>
                                                  <button
                                                    onClick={() => copyToClipboard(sub.api_key, sub.id)}
                                                    className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                                                      isCopied
                                                        ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                                        : "bg-white border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-slate-50"
                                                    }`}
                                                    title={isCopied ? "Berhasil disalin" : "Salin Kunci API"}
                                                  >
                                                    {isCopied ? <Check size={16} /> : <Copy size={16} />}
                                                  </button>
                                                  <button
                                                    onClick={() => startEdit(sub.id, sub.api_key)}
                                                    className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all cursor-pointer flex items-center justify-center"
                                                    title="Edit Kunci API"
                                                  >
                                                    <Pencil size={16} />
                                                  </button>
                                                  <button
                                                    onClick={() => handleDeleteSubmission(sub.id, user.id)}
                                                    className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all cursor-pointer flex items-center justify-center"
                                                    title="Hapus Kunci API"
                                                  >
                                                    <Trash2 size={16} />
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading Spinner */}
            {loading && (
              <div className="flex items-center justify-center py-6 text-slate-400 text-xs font-medium">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#2AB0B2] border-t-transparent mr-2" />
                Memuat data pengguna berikutnya...
              </div>
            )}

            {/* Sentinel element for infinite scroll */}
            <div ref={loaderRef} className="h-4 w-full" />

            {/* Manual Load More button when not loading but hasMore is true */}
            {!loading && hasMore && (
              <div className="flex justify-center pt-2 pb-4">
                <button
                  onClick={() => setPage((prev) => prev + 1)}
                  className="px-5 py-2.5 text-xs font-black text-[#2AB0B2] bg-[#2AB0B2]/5 hover:bg-[#2AB0B2]/10 border border-[#2AB0B2]/20 rounded-xl cursor-pointer transition-all active:scale-[0.97]"
                >
                  Tampilkan Lebih Banyak
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && users.length === 0 && (
              <div className="bg-white border border-gray-150 rounded-2xl p-12 text-center shadow-xs">
                <Key size={36} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm font-bold">Tidak ada data pengguna.</p>
              </div>
            )}

            {/* End of results */}
            {!hasMore && users.length > 0 && (
              <p className="text-[10px] text-center text-gray-400 font-bold py-6">
                Semua pengguna telah dimuat
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {/* Telegram Monitor Header & Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-150 p-4.5 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Grup Terhubung</span>
              <div className="text-2xl font-black text-[#1C3D3F] mt-1">{telegramUsers.length}</div>
            </div>
            <div className="bg-white border border-gray-150 p-4.5 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Siswa Terkoneksi</span>
              <div className="text-2xl font-black text-purple-600 mt-1">
                {telegramUsers.filter(u => u.role === 'student').length}
              </div>
            </div>
            <div className="bg-white border border-gray-150 p-4.5 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Metode Registrasi</span>
                <div className="text-xs font-bold text-[#2AB0B2] mt-1">Telegram Webhook</div>
              </div>
              <button
                onClick={fetchTelegramGroups}
                disabled={loadingTelegram}
                className="p-2 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer text-gray-500"
                title="Refresh data"
              >
                <RefreshCw size={16} className={loadingTelegram ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* List Table of Telegram Connections */}
          <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-150 text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">
                    <th className="px-5 py-3">User Aplikasi</th>
                    <th className="px-5 py-3">Nama Grup Telegram</th>
                    <th className="px-5 py-3">Chat / Group ID</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingTelegram ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-xs text-gray-400 font-medium">
                        Memuat data grup Telegram...
                      </td>
                    </tr>
                  ) : telegramUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-xs text-gray-400 font-medium">
                        Belum ada grup Telegram yang terhubung dengan akun siswa/karyawan.
                      </td>
                    </tr>
                  ) : (
                    telegramUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="text-xs font-bold text-[#1C3D3F]">{u.nama_lengkap}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-gray-400 font-mono">@{u.username}</span>
                            <span className="text-gray-300">•</span>
                            <span
                              className={`text-[8.5px] px-1.5 py-0.5 rounded font-black border uppercase tracking-wider ${
                                ROLE_COLORS[u.role] || "bg-gray-55 text-gray-400 border-gray-200"
                              }`}
                            >
                              {ROLE_LABELS[u.role] || u.role}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-[#1C3D3F] font-mono">
                          {u.telegram_chat_name || (
                            <span className="text-gray-400 font-normal italic">Belum menerima pesan</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500 font-mono select-all">
                          {u.telegram_chat_id}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wide">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Aktif
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleDisconnectTelegram(u.id, u.nama_lengkap)}
                            className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all cursor-pointer inline-flex items-center justify-center"
                            title="Putuskan Koneksi Telegram"
                          >
                            <Unlink size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SET START DATE */}
      {showStartDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-[#2AB0B2]" />
                Atur Tanggal Mulai KIE
              </h3>
              <button
                onClick={() => setShowStartDateModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Tanggal Mulai Perhitungan KIE</label>
                <input
                  type="date"
                  value={selectedStartDate}
                  onChange={(e) => setSelectedStartDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2AB0B2] focus:ring-1 focus:ring-[#2AB0B2]"
                />
                <p className="text-xs text-gray-500">Hutang KIE akan dihitung mulai dari tanggal ini.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700">Pilih Siswa PKL</label>
                  <button
                    onClick={() => {
                      if (selectedStudentIds.length === startDateStudents.length) {
                        setSelectedStudentIds([]);
                      } else {
                        setSelectedStudentIds(startDateStudents.map(s => s.id));
                      }
                    }}
                    className="text-xs font-bold text-[#2AB0B2] cursor-pointer hover:underline"
                  >
                    {selectedStudentIds.length === startDateStudents.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {startDateStudents.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">Memuat data siswa...</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {startDateStudents.map(student => (
                        <label key={student.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(student.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentIds([...selectedStudentIds, student.id]);
                              } else {
                                setSelectedStudentIds(selectedStudentIds.filter(id => id !== student.id));
                              }
                            }}
                            className="w-4 h-4 text-[#2AB0B2] rounded focus:ring-[#2AB0B2]"
                          />
                          <span className="text-sm text-gray-700 font-medium">{student.nama_lengkap}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-[#2AB0B2]">{selectedStudentIds.length} Siswa dipilih</p>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button
                onClick={() => setShowStartDateModal(false)}
                className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveStartDate}
                disabled={submittingStartDate}
                className="px-6 py-2 text-sm font-bold text-white bg-[#2AB0B2] hover:bg-[#1c9294] rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submittingStartDate ? "Menyimpan..." : "Simpan Tanggal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
