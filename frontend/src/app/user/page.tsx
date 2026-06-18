"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, Clock, AlertTriangle } from "lucide-react";

export default function UserHomePage() {
  const router = useRouter();
  const [fullname, setFullname] = useState("Karyawan");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [deadlineTime, setDeadlineTime] = useState("08:30");
  const [loading, setLoading] = useState(true);
  
  // Clock state
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const fetchAttendanceAndSettings = async () => {
      if (typeof window === "undefined") return;

      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) {
        router.push("/");
        return;
      }

      try {
        const userObj = JSON.parse(storedUser);
        setFullname(userObj.nama_lengkap);
        setProfilePhoto(userObj.foto_profile || null);

        // 1. Fetch settings (deadline time)
        const settingsRes = await fetch("/api/settings");
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings.deadline_time) {
            setDeadlineTime(settings.deadline_time);
          }
        }

        // 2. Fetch logs from backend
        const res = await fetch(`/api/attendance?user_id=${userObj.id}`);
        if (res.ok) {
          const logs = await res.json();
          
          // Check if today has a check-in record
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const todayLog = logs.find(
            (log: any) => new Date(log.waktu_absen).getTime() >= todayStart.getTime()
          );

          if (todayLog) {
            const timeObj = new Date(todayLog.waktu_absen);
            const hh = String(timeObj.getHours()).padStart(2, "0");
            const mm = String(timeObj.getMinutes()).padStart(2, "0");
            setClockInTime(`${hh}:${mm}`);
          } else {
            setClockInTime(null);
          }
        }
      } catch (err) {
        console.error("Gagal mengambil data beranda:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceAndSettings();
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, [router]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const dateStr = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // Check if current time exceeds deadline time
  const isPastDeadline = () => {
    const [deadH, deadM] = deadlineTime.split(":").map(Number);
    const currentH = now.getHours();
    const currentM = now.getMinutes();

    if (currentH > deadH) return true;
    if (currentH === deadH && currentM >= deadM) return true;
    return false;
  };

  const isAlpaStatus = !clockInTime && isPastDeadline();

  const handleStartAbsen = () => {
    router.push("/user/qr-scan");
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F2F5] px-5 pt-6 pb-6 select-none justify-between">
      {/* Upper Area */}
      <div>
        {/* Greeting */}
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <div
              className="w-13 h-13 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0 overflow-hidden border border-gray-150 shadow-xs bg-white"
              style={{ width: 52, height: 52 }}
            >
              {profilePhoto && profilePhoto !== "/uploads/placeholder.jpg" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ background: "linear-gradient(135deg, #2AB0B2, #1a8a8c)" }}
                >
                  {fullname.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <p className="text-gray-500 text-sm leading-none">Halo,</p>
              <p className="text-lg font-bold leading-tight text-[#2AB0B2]">{fullname}</p>
            </div>
          </div>
        </div>

        {/* Clock card */}
        <div className="bg-white rounded-3xl shadow-sm px-6 py-7 mb-7 border border-gray-100/50">
          <p className="text-center font-bold text-gray-800 text-base mb-0.5">Hari Ini</p>
          <p className="text-center text-gray-400 text-xs mb-5">{dateStr}</p>

          <p
            className="text-center font-black mb-1 tracking-tight text-[#1C3D3F]"
            style={{ fontSize: 76, lineHeight: 1 }}
          >
            {hh}:{mm}
          </p>
          <p className="text-center text-gray-400 text-sm mb-6">Waktu Sekarang</p>

          {loading ? (
            <div className="w-full py-3.5 rounded-full font-bold text-gray-400 bg-gray-50 border border-gray-100 text-center text-sm">
              Memuat data absensi...
            </div>
          ) : clockInTime ? (
            <div
              className="w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center gap-2 text-base bg-emerald-500 shadow-sm"
            >
              <span>Sudah Absen Masuk ({clockInTime})</span>
            </div>
          ) : isAlpaStatus ? (
            <div
              className="w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center gap-2 text-base bg-red-500 shadow-sm"
            >
              Terhitung Alpa <AlertTriangle size={18} />
            </div>
          ) : (
            <div
              className="w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center gap-2 text-base bg-[#F6C13B]"
            >
              Belum Absen <Clock size={18} />
            </div>
          )}
        </div>

        {/* Info Box for deadline */}
        <div className="bg-[#2AB0B2]/5 border border-[#2AB0B2]/10 rounded-2xl p-4.5 text-xs text-gray-500 space-y-1.5">
          <p className="font-bold text-[#1C3D3F]">Batas Waktu Absen Masuk:</p>
          <p>
            • Paling lambat pukul <strong className="text-[#2AB0B2]">{deadlineTime} WIB</strong>.
          </p>
          <p>
            • Melewati jam tersebut tanpa absen masuk akan otomatis terhitung sebagai <strong className="text-red-500">Alpa</strong> untuk hari ini.
          </p>
        </div>
      </div>

      {/* CTA Button */}
      {!loading && (
        <>
          {clockInTime ? (
            <div className="text-center text-xs text-gray-400 font-semibold bg-white/70 py-3.5 rounded-xl border border-gray-200">
              ✅ Kehadiran terverifikasi untuk hari ini
            </div>
          ) : isAlpaStatus ? (
            <div className="flex flex-col gap-2">
              <div className="text-center text-xs text-red-500 font-bold bg-red-50 py-3 rounded-xl border border-red-100">
                ⚠️ Batas absen masuk ({deadlineTime}) telah berakhir
              </div>
              <button
                onClick={handleStartAbsen}
                className="w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform bg-[#2AB0B2]/60 cursor-pointer"
              >
                <Camera size={22} /> Tetap Absen (Terlambat)
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartAbsen}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform bg-[#2AB0B2] hover:bg-[#209092] cursor-pointer"
            >
              <Camera size={22} /> Mulai Absen
            </button>
          )}
        </>
      )}
    </div>
  );
}
