"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, Clock, AlertTriangle } from "lucide-react";

export default function UserHomePage() {
  const router = useRouter();
  const [fullname, setFullname] = useState("Karyawan");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Clock state
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const fetchAttendance = async () => {
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

        const res = await fetch(`/api/attendance?user_id=${userObj.id}`);
        if (res.ok) {
          const logs = await res.json();
          
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const todayLogs = logs.filter(
            (log: any) => new Date(log.waktu_absen).getTime() >= todayStart.getTime()
          );

          const checkInLog = todayLogs.find(
            (log: any) => log.status === 'Hadir' || log.status === 'Terlambat'
          );

          const checkOutLog = todayLogs.find(
            (log: any) => log.status === 'Pulang'
          );

          if (checkInLog) {
            const timeObj = new Date(checkInLog.waktu_absen);
            const hh = String(timeObj.getHours()).padStart(2, "0");
            const mm = String(timeObj.getMinutes()).padStart(2, "0");
            setClockInTime(`${hh}:${mm}`);
          } else {
            setClockInTime(null);
          }

          if (checkOutLog) {
            const timeObj = new Date(checkOutLog.waktu_absen);
            const hh = String(timeObj.getHours()).padStart(2, "0");
            const mm = String(timeObj.getMinutes()).padStart(2, "0");
            setClockOutTime(`${hh}:${mm}`);
          } else {
            setClockOutTime(null);
          }
        }
      } catch (err) {
        console.error("Gagal mengambil data beranda:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
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

  const handleStartAbsen = () => {
    sessionStorage.setItem("v2_absen_type", "masuk");
    router.push("/user/qr-scan");
  };

  const handleStartAbsenPulang = () => {
    sessionStorage.setItem("v2_absen_type", "pulang");
    router.push("/user/qr-scan");
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F2F5] px-5 pt-6 pb-6 select-none">
      {/* Greeting */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-13 h-13 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0 overflow-hidden border border-gray-150 shadow-xs bg-white"
            style={{ width: 48, height: 48 }}
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
            <p className="text-gray-500 text-xs leading-none">Halo,</p>
            <p className="text-base font-bold leading-tight text-[#2AB0B2]">{fullname}</p>
          </div>
        </div>
      </div>

      {/* Centered Clock card Area */}
      <div className="flex-1 flex flex-col justify-center py-4">
        {/* Clock card */}
        <div className="bg-white rounded-3xl shadow-sm px-5 py-8 border border-gray-100/50 w-full">
          <p className="text-center font-bold text-gray-800 text-sm mb-0.5">Hari Ini</p>
          <p className="text-center text-gray-400 text-[11px] mb-4">{dateStr}</p>

          <p
            className="text-center font-black mb-1 tracking-tight text-[#1C3D3F]"
            style={{ fontSize: 68, lineHeight: 1 }}
          >
            {hh}:{mm}
          </p>
          <p className="text-center text-gray-400 text-xs mb-4">Waktu Sekarang</p>

          {/* Status Label (Compact Badge) */}
          <div className="flex justify-center mb-6">
            {loading ? (
              <span className="text-gray-400 text-xs font-medium">Memuat data...</span>
            ) : clockOutTime ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Sudah Absen Pulang ({clockOutTime})
              </span>
            ) : clockInTime ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Sudah Absen Masuk ({clockInTime})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F6C13B] animate-pulse" /> Belum Absen
              </span>
            )}
          </div>

          {/* CTA Button moved under Waktu Sekarang */}
          {!loading && (
            <div className="w-full">
              {clockOutTime ? (
                <div className="text-center text-xs text-gray-400 font-semibold py-3 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                  ✅ Anda telah menyelesaikan absen pulang untuk hari ini
                </div>
              ) : clockInTime ? (
                <button
                  onClick={handleStartAbsenPulang}
                  className="w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                >
                  <Camera size={20} /> Absen Pulang
                </button>
              ) : (
                <button
                  onClick={handleStartAbsen}
                  className="w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform bg-[#2AB0B2] hover:bg-[#209092] cursor-pointer"
                >
                  <Camera size={20} /> Mulai Absen
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Copyright */}
      <p className="text-[10px] text-gray-400 text-center py-2 select-none flex-shrink-0">
        © 2026 sampulkreativ · Absensi SK · All rights reserved
      </p>
    </div>
  );
}
