"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, Clock, AlertTriangle, X } from "lucide-react";
import { getDeviceId } from "../utils/session";
import { compressImage, IMAGE_PRESETS } from "../utils/image";

const REPORT_UPLOAD_CONFIG = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]
};

export default function UserHomePage() {
  const router = useRouter();
  const [fullname, setFullname] = useState("Karyawan");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
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

  // WFH (Remote Working) states
  const [loadingWfh, setLoadingWfh] = useState(true);
  const [wfhRequest, setWfhRequest] = useState<any>(null);
  const [isWfhActive, setIsWfhActive] = useState(false);
  const [remotePermissions, setRemotePermissions] = useState<any>(null);
  const [wfhModalOpen, setWfhModalOpen] = useState(false);
  const [wfhAlasan, setWfhAlasan] = useState("");
  const [wfhSubmitting, setWfhSubmitting] = useState(false);
  const [wfhErrorMsg, setWfhErrorMsg] = useState("");

  // Daily Report states
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportContent, setReportContent] = useState("");
  interface ReportAttachment {
    id: string;
    name: string;
    type: string;
    base64: string;
  }
  const [reportAttachments, setReportAttachments] = useState<ReportAttachment[]>([]);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportErrorMsg, setReportErrorMsg] = useState("");

  const fetchWfhStatus = async (userId: string) => {
    try {
      setLoadingWfh(true);
      const res = await fetch(`/api/remote/requests/me?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setWfhRequest(data.wfhRequest);
        setIsWfhActive(data.remoteStatus === "APPROVED");
        setRemotePermissions(data.permissions);
      }
    } catch (err) {
      console.error("Gagal memuat status WFH:", err);
    } finally {
      setLoadingWfh(false);
    }
  };

  const handleCancelWfh = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!wfhRequest) return;
    if (!confirm("Apakah Anda yakin ingin membatalkan pengajuan Remote Working ini?")) return;

    setWfhSubmitting(true);
    try {
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) return;
      const userObj = JSON.parse(storedUser);

      const res = await fetch(`/api/remote/requests/${wfhRequest.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userObj.id,
          device_id: getDeviceId(),
          role: "user"
        })
      });

      const data = await res.json();
      if (res.ok) {
        await fetchWfhStatus(userObj.id);
      } else {
        alert(data.error || "Gagal membatalkan permohonan");
      }
    } catch (err) {
      alert("Gagal menghubungi server");
    } finally {
      setWfhSubmitting(false);
    }
  };

  const handleWfhSubmit = async () => {
    if (!wfhAlasan.trim()) {
      setWfhErrorMsg("⚠️ Harap isi alasan pengajuan Remote Working");
      return;
    }

    setWfhSubmitting(true);
    setWfhErrorMsg("");

    try {
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) return;
      const userObj = JSON.parse(storedUser);

      const res = await fetch("/api/remote/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userObj.id,
          device_id: getDeviceId(),
          alasan: wfhAlasan
        })
      });

      const data = await res.json();
      if (res.ok) {
        setWfhModalOpen(false);
        await fetchWfhStatus(userObj.id);
      } else {
        setWfhErrorMsg(data.error || "Gagal mengirim pengajuan");
      }
    } catch (err) {
      setWfhErrorMsg("⚠️ Gagal menghubungi server");
    } finally {
      setWfhSubmitting(false);
    }
  };

  const handleReportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: ReportAttachment[] = [...reportAttachments];
    setReportErrorMsg("");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!REPORT_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
        setReportErrorMsg(`⚠️ Format berkas "${file.name}" tidak didukung.`);
        continue;
      }

      if (file.size > REPORT_UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES) {
        setReportErrorMsg(`⚠️ Ukuran berkas "${file.name}" melebihi batas 5MB.`);
        continue;
      }

      if (newAttachments.some(att => att.name === file.name)) continue;

      try {
        let fileToProcess = file;
        if (file.type.startsWith("image/")) {
          try {
            fileToProcess = await compressImage(file, IMAGE_PRESETS.report);
          } catch (compressionErr) {
            console.error("Gagal melakukan kompresi berkas:", file.name, compressionErr);
          }
        }
        
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(fileToProcess);
        });

        newAttachments.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.type,
          base64
        });
      } catch (error) {
        console.error("Gagal memproses berkas:", file.name, error);
      }
    }

    setReportAttachments(newAttachments);
    e.target.value = "";
  };

  const handleReportSubmit = async () => {
    if (!reportContent.trim()) {
      setReportErrorMsg("⚠️ Harap isi rincian Laporan Kerja (Daily Report)");
      return;
    }

    setReportSubmitting(true);
    setReportErrorMsg("");

    try {
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) return;
      const userObj = JSON.parse(storedUser);

      const attachmentsBase64 = reportAttachments.map(att => att.base64);

      const res = await fetch(`/api/remote/requests/${wfhRequest.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userObj.id,
          device_id: getDeviceId(),
          report_content: reportContent,
          attachments_base64: attachmentsBase64
        })
      });

      const data = await res.json();
      if (res.ok) {
        setReportModalOpen(false);
        await fetchWfhStatus(userObj.id);
      } else {
        setReportErrorMsg(data.error || "Gagal mengirim Daily Report");
      }
    } catch (err) {
      setReportErrorMsg("⚠️ Gagal menghubungi server");
    } finally {
      setReportSubmitting(false);
    }
  };

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
      await fetchWfhStatus(userObj.id);

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
    if (isWfhActive) {
      sessionStorage.setItem("v2_scanned_token", "ABSENSI-KANTOR-PENGESAHAN-TOKEN-2026");
      router.push("/user/selfie");
    } else {
      router.push("/user/qr-scan");
    }
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedFile = await compressImage(file, IMAGE_PRESETS.selfie);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPhotoBase64(base64);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error("Gagal melakukan kompresi berkas izin/sakit:", error);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPhotoBase64(base64);
      };
      reader.readAsDataURL(file);
    }
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



      {/* Remote Working (WFH) Status Card */}
      <div className="bg-white rounded-2xl shadow-xs p-4 mb-2 border border-gray-100/50 flex flex-col gap-2">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status Remote Working (WFH)</p>
        
        {loadingWfh ? (
          <p className="text-xs text-gray-400 font-medium">Memuat status remote...</p>
        ) : !wfhRequest ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">Anda berada di luar kantor? Ajukan Remote Working untuk melakukan absensi hari ini.</p>
            {remotePermissions?.remote?.allowed && (
              <button
                onClick={() => {
                  setWfhAlasan("");
                  setWfhErrorMsg("");
                  setWfhModalOpen(true);
                }}
                className="py-2.5 px-4 rounded-xl bg-[#2AB0B2] text-white font-bold text-xs hover:bg-[#209092] transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                💻 Ajukan Remote Working
              </button>
            )}
          </div>
        ) : wfhRequest.status === "PENDING" ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                ⏳ Menunggu Persetujuan Atasan
              </span>
              <button
                type="button"
                onClick={handleCancelWfh}
                disabled={wfhSubmitting}
                className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors cursor-pointer"
              >
                Batalkan
              </button>
            </div>
            <p className="text-xs text-gray-400 italic">"Alasan: {wfhRequest.alasan}"</p>
          </div>
        ) : wfhRequest.status === "APPROVED" && isWfhActive ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                🟢 Remote Working Aktif
              </span>
              <span className="text-[10px] text-gray-400 font-bold">Bypass Radius Kantor</span>
            </div>
            
            {clockInTime ? (
              wfhRequest.report_submitted_at ? (
                <div className="mt-1 p-2 bg-emerald-50 rounded-xl border border-dashed border-emerald-200 text-center text-xs font-semibold text-emerald-700">
                  ✅ Daily Report Hari Ini Sudah Dikirim
                </div>
              ) : (
                <button
                  onClick={() => {
                    setReportContent("");
                    setReportAttachments([]);
                    setReportErrorMsg("");
                    setReportModalOpen(true);
                  }}
                  className="mt-1 py-2.5 px-4 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  📝 Kirim Daily Report
                </button>
              )
            ) : (
              <p className="text-[11px] text-amber-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100 font-medium">
                * Daily Report dapat diisi setelah Anda melakukan absen masuk.
              </p>
            )}
          </div>
        ) : wfhRequest.status === "REJECTED" ? (
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 self-start">
              🔴 Pengajuan Ditolak Atasan
            </span>
            <p className="text-xs text-gray-500 mt-1">Silakan melakukan absensi secara normal dari area kantor.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">Pengajuan remote working hari ini telah dibatalkan atau kedaluwarsa.</p>
            {remotePermissions?.remote?.allowed && (
              <button
                onClick={() => {
                  setWfhAlasan("");
                  setWfhErrorMsg("");
                  setWfhModalOpen(true);
                }}
                className="py-2.5 px-4 rounded-xl bg-[#2AB0B2] text-white font-bold text-xs hover:bg-[#209092] transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                💻 Ajukan Remote Working Baru
              </button>
            )}
          </div>
        )}
      </div>

      {/* Centered Clock card Area */}
      {(!loadingWfh && wfhRequest?.status !== "PENDING") && (
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
                  remotePermissions?.clockOut?.allowed ? (
                    <button
                      onClick={handleStartAbsenPulang}
                      className="w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                    >
                      <Camera size={20} /> Absen Pulang
                    </button>
                  ) : isWfhActive ? (
                    wfhRequest?.report_submitted_at ? (
                      <div className="text-center text-xs text-emerald-700 font-semibold py-3 bg-emerald-50 border border-dashed border-emerald-200 rounded-2xl">
                        ✅ Hari kerja remote selesai (Daily Report terkirim)
                      </div>
                    ) : (
                      <div className="text-center text-xs text-[#2AB0B2] font-semibold py-3 bg-emerald-50/50 border border-dashed border-emerald-100 rounded-2xl">
                        💻 Remote Active (Silakan Kirim Daily Report untuk menyelesaikan absensi)
                      </div>
                    )
                  ) : null
                ) : (
                  <>
                    {remotePermissions?.clockIn?.allowed && (
                      <button
                        onClick={handleStartAbsen}
                        className="w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform bg-[#2AB0B2] hover:bg-[#209092] cursor-pointer"
                      >
                        <Camera size={20} /> Mulai Absen
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {remotePermissions?.leave?.allowed && (
                        <button
                          onClick={() => openModal("Izin")}
                          className="py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97] transition-all"
                        >
                          📝 Pengajuan Izin
                        </button>
                      )}
                      {remotePermissions?.sick?.allowed && (
                        <button
                          onClick={() => openModal("Sakit")}
                          className="py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97] transition-all"
                        >
                          🤒 Sakit / Dokter
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
      {/* WFH Request Modal */}
      {wfhModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity select-none animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl border border-gray-150 transform scale-100 transition-transform">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Pengajuan Remote Working
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              Silakan tuliskan alasan lengkap Anda mengajukan kerja jarak jauh (WFH) hari ini. Tautan persetujuan akan dikirimkan ke email atasan.
            </p>

            {wfhErrorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-semibold text-center">
                {wfhErrorMsg}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5">
                  Alasan Pengajuan
                </label>
                <textarea
                  rows={4}
                  placeholder="Contoh: Saya sedang berada di luar kota menghadiri kegiatan dinas luar / karena kendala teknis..."
                  value={wfhAlasan}
                  onChange={(e) => setWfhAlasan(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors bg-gray-50/50 resize-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => setWfhModalOpen(false)}
                className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors cursor-pointer text-center"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleWfhSubmit}
                disabled={wfhSubmitting}
                className="py-3 bg-[#2AB0B2] hover:bg-[#209092] text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer text-center"
              >
                {wfhSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity select-none animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl border border-gray-150 transform scale-100 transition-transform">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Kirim Daily Report WFH
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              Laporkan hasil pekerjaan yang telah Anda selesaikan hari ini beserta berkas pendukung (opsional). Laporan akan dikirim ke email atasan.
            </p>

            {reportErrorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-semibold text-center">
                {reportErrorMsg}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5">
                  Rincian Laporan Kerja
                </label>
                <textarea
                  rows={4}
                  placeholder="Tulis pekerjaan hari ini secara detail..."
                  value={reportContent}
                  onChange={(e) => setReportContent(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors bg-gray-50/50 resize-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5 flex justify-between">
                  <span>Berkas / Foto Lampiran (Opsional)</span>
                  <span className="text-gray-400 font-normal">{reportAttachments.length} Berkas</span>
                </label>
                <div 
                  onClick={() => document.getElementById("report-attachment-upload")?.click()}
                  className="w-full py-6 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-[#2AB0B2] transition-colors relative overflow-hidden bg-gray-50/50 mb-3"
                  style={{ minHeight: "100px" }}
                >
                  <Camera size={20} className="text-gray-300 mb-1" />
                  <span className="text-xs font-semibold text-gray-500">Ambil Foto / Pilih Berkas (Max 5MB)</span>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={handleReportFileChange}
                  className="hidden"
                  id="report-attachment-upload"
                />

                {reportAttachments.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto pr-1">
                    {reportAttachments.map((att) => (
                      <div key={att.id} className="relative p-2 bg-gray-50 border border-gray-150 rounded-xl flex items-center gap-2 group">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-200">
                          {att.type.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={att.base64} alt={att.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-red-500 font-extrabold text-xs">PDF</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-gray-700 truncate">{att.name}</p>
                          <p className="text-[9px] text-gray-400 uppercase font-bold">{att.type.split('/')[1] || 'FILE'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReportAttachments(prev => prev.filter(a => a.id !== att.id));
                          }}
                          className="w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors cursor-pointer text-center"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleReportSubmit}
                disabled={reportSubmitting}
                className="py-3 bg-[#2AB0B2] hover:bg-[#209092] text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer text-center"
              >
                {reportSubmitting ? "Mengirim..." : "Kirim Laporan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copyright */}
      <p className="text-[10px] text-gray-400 text-center py-2 select-none flex-shrink-0">
        © 2026 sampulkreativ · sampulkreativ.app · All rights reserved
      </p>
    </div>
  );
}
