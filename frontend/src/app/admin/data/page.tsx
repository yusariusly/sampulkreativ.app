"use client";

import React, { useEffect, useState } from "react";
import { Search, Calendar, ChevronDown, Download, CheckCircle2, XCircle, Send, ChevronLeft, ChevronRight, AlertTriangle, Edit2, Users, User } from "lucide-react";

const TEAL = "#2AB0B2";

const STATUS_STYLES: Record<string, string> = {
  Hadir: "bg-green-500 text-white",
  Libur: "bg-[#F6C13B] text-white",
  Alpa: "bg-red-500 text-white",
  Sakit: "bg-blue-500 text-white",
  Izin: "bg-orange-400 text-white",
  Pulang: "bg-indigo-600 text-white",
};

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  return (
    <span
      className={`rounded-full font-bold inline-block text-center select-none ${
        small ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm"
      } ${STATUS_STYLES[status] ?? "bg-gray-200 text-gray-700"}`}
    >
      {status}
    </span>
  );
}

export default function AdminDataPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"daily" | "user">("daily");

  // User list view state
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<any | null>(null);
  const [userHistoryLogs, setUserHistoryLogs] = useState<any[]>([]);
  const [loadingUserHistory, setLoadingUserHistory] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const getLocalDateString = (date: Date) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);
    } catch (e) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()));

  const tomorrowStr = (() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getLocalDateString(tomorrow);
  })();

  // Photo Audit Modal State
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedLogName, setSelectedLogName] = useState("");

  // Override states
  const [users, setUsers] = useState<any[]>([]);
  const [overrideUser, setOverrideUser] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("Hadir");
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideCheckInTime, setOverrideCheckInTime] = useState("08:00");
  const [overrideCheckOutTime, setOverrideCheckOutTime] = useState("17:00");
  const [currentStatus, setCurrentStatus] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [notification, setNotification] = useState("");
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  const getNotificationDetails = (msg: string) => {
    let icon = <CheckCircle2 size={16} className="text-[#2AB0B2]" />;
    let cleaned = msg;

    if (msg.startsWith("⚠️")) {
      icon = <AlertTriangle size={16} className="text-amber-500" />;
      cleaned = msg.replace(/^⚠️\s*/, "");
    } else if (msg.startsWith("✅")) {
      icon = <CheckCircle2 size={16} className="text-emerald-500" />;
      cleaned = msg.replace(/^✅\s*/, "");
    }

    return { icon, cleaned };
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification("");
    }, 3500);
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Gagal memuat daftar pengguna:", err);
    }
  };

  const handleOverrideStatus = async () => {
    if (!overrideUser) {
      showToast("⚠️ Silakan pilih karyawan terlebih dahulu");
      return;
    }
    if (!overrideDate) {
      showToast("⚠️ Silakan tentukan tanggal terlebih dahulu");
      return;
    }
    try {
      const res = await fetch("/api/attendance/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: overrideUser, 
          status: overrideStatus, 
          date: overrideDate,
          checkInTime: overrideCheckInTime,
          checkOutTime: overrideCheckOutTime
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const employee = users.find((u) => u.username === overrideUser);
        showToast(`✅ Status absensi "${employee?.nama_lengkap || overrideUser}" berhasil diubah menjadi "${overrideStatus}"`);
        setOverrideUser("");
        setIsOverrideModalOpen(false);
        fetchLogs();
      } else {
        showToast(`⚠️ ${data.error || "Gagal menerapkan override"}`);
      }
    } catch (err) {
      showToast("⚠️ Gagal menghubungi server");
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/attendance");
      if (res.ok) {
        const data = await res.json();
        setRows(data);
      }
    } catch (err) {
      console.error("Gagal memuat log absensi:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserHistory = async (userId: string) => {
    setLoadingUserHistory(true);
    try {
      const res = await fetch(`/api/attendance?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setUserHistoryLogs(data);
      }
    } catch (err) {
      console.error("Gagal memuat riwayat user:", err);
    } finally {
      setLoadingUserHistory(false);
    }
  };

  const groupLogsByDate = (userLogs: any[]) => {
    const groups: Record<string, {
      dateStr: string;
      formattedDate: string;
      status: string;
      checkInTime: string | null;
      checkOutTime: string | null;
      diubahOlehAdmin: boolean;
    }> = {};
    
    userLogs.forEach((log) => {
      if (!log.waktu_absen) return;
      let datePart = '';
      try {
        datePart = getLocalDateString(new Date(log.waktu_absen));
      } catch (e) {
        datePart = (log.waktu_absen || '').slice(0, 10);
      }
      if (!datePart) return;

      if (!groups[datePart]) {
        const d = new Date(datePart);
        const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        
        const dayName = days[d.getDay()];
        const dayNum = d.getDate();
        const monthName = months[d.getMonth()];
        const year = d.getFullYear();
        
        groups[datePart] = {
          dateStr: datePart,
          formattedDate: `${dayName}, ${dayNum} ${monthName} ${year}`,
          status: log.status,
          checkInTime: null,
          checkOutTime: null,
          diubahOlehAdmin: log.diubah_oleh_admin
        };
      }

      const grp = groups[datePart];
      
      const timeObj = new Date(log.waktu_absen);
      const hh = String(timeObj.getHours()).padStart(2, "0");
      const mm = String(timeObj.getMinutes()).padStart(2, "0");
      const timeStr = `${hh}:${mm} WIB`;

      if (log.status === 'Hadir' || log.status === 'Terlambat') {
        grp.checkInTime = timeStr;
      } else if (log.status === 'Pulang') {
        grp.checkOutTime = timeStr;
      }
      
      if (log.status === 'Pulang') {
        grp.status = 'Pulang';
      } else if (['Izin', 'Sakit', 'Alpa'].includes(log.status)) {
        grp.status = log.status;
      } else if (!['Pulang', 'Izin', 'Sakit', 'Alpa'].includes(grp.status)) {
        grp.status = log.status;
      }
      
      if (log.diubah_oleh_admin) {
        grp.diubahOlehAdmin = true;
      }
    });

    return Object.values(groups).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  };

  useEffect(() => {
    fetchLogs();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserForHistory) {
      fetchUserHistory(selectedUserForHistory.id);
    } else {
      setUserHistoryLogs([]);
    }
  }, [selectedUserForHistory]);

  // Fetch current status dynamically when employee or date changes inside override modal
  useEffect(() => {
    if (isOverrideModalOpen && overrideUser && overrideDate) {
      setLoadingStatus(true);
      fetch(`/api/attendance/override/status?username=${overrideUser}&date=${overrideDate}`)
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data) => {
          setCurrentStatus(data.status || "Belum Absen");
          setOverrideStatus(data.status || "Hadir");
          setOverrideCheckInTime(data.checkInTime || "08:00");
          setOverrideCheckOutTime(data.checkOutTime || "17:00");
          setLoadingStatus(false);
        })
        .catch(() => {
          setCurrentStatus("Gagal memuat");
          setLoadingStatus(false);
        });
    } else {
      setCurrentStatus("");
    }
  }, [overrideUser, overrideDate, isOverrideModalOpen]);

  const handlePrevDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - 1);
    setSelectedDate(getLocalDateString(current));
  };

  const handleNextDay = () => {
    const current = new Date(selectedDate);
    if (getLocalDateString(current) === tomorrowStr) return; // Prevent going beyond tomorrow
    current.setDate(current.getDate() + 1);
    setSelectedDate(getLocalDateString(current));
  };

  const AVATAR_COLORS = [TEAL, "#F6C13B", "#10B981", "#3B82F6", "#6B7280", "#8B5CF6", "#F59E0B"];

  // Filter rows based on search query and selected date
  const filteredRows = rows.filter((row) => {
    // 1. Match selected date
    const logDateStr = getLocalDateString(new Date(row.waktu_absen));
    if (logDateStr !== selectedDate) return false;

    // 2. Match search query
    return (
      row.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (row.username && row.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      row.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString("id-ID", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + " WIB";
  };

  // Export to CSV Function
  const handleExportCSV = () => {
    if (filteredRows.length === 0) return;

    // Build CSV headers and rows
    const headers = ["ID", "Waktu Absen", "Username", "Nama Lengkap", "Latitude", "Longitude", "Status", "Manual Override"];
    const csvContent = [
      headers.join(","),
      ...filteredRows.map((r) =>
        [
          r.id,
          `"${new Date(r.waktu_absen).toLocaleString("id-ID")}"`,
          r.username || "",
          `"${r.nama_lengkap}"`,
          r.latitude || "null",
          r.longitude || "null",
          r.status,
          r.diubah_oleh_admin ? "True" : "False",
        ].join(",")
      ),
    ].join("\n");

    // Create file blob and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan-absensi-${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 bg-[#F0F2F5] p-4 md:p-8 select-none relative">
      {/* Toast Alert Notification */}
      {notification && (() => {
        const { icon, cleaned } = getNotificationDetails(notification);
        return (
          <div className="fixed top-4 right-4 z-50 p-4 bg-[#1C3D3F] text-white rounded-xl shadow-lg border border-[#2AB0B2]/30 flex items-center gap-2 font-medium text-sm transition-all animate-bounce">
            {icon}
            <span>{cleaned}</span>
          </div>
        );
      })()}

      {/* Photo View Modal Overlay */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl overflow-hidden max-w-sm w-full shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#1C3D3F] mb-4 text-center">Foto Kehadiran</h3>
            
            <div className="w-full aspect-[3/4] bg-gray-100 rounded-2xl overflow-hidden border mb-6 relative flex flex-col items-center justify-center p-6 text-center select-none">
              {selectedPhoto === "telegram" ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-[#2AB0B2]/10 flex items-center justify-center text-[#2AB0B2] mb-4">
                    <Send size={32} strokeWidth={2} />
                  </div>
                  <p className="font-bold text-gray-755 text-sm text-gray-700">Foto Dikirim ke Telegram</p>
                  <p className="text-xs text-gray-455 mt-1.5 leading-relaxed">
                    Sesuai pengaturan sistem, foto selfie kehadiran ini langsung diteruskan ke Telegram grup dan tidak disimpan di storage server.
                  </p>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedPhoto} alt="Selfie Kehadiran" className="w-full h-full object-cover" />
              )}
            </div>

            <p className="text-center text-sm font-semibold text-[#1C3D3F] mb-6">
              Karyawan: {selectedLogName}
            </p>

            <button
              onClick={() => setSelectedPhoto(null)}
              className="w-full py-3.5 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors text-sm"
            >
              Tutup Detail
            </button>
          </div>
        </div>
      )}

      {/* Override Status Modal Overlay */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-300" onClick={(e) => { if (e.target === e.currentTarget) setIsOverrideModalOpen(false); }}>
          <div className="bg-white rounded-3xl overflow-hidden max-w-sm w-full shadow-2xl p-6 border border-gray-150/40 relative animate-in fade-in zoom-in-95 duration-200 select-none" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#F6C13B]/10 flex items-center justify-center text-[#F6C13B] shrink-0">
                <Edit2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1C3D3F] leading-tight">Override Absensi</h3>
                <p className="text-gray-400 text-xs mt-0.5 font-medium">Ubah status kehadiran karyawan secara manual</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Karyawan Select */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Karyawan</label>
                <div className="relative">
                  <select
                    value={overrideUser}
                    onChange={(e) => setOverrideUser(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] focus:ring-2 focus:ring-[#2AB0B2]/10 outline-none bg-white text-gray-700 transition-all cursor-pointer font-semibold shadow-xs appearance-none"
                  >
                    <option value="">Pilih Karyawan</option>
                    {users
                      .filter((u) => u.role !== "admin")
                      .map((u) => (
                        <option key={u.username} value={u.username} className="font-semibold text-gray-700">
                          {u.nama_lengkap}
                        </option>
                      ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              {/* Tanggal Input */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Tanggal Absensi</label>
                <div className="relative">
                  <input
                    type="date"
                    value={overrideDate}
                    onChange={(e) => setOverrideDate(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] focus:ring-2 focus:ring-[#2AB0B2]/10 outline-none bg-white text-gray-700 transition-all cursor-pointer font-semibold shadow-xs"
                  />
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
                    <Calendar size={16} />
                  </div>
                </div>
              </div>

              {/* Status Saat Ini Card */}
              {overrideUser && overrideDate && (
                <div className="bg-[#1C3D3F]/5 border border-gray-100 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200 select-none">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Status Saat Ini</span>
                    <span className="text-[10px] font-semibold text-gray-400">
                      {overrideUser}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {loadingStatus ? (
                      <span className="text-xs font-bold text-gray-400 animate-pulse">Memuat...</span>
                    ) : (
                      <StatusBadge status={currentStatus} small />
                    )}
                  </div>
                </div>
              )}

              {/* Status Kehadiran Dropdown */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Status Baru</label>
                <div className="relative">
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] focus:ring-2 focus:ring-[#2AB0B2]/10 outline-none bg-white text-gray-700 transition-all cursor-pointer font-semibold shadow-xs appearance-none"
                  >
                    <option>Belum Absen</option>
                    <option>Hadir</option>
                    <option>Pulang</option>
                    <option>Izin</option>
                    <option>Sakit</option>
                    <option>Alpa</option>
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              {/* Conditional Time Pickers */}
              {(overrideStatus === "Hadir" || overrideStatus === "Pulang") && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Jam Masuk</label>
                    <input
                      type="time"
                      value={overrideCheckInTime}
                      onChange={(e) => setOverrideCheckInTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] focus:ring-2 focus:ring-[#2AB0B2]/10 outline-none bg-white text-gray-750 font-semibold shadow-xs"
                    />
                  </div>

                  {overrideStatus === "Pulang" && (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Jam Pulang</label>
                      <input
                        type="time"
                        value={overrideCheckOutTime}
                        onChange={(e) => setOverrideCheckOutTime(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] focus:ring-2 focus:ring-[#2AB0B2]/10 outline-none bg-white text-gray-750 font-semibold shadow-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="flex-1 py-3 bg-gray-50 hover:bg-gray-100/80 active:scale-95 text-gray-500 rounded-xl font-bold transition-all cursor-pointer text-sm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleOverrideStatus}
                  className="flex-1 py-3 bg-[#2AB0B2] hover:bg-[#209092] active:scale-95 text-white rounded-xl font-bold shadow-md shadow-[#2AB0B2]/10 transition-all cursor-pointer text-sm"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header bar with controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8 select-none">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-[#1C3D3F]">Data Absensi</h1>
          
          {/* View Mode Toggle Switcher */}
          <div className="inline-flex p-1 bg-white border border-gray-200 rounded-2xl shadow-xs shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setViewMode("daily")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === "daily"
                  ? "bg-[#2AB0B2] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Calendar size={14} />
              <span>Harian</span>
            </button>
            <button
              onClick={() => setViewMode("user")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === "user"
                  ? "bg-[#2AB0B2] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Users size={14} />
              <span>Per Pengguna</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          {/* Override Status Button */}
          <button
            onClick={() => {
              setOverrideDate(selectedDate);
              setIsOverrideModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 border-2 border-[#F6C13B] hover:bg-[#F6C13B]/10 text-[#F6C13B] rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors cursor-pointer w-full sm:w-auto shrink-0 active:scale-[0.98]"
          >
            <Edit2 size={16} />
            <span>Override Status</span>
          </button>
          
          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredRows.length === 0}
            className="flex items-center justify-center gap-2 bg-[#2AB0B2] text-white rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-[#209092] transition-colors cursor-pointer w-full sm:w-auto disabled:opacity-50 shrink-0"
          >
            <Download size={16} />
            <span>Ekspor Laporan (CSV)</span>
          </button>
        </div>
      </div>

      {/* Conditional Layout Rendering */}
      {viewMode === "daily" ? (
        /* Main Table Card containing integrated Toolbar (Daily View) */
        <div className="bg-white rounded-2xl shadow-xs overflow-hidden border border-gray-100/50">
          {/* Table Toolbar / Controls */}
          <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
            {/* Date Selector with Previous/Next controls */}
            <div className="flex items-center justify-between sm:justify-start gap-1 bg-white border border-gray-250 rounded-xl p-1 shadow-xs w-full md:w-auto">
              <button
                onClick={handlePrevDay}
                className="p-1.5 text-gray-500 hover:text-[#2AB0B2] hover:bg-gray-55 rounded-lg transition-colors cursor-pointer"
                title="Hari Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="flex items-center gap-1.5 px-2">
                <Calendar size={14} className="text-[#2AB0B2] flex-shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  max={tomorrowStr}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="outline-none text-sm font-semibold text-gray-750 bg-transparent border-0 cursor-pointer w-28 sm:w-auto"
                />
              </div>

              <button
                onClick={handleNextDay}
                disabled={selectedDate === tomorrowStr}
                className="p-1.5 text-gray-500 hover:text-[#2AB0B2] hover:bg-gray-55 rounded-lg transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                title="Hari Selanjutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Search bar */}
            <div className="flex items-center gap-2 bg-white border border-gray-250 rounded-xl px-4 py-2 w-full md:w-64 shadow-xs">
              <Search size={16} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Cari nama / status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 outline-none text-sm text-gray-500 bg-transparent min-w-0 font-medium"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Waktu", "Nama", "Lokasi", "Foto", "Status"].map((h) => (
                    <th key={h} className="text-left px-6 py-4 text-sm font-semibold text-gray-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-sm text-gray-400 font-medium">
                      Memuat log absensi...
                    </td>
                  </tr>
                ) : filteredRows.length > 0 ? (
                  filteredRows.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-55 last:border-0 hover:bg-gray-50/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                        {formatDateTime(r.waktu_absen)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        {r.nama_lengkap}
                        {r.diubah_oleh_admin && (
                          <span className="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded ml-2 font-semibold text-[10px]">
                            Manual Override
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {r.latitude ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}` : "Tanpa GPS"}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedPhoto(r.foto_url);
                            setSelectedLogName(r.nama_lengkap);
                          }}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs select-none cursor-pointer overflow-hidden border border-gray-100 hover:scale-105 transition-transform"
                          style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                          title="Lihat foto kehadiran"
                        >
                          {r.foto_url === "telegram" ? (
                            <div className="w-full h-full bg-[#2AB0B2]/10 flex items-center justify-center text-[#2AB0B2]">
                              <Send size={12} strokeWidth={2.5} />
                            </div>
                          ) : r.foto_url && r.foto_url !== "/uploads/placeholder.jpg" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.foto_url} alt="Selfie preview" className="w-full h-full object-cover" />
                          ) : (
                            r.nama_lengkap
                              .split(" ")
                              .map((w: string) => w[0])
                              .join("")
                              .slice(0, 2)
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={r.status} small />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-sm text-gray-400 font-medium">
                      Tidak ada log absensi yang cocok dengan kata kunci
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Split Pane User History View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: User Selection List */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 p-4 shadow-xs">
            <h2 className="text-sm font-bold text-[#1C3D3F] mb-3">Daftar Karyawan</h2>
            
            {/* Search Input for User List */}
            <div className="flex items-center gap-2 bg-gray-55 border border-gray-200 rounded-xl px-3 py-2 mb-4">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Cari karyawan..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="flex-1 outline-none text-xs text-gray-700 bg-transparent min-w-0 font-semibold"
              />
            </div>

            {/* Scrollable list */}
            <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1">
              {users
                .filter(u => u.role !== 'admin' && u.nama_lengkap.toLowerCase().includes(userSearchQuery.toLowerCase()))
                .map((u, i) => {
                  const isSelected = selectedUserForHistory?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserForHistory(u)}
                      className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer ${
                        isSelected 
                          ? "bg-[#2AB0B2]/10 border border-[#2AB0B2] text-[#1C3D3F]" 
                          : "bg-white hover:bg-gray-50 border border-gray-100 text-gray-700"
                      }`}
                    >
                      {/* Avatar */}
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white uppercase shrink-0 ${
                          isSelected ? "bg-[#2AB0B2]" : "bg-gray-300"
                        }`}
                        style={{ backgroundColor: isSelected ? undefined : AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                      >
                        {u.nama_lengkap.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                      </div>
                      
                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate leading-tight">{u.nama_lengkap}</p>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-black tracking-wider">{u.role === 'student' ? 'Siswa PKL' : 'Karyawan'}</p>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Right Column: User History View */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 p-5 shadow-xs min-h-[500px]">
            {!selectedUserForHistory ? (
              <div className="h-[450px] flex flex-col items-center justify-center text-center p-6 select-none animate-in fade-in duration-200">
                <div className="w-16 h-16 rounded-3xl bg-[#2AB0B2]/5 flex items-center justify-center text-[#2AB0B2] mb-4">
                  <User size={32} />
                </div>
                <h3 className="text-base font-bold text-[#1C3D3F]">Pilih Karyawan</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Silakan pilih salah satu karyawan di sebelah kiri untuk memuat riwayat absensi secara detail.
                </p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-200">
                {/* Header Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 mb-4 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#2AB0B2] text-white font-bold flex items-center justify-center text-sm shrink-0">
                      {selectedUserForHistory.nama_lengkap.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1C3D3F] leading-tight">{selectedUserForHistory.nama_lengkap}</h3>
                      <p className="text-xs text-gray-400 mt-0.5 font-medium">{selectedUserForHistory.username}</p>
                    </div>
                  </div>
                  
                  {/* Statistics */}
                  <div className="flex gap-4">
                    <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-1.5 text-center">
                      <p className="text-[10px] text-green-700 font-bold uppercase tracking-wider">Hadir</p>
                      <p className="text-lg font-black text-green-800 leading-tight">
                        {userHistoryLogs.filter(l => l.status === 'Hadir' || l.status === 'Terlambat').length}
                      </p>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-1.5 text-center">
                      <p className="text-[10px] text-orange-700 font-bold uppercase tracking-wider">Izin/Sakit</p>
                      <p className="text-lg font-black text-orange-800 leading-tight">
                        {userHistoryLogs.filter(l => l.status === 'Izin' || l.status === 'Sakit').length}
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-1.5 text-center">
                      <p className="text-[10px] text-red-700 font-bold uppercase tracking-wider">Alpa</p>
                      <p className="text-lg font-black text-red-800 leading-tight">
                        {userHistoryLogs.filter(l => l.status === 'Alpa').length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* History Table */}
                {loadingUserHistory ? (
                  <div className="text-center py-12 text-sm text-gray-400 font-medium">
                    Memuat riwayat absensi...
                  </div>
                ) : userHistoryLogs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="border-b border-gray-100 text-left bg-gray-50/50">
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Hari / Tanggal</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Masuk</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Pulang</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupLogsByDate(userHistoryLogs).map((g, i) => (
                          <tr key={i} className="border-b border-gray-55 last:border-0 hover:bg-gray-50/30 transition-colors">
                            <td className="px-4 py-3 text-sm font-semibold text-gray-700 flex flex-col">
                              <span>{g.formattedDate}</span>
                              {g.diubahOlehAdmin && (
                                <span className="text-orange-500 text-[9px] font-black uppercase tracking-wider mt-0.5">Diedit Admin</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-500 font-mono">
                              {g.checkInTime || <span className="text-gray-300">-</span>}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-500 font-mono">
                              {g.checkOutTime || <span className="text-gray-300">-</span>}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={g.status} small />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-sm text-gray-400 font-medium select-none">
                    Belum ada riwayat absensi terdaftar untuk karyawan ini.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
