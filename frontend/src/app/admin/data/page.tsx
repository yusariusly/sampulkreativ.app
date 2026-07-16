"use client";

import React, { useEffect, useState } from "react";
import { Search, Calendar, ChevronDown, Download, CheckCircle2, XCircle, Send, ChevronLeft, ChevronRight, AlertTriangle, Edit2 } from "lucide-react";

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

  const getLocalDateString = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()));

  // Photo Audit Modal State
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedLogName, setSelectedLogName] = useState("");

  // Override states
  const [users, setUsers] = useState<any[]>([]);
  const [overrideUser, setOverrideUser] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("Hadir");
  const [overrideDate, setOverrideDate] = useState("");
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
        body: JSON.stringify({ username: overrideUser, status: overrideStatus, date: overrideDate }),
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

  useEffect(() => {
    fetchLogs();
    fetchUsers();
  }, []);

  const handlePrevDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - 1);
    setSelectedDate(getLocalDateString(current));
  };

  const handleNextDay = () => {
    const current = new Date(selectedDate);
    const todayStr = getLocalDateString(new Date());
    if (getLocalDateString(current) === todayStr) return; // Prevent going to tomorrow
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs" onClick={(e) => { if (e.target === e.currentTarget) setIsOverrideModalOpen(false); }}>
          <div className="bg-white rounded-3xl overflow-hidden max-w-sm w-full shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1C3D3F] mb-1">Override Status Absensi</h3>
            <p className="text-gray-400 text-xs mb-6 font-medium">Ubah status kehadiran karyawan secara manual</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wider">Pilih Karyawan</label>
                <select
                  value={overrideUser}
                  onChange={(e) => setOverrideUser(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none bg-white text-gray-700 transition-colors cursor-pointer font-medium"
                >
                  <option value="">Pilih Karyawan</option>
                  {users
                    .filter((u) => u.role !== "admin")
                    .map((u) => (
                      <option key={u.username} value={u.username} className="font-medium text-gray-700">
                        {u.nama_lengkap}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wider">Tanggal Absensi</label>
                <input
                  type="date"
                  value={overrideDate}
                  onChange={(e) => setOverrideDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none bg-white text-gray-700 transition-colors cursor-pointer font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wider">Status Kehadiran</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none bg-white text-gray-700 transition-colors cursor-pointer font-medium"
                >
                  <option>Hadir</option>
                  <option>Izin</option>
                  <option>Sakit</option>
                  <option>Alpa</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl font-bold transition-colors cursor-pointer text-sm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleOverrideStatus}
                  className="flex-1 py-3 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl font-bold shadow-sm transition-colors cursor-pointer text-sm"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header bar with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1C3D3F]">Data Absensi</h1>
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

      {/* Main Table Card containing integrated Toolbar */}
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
                max={getLocalDateString(new Date())}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="outline-none text-sm font-semibold text-gray-750 bg-transparent border-0 cursor-pointer w-28 sm:w-auto"
              />
            </div>

            <button
              onClick={handleNextDay}
              disabled={selectedDate === getLocalDateString(new Date())}
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
    </div>
  );
}
