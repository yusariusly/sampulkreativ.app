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
  const [kategori, setKategori] = useState("Karyawan");
  
  // Clock state
  const [now, setNow] = useState(new Date());

  // Izin & Sakit states
  const [isSakit, setIsSakit] = useState(false);
  const [isIzin, setIsIzin] = useState(false);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"Izin" | "Sakit" | null>(null);
  const [reason, setReason] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
      setKategori(userObj.kategori || "Karyawan");

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

        const sakitLog = todayLogs.find(
          (log: any) => log.status === 'Sakit'
        );

        const izinLog = todayLogs.find(
          (log: any) => log.status === 'Izin'
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

        setIsSakit(!!sakitLog);
        setIsIzin(!!izinLog);
      }
    } catch (err) {
      console.error("Gagal mengambil data beranda:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

  const openModal = (type: "Izin" | "Sakit") => {
    setModalType(type);
    setReason("");
    setPhotoBase64(null);
    setErrorMsg("");
    setModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL("image/jpeg", 0.8);
        setPhotoBase64(base64);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleModalSubmit = async () => {
    if (!photoBase64) {
      setErrorMsg(
        modalType === "Sakit" 
          ? "⚠️ Harap unggah foto surat sakit dokter" 
          : "⚠️ Harap unggah foto bukti pendukung"
      );
      return;
    }

    if (modalType === "Izin" && !reason.trim()) {
      setErrorMsg("⚠️ Harap isi keterangan/alasan izin Anda");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) return;
      const userObj = JSON.parse(storedUser);

      let lat = null;
      let lng = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (err) {
        console.warn("GPS tidak didapatkan untuk pengajuan");
      }

      const deviceId = localStorage.getItem("v2_device_id") || "";

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userObj.id,
          foto_base64: photoBase64,
          latitude: lat ? String(lat) : null,
          longitude: lng ? String(lng) : null,
          status: modalType,
          reason: reason,
          device_id: deviceId
        })
      });

      const data = await res.json();
      if (res.ok) {
        setModalOpen(false);
        await fetchAttendance();
      } else {
        setErrorMsg(data.error || "Gagal mengajukan permohonan");
      }
    } catch (err) {
      setErrorMsg("⚠️ Gagal menghubungi server");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateKategori = async (newKategori: string) => {
    try {
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) return;
      const userObj = JSON.parse(storedUser);
      
      const res = await fetch("/api/users/update-bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userObj.id,
          kategori: newKategori
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setKategori(newKategori);
          userObj.kategori = newKategori;
          localStorage.setItem("v2_user", JSON.stringify(userObj));
        }
      }
    } catch (err) {
      console.error("Gagal memperbarui kategori:", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F2F5] px-5 pt-6 pb-6 select-none relative">
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

      {/* Category selector on Homepage */}
      <div className="bg-white rounded-2xl shadow-xs p-4 mb-2 border border-gray-100/50 flex flex-col gap-2">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Kategori Keanggotaan Anda</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleUpdateKategori("Karyawan")}
            className={`py-2 px-3 rounded-xl font-bold text-xs transition-all border cursor-pointer flex items-center justify-center gap-1 ${
              kategori === "Karyawan"
                ? "bg-[#2AB0B2] text-white border-[#2AB0B2]"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            💼 Karyawan
          </button>
          <button
            onClick={() => handleUpdateKategori("PKL")}
            className={`py-2 px-3 rounded-xl font-bold text-xs transition-all border cursor-pointer flex items-center justify-center gap-1 ${
              kategori === "PKL"
                ? "bg-[#2AB0B2] text-white border-[#2AB0B2]"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            🎓 PKL / Magang
          </button>
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
            ) : isSakit ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> Tercatat Sakit
              </span>
            ) : isIzin ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Tercatat Izin
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
            <div className="w-full space-y-4">
              {clockOutTime ? (
                <div className="text-center text-xs text-gray-400 font-semibold py-3 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                  ✅ Anda telah menyelesaikan absen pulang untuk hari ini
                </div>
              ) : isSakit ? (
                <div className="text-center text-xs text-rose-500 font-semibold py-3 bg-rose-50 border border-dashed border-rose-200 rounded-2xl">
                  🤒 Anda hari ini tercatat Sakit (Surat dokter terkirim)
                </div>
              ) : isIzin ? (
                <div className="text-center text-xs text-amber-500 font-semibold py-3 bg-amber-50 border border-dashed border-amber-200 rounded-2xl">
                  📝 Anda hari ini tercatat Izin (Keterangan terkirim)
                </div>
              ) : clockInTime ? (
                <button
                  onClick={handleStartAbsenPulang}
                  className="w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                >
                  <Camera size={20} /> Absen Pulang
                </button>
              ) : (
                <>
                  <button
                    onClick={handleStartAbsen}
                    className="w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform bg-[#2AB0B2] hover:bg-[#209092] cursor-pointer"
                  >
                    <Camera size={20} /> Mulai Absen
                  </button>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => openModal("Izin")}
                      className="py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97] transition-all"
                    >
                      📝 Pengajuan Izin
                    </button>
                    <button
                      onClick={() => openModal("Sakit")}
                      className="py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97] transition-all"
                    >
                      🤒 Sakit / Dokter
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity select-none animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl border border-gray-150 transform scale-100 transition-transform">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Pengajuan Absen {modalType}
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              {modalType === "Sakit" 
                ? "Silakan unggah foto surat sakit dari dokter untuk dikirimkan ke email administrator." 
                : "Silakan unggah foto bukti pendukung dan isi keterangan pengajuan izin Anda."}
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-semibold text-center">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              {/* File Uploader */}
              <div>
                <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5">
                  {modalType === "Sakit" ? "Foto Surat Sakit Dokter" : "Foto Bukti Pendukung"}
                </label>
                <div 
                  onClick={() => document.getElementById("attachment-upload")?.click()}
                  className="w-full py-6 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-[#2AB0B2] transition-colors relative overflow-hidden bg-gray-50/50"
                  style={{ minHeight: "120px" }}
                >
                  {photoBase64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoBase64} alt="Preview" className="max-h-36 object-contain" />
                  ) : (
                    <>
                      <Camera size={24} className="text-gray-300 mb-1" />
                      <span className="text-xs font-semibold text-gray-500">Klik untuk Ambil / Pilih Foto</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="attachment-upload"
                />
              </div>

              {/* Reason / Custom Content */}
              {modalType === "Izin" && (
                <div>
                  <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5">
                    Keterangan / Isi Email Izin
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Contoh: Saya izin cuti hari ini karena ada keperluan keluarga yang mendesak..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors bg-gray-50/50 resize-none text-sm"
                  />
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors cursor-pointer text-center"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleModalSubmit}
                disabled={isSubmitting}
                className="py-3 bg-[#2AB0B2] hover:bg-[#209092] text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer text-center"
              >
                {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copyright */}
      <p className="text-[10px] text-gray-400 text-center py-2 select-none flex-shrink-0">
        © 2026 sampulkreativ · Absensi SK · All rights reserved
      </p>
    </div>
  );
}
