"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, CheckCircle2, XCircle, Send } from "lucide-react";

const TEAL = "#2AB0B2";
const AMBER = "#F6C13B";

const STATUS_STYLES: Record<string, string> = {
  Hadir: "bg-green-500 text-white",
  Libur: "bg-[#F6C13B] text-white",
  Alpa: "bg-red-500 text-white",
  Sakit: "bg-blue-500 text-white",
  Izin: "bg-orange-400 text-white",
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

export default function AdminDashboardPage() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [absentToday, setAbsentToday] = useState(0);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Audit Photo Modal State
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedLogName, setSelectedLogName] = useState("");

  const loadData = async () => {
    try {
      // 1. Fetch Users
      const usersRes = await fetch("/api/users");
      let activeUsersCount = 0;
      let employees: any[] = [];
      if (usersRes.ok) {
        const usersList = await usersRes.json();
        // Filter out admin role and ensure account is active
        employees = usersList.filter((u: any) => u.role !== "admin" && u.is_active);
        activeUsersCount = employees.length;
        setTotalUsers(activeUsersCount);
      }

      // 2. Fetch Attendance
      const attendanceRes = await fetch("/api/attendance");
      if (attendanceRes.ok) {
        const logs = await attendanceRes.json();

        // Get logs for today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayLogs = logs.filter(
          (log: any) => new Date(log.waktu_absen).getTime() >= todayStart.getTime()
        );

        // Count unique employee attendance today (only count active users with role user)
        const uniquePresents = new Set(
          todayLogs
            .filter((log: any) => employees.some((emp) => emp.id === log.user_id))
            .map((log: any) => log.user_id)
        );
        
        setPresentToday(uniquePresents.size);
        setAbsentToday(Math.max(0, activeUsersCount - uniquePresents.size));

        // Set recent 5 logs
        setRecentLogs(logs.slice(0, 5));
      }
    } catch (err) {
      console.error("Gagal memuat statistik dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
  };

  const AVATAR_COLORS = [TEAL, "#10B981", "#3B82F6", "#F59E0B"];

  return (
    <div className="flex-1 bg-[#F0F2F5] p-6 md:p-10 select-none relative">
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
                  <p className="font-bold text-gray-700 text-sm">Foto Dikirim ke Telegram</p>
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
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

      <h1 className="text-3xl font-bold mb-9 text-[#1C3D3F]">Dashboard Admin</h1>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-xs p-8 flex flex-col items-center border border-gray-100/50">
          <p className="text-gray-500 font-medium mb-4 text-sm">Total Karyawan</p>
          <p className="font-black text-[#1C3D3F]" style={{ fontSize: 72, lineHeight: 1 }}>
            {loading ? "..." : totalUsers}
          </p>
        </div>
        <div
          className="bg-white rounded-2xl shadow-xs p-8 flex flex-col items-center border border-gray-100/50"
          style={{ borderTop: `5px solid ${TEAL}` }}
        >
          <p className="text-gray-500 font-medium mb-4 text-sm">Hadir Hari Ini</p>
          <p className="font-black text-[#1C3D3F]" style={{ fontSize: 72, lineHeight: 1 }}>
            {loading ? "..." : presentToday}
          </p>
        </div>
        <div
          className="bg-white rounded-2xl shadow-xs p-8 flex flex-col items-center border border-gray-100/50"
          style={{ borderTop: `5px solid ${AMBER}` }}
        >
          <p className="text-gray-500 font-medium mb-4 text-sm">Belum Hadir</p>
          <p className="font-black text-[#1C3D3F]" style={{ fontSize: 72, lineHeight: 1 }}>
            {loading ? "..." : absentToday}
          </p>
        </div>
      </div>

      {/* Mini Attendance Table Preview */}
      <div className="bg-white rounded-2xl shadow-xs overflow-hidden border border-gray-100/50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <p className="font-bold text-gray-700">Absensi Hari Ini / Terakhir</p>
          <Link
            href="/admin/data"
            className="text-xs font-semibold hover:underline text-[#2AB0B2]"
          >
            Lihat Semua →
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                {["Waktu", "Nama", "Lokasi", "Foto", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-sm text-gray-400 font-medium">
                    Memuat data absensi...
                  </td>
                </tr>
              ) : recentLogs.length > 0 ? (
                recentLogs.map((r, i) => (
                  <tr key={i} className="border-b border-gray-55 last:border-0 hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-3.5 text-sm text-gray-500 font-mono">{formatTime(r.waktu_absen)}</td>
                    <td className="px-6 py-3.5 text-sm font-medium text-gray-800">{r.nama_lengkap}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-500">
                      {r.latitude ? `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}` : "Tanpa GPS"}
                    </td>
                    <td className="px-6 py-3.5">
                      <button
                        onClick={() => {
                          setSelectedPhoto(r.foto_url);
                          setSelectedLogName(r.nama_lengkap);
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs select-none cursor-pointer overflow-hidden border border-gray-100 hover:scale-105 transition-transform"
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
                    <td className="px-6 py-3.5">
                      <StatusBadge status={r.status} small />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-sm text-gray-400 font-medium">
                    Belum ada data absensi hari ini.
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
