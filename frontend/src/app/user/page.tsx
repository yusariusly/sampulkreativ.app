"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Clock, AlertTriangle, X, Lock, ArrowLeft, Calendar, ClipboardList, CreditCard, ChevronRight, FileText, HeartPulse, Laptop, Check, LogOut, Key } from "lucide-react";
import { getDeviceId } from "../utils/session";
import { compressImage, IMAGE_PRESETS } from "../utils/image";
import { useStudentDashboard, StudentDashboardView, SkeletonCard, ErrorState } from "@/features/pkl-activity";
import KieSubmissionView from "./components/KieSubmissionView";


const REPORT_UPLOAD_CONFIG = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]
};

function UserDashboardContent() {
  const router = useRouter();
  const [fullname, setFullname] = useState("Karyawan");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStudent, setIsStudent] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("v2_user");
      if (stored) {
        try {
          return JSON.parse(stored).role === "student";
        } catch (e) {}
      }
    }
    return false;
  });
  
  // Role-based Gateway Portal & Navigation States
  const [userRole, setUserRole] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("v2_user");
      if (stored) {
        try {
          return JSON.parse(stored).role || "student";
        } catch (e) {}
      }
    }
    return "student";
  });
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("view") || "menu") as "menu" | "absen" | "pkl" | "payroll" | "kie";
  const [wobblingCard, setWobblingCard] = useState<string | null>(null);
  const [notification, setNotification] = useState("");

  // Payroll States
  const [payrollSlips, setPayrollSlips] = useState<any[]>([]);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<any | null>(null);
  const [payrollError, setPayrollError] = useState("");

  const studentDashboard = useStudentDashboard(undefined, { enabled: isStudent });
  
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
      setIsStudent(userObj.role === "student");
      setUserRole(userObj.role || "student");
      await fetchWfhStatus(userObj.id);
      if (userObj.role === "employee" || userObj.role === "admin") {
        fetchPayrollSlips(userObj.id);
      }

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

  // Sync payroll slips fetching with activeTab changes
  useEffect(() => {
    if (activeTab === "payroll") {
      const storedUser = localStorage.getItem("v2_user");
      if (storedUser) {
        try {
          const userObj = JSON.parse(storedUser);
          fetchPayrollSlips(userObj.id);
        } catch (e) {}
      }
    }
  }, [activeTab]);

  const navigateToTab = (tabName: "menu" | "absen" | "pkl" | "payroll" | "kie") => {
    if (tabName === "menu") {
      router.push("/user");
    } else {
      router.push(`/user?view=${tabName}`);
    }
  };

  const handleLogout = () => {
    if (confirm("Apakah Anda yakin ingin keluar dari portal?")) {
      localStorage.removeItem("v2_user");
      localStorage.removeItem("v2_clockInDate");
      localStorage.removeItem("v2_clockOutDate");
      localStorage.removeItem("v2_clockInTime");
      localStorage.removeItem("v2_scanned_token");
      router.push("/");
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification("");
    }, 3500);
  };

  const handleLockedClick = (moduleName: string) => {
    setWobblingCard(moduleName);
    const roleLabel = userRole === "student" ? "Siswa PKL" : userRole === "employee" ? "Karyawan" : "Administrator";
    showToast(`⚠️ Akses Terkunci: Modul ini tidak tersedia untuk peran ${roleLabel}`);
    setTimeout(() => {
      setWobblingCard(null);
    }, 450);
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  const fetchPayrollSlips = async (userId: string) => {
    setLoadingPayroll(true);
    setPayrollError("");
    try {
      const res = await fetch(`/api/payroll/slips?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setPayrollSlips(data);
      } else {
        setPayrollError("Gagal memuat data slip gaji");
      }
    } catch (err) {
      setPayrollError("Terjadi kesalahan koneksi");
    } finally {
      setLoadingPayroll(false);
    }
  };

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

  const getGreeting = () => {
    const hrs = now.getHours();
    if (hrs >= 5 && hrs < 12) return "Pagi";
    if (hrs >= 12 && hrs < 15) return "Siang";
    if (hrs >= 15 && hrs < 18) return "Sore";
    return "Malam";
  };

  const getIndonesianDate = () => {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const dayName = days[now.getDay()];
    const dateNum = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    return `${dayName}, ${dateNum} ${monthName} ${year}`;
  };

  return (
    <div className={`flex flex-col h-full bg-[#F8FAFC] px-5 select-none relative overflow-hidden ${
      activeTab === "menu" ? "pt-6 pb-6" : "pt-1 pb-0"
    }`}>
      {activeTab === "menu" && (
        <div className="flex-1 flex flex-col gap-5 py-2">
          {/* Greeting Section */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-150/50 flex-shrink-0">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
                Selamat {getGreeting()}
              </p>
              <h2 className="text-xl font-black tracking-tight text-[#1C3D3F] leading-tight">
                Halo, {fullname.split(" ")[0]} 👋
              </h2>
              <p className="text-[10px] font-bold text-[#2AB0B2] uppercase tracking-wider mt-1.5 flex items-center gap-1.5">
                <span>{getIndonesianDate()}</span>
                <span className="text-gray-300">•</span>
                <span>{userRole === "student" ? "Siswa PKL" : userRole === "employee" ? "Karyawan" : "Admin"}</span>
              </p>
            </div>
            
            {/* Avatar */}
            <div className="w-12 h-12 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs flex-shrink-0 flex items-center justify-center">
              {profilePhoto && profilePhoto !== "/uploads/placeholder.jpg" ? (
                <img src={profilePhoto} alt={fullname} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-black text-[#1C3D3F] uppercase">
                  {fullname.charAt(0)}
                </span>
              )}
            </div>
          </div>

          {/* Spacing / Layout Container */}
          <div className="flex-1 flex flex-col gap-6 mt-1 overflow-y-auto">
            {/* Primary Action Card: Attendance Hero Card */}
            <div className="w-full bg-white border border-gray-200/80 rounded-3xl p-5 shadow-xs flex flex-col justify-between min-h-[190px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={12} className="text-[#2AB0B2]" />
                    Absensi Kehadiran
                  </span>
                  <span className="text-[8px] font-black text-[#1C3D3F] uppercase bg-gray-100 px-2 py-0.5 rounded-md select-none">
                    Utama
                  </span>
                </div>
                
                <div className="mt-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider leading-none">Status Saat Ini</p>
                  <h3 className="text-2xl font-black text-[#1C3D3F] mt-1.5 tracking-tight">
                    {clockOutTime ? "Sudah Absen Pulang" :
                     isSakit ? "Izin Sakit" :
                     isIzin ? "Izin Absen" :
                     clockInTime ? "Sudah Absen Masuk" :
                     "Belum Absen"}
                  </h3>
                  <p className="text-xs font-semibold text-gray-400 mt-1 leading-normal">
                    {clockOutTime ? `Anda telah menyelesaikan absensi hari ini (Pulang: ${clockOutTime.slice(0, 5)} WIB).` :
                     isSakit ? "Status kehadiran hari ini terhitung sakit." :
                     isIzin ? "Status kehadiran hari ini terhitung izin." :
                     clockInTime ? `Anda sedang aktif bekerja (Masuk: ${clockInTime.slice(0, 5)} WIB). Jangan lupa absen pulang!` :
                     "Anda belum melakukan absensi masuk hari ini."}
                  </p>
                </div>
              </div>
              
              {(() => {
                let btnText = "Mulai Absensi Masuk";
                let btnColor = "bg-[#2AB0B2] hover:bg-[#209092]";
                
                if (clockOutTime) {
                  btnText = "Lihat Riwayat Absensi";
                  btnColor = "bg-[#1C3D3F] hover:bg-[#285557]";
                } else if (isSakit || isIzin) {
                  btnText = "Lihat Detail";
                  btnColor = "bg-[#1C3D3F] hover:bg-[#285557]";
                } else if (clockInTime) {
                  btnText = "Absen Pulang";
                  btnColor = "bg-rose-500 hover:bg-rose-600";
                }

                return (
                  <button
                    onClick={() => navigateToTab("absen")}
                    className={`w-full mt-5 py-3.5 ${btnColor} active:scale-[0.98] transition-all text-white font-black text-xs uppercase tracking-widest rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-xs`}
                  >
                    <span>{btnText}</span>
                    <ChevronRight size={14} />
                  </button>
                );
              })()}
            </div>

            {/* Services Section */}
            <div className="flex flex-col min-h-0">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 select-none">
                Layanan
              </h4>
              
              <div className="flex flex-col gap-3">
                {/* 1. Aktivitas PKL */}
                {(() => {
                  const isPklAllowed = userRole === "student" || userRole === "admin";
                  return (
                    <button
                      onClick={() => isPklAllowed ? navigateToTab("pkl") : handleLockedClick("pkl")}
                      className={`w-full text-left rounded-2xl p-4.5 transition-all duration-305 flex items-center justify-between border ${
                        !isPklAllowed 
                          ? "bg-slate-50/40 border-slate-200/50 cursor-not-allowed opacity-60" 
                          : "bg-white border-gray-200/60 hover:bg-slate-50/30 active:scale-[0.99] cursor-pointer shadow-3xs"
                      } ${wobblingCard === "pkl" ? "animate-wobble" : ""}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-9.5 h-9.5 rounded-xl flex items-center justify-center border flex-shrink-0 ${
                          !isPklAllowed 
                            ? "bg-slate-100/40 border-slate-200/50 text-slate-400" 
                            : "bg-slate-50 border-slate-150 text-[#1C3D3F]"
                        }`}>
                          <ClipboardList size={16} className={isPklAllowed ? "text-[#2AB0B2]" : ""} />
                        </div>
                        <div>
                          <h3 className={`font-black text-[11px] uppercase tracking-wider leading-none transition-colors ${
                            isPklAllowed ? "text-[#1C3D3F]" : "text-slate-400"
                          }`}>
                            Aktivitas PKL
                          </h3>
                          <p className={`text-[9px] font-semibold mt-1 leading-normal ${
                            isPklAllowed ? "text-gray-400" : "text-slate-350"
                          }`}>
                            Kurikulum, jurnal mingguan, & tugas harian.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 pl-2">
                        {isPklAllowed ? (
                          <>
                            {isStudent && studentDashboard.data ? (() => {
                              const activeWeekNo = studentDashboard.data.program_kerja?.active_week || 1;
                              return (
                                <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black bg-[#2AB0B2] text-white uppercase tracking-wider">
                                  Minggu {activeWeekNo}
                                </span>
                              );
                            })() : (
                              <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black bg-gray-100 text-gray-500 uppercase tracking-wider">
                                Aktif
                              </span>
                            )}
                            <ChevronRight size={12} className="text-gray-300" />
                          </>
                        ) : (
                          <div className="flex items-center gap-1 bg-slate-100 rounded-md px-1.5 py-0.5 text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                            <Lock size={9} className="text-slate-400" />
                            <span>Terkunci</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })()}

                {/* 2. Payroll */}
                {(() => {
                  const isPayrollAllowed = userRole === "employee" || userRole === "admin";
                  return (
                    <button
                      onClick={() => isPayrollAllowed ? navigateToTab("payroll") : handleLockedClick("payroll")}
                      className={`w-full text-left rounded-2xl p-4.5 transition-all duration-305 flex items-center justify-between border ${
                        !isPayrollAllowed 
                          ? "bg-slate-50/40 border-slate-200/50 cursor-not-allowed opacity-60" 
                          : "bg-white border-gray-200/60 hover:bg-slate-50/30 active:scale-[0.99] cursor-pointer shadow-3xs"
                      } ${wobblingCard === "payroll" ? "animate-wobble" : ""}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-9.5 h-9.5 rounded-xl flex items-center justify-center border flex-shrink-0 ${
                          !isPayrollAllowed 
                            ? "bg-slate-100/40 border-slate-200/50 text-slate-400" 
                            : "bg-slate-50 border-slate-150 text-[#1C3D3F]"
                        }`}>
                          <CreditCard size={16} className={isPayrollAllowed ? "text-[#2AB0B2]" : ""} />
                        </div>
                        <div>
                          <h3 className={`font-black text-[11px] uppercase tracking-wider leading-none transition-colors ${
                            isPayrollAllowed ? "text-[#1C3D3F]" : "text-slate-400"
                          }`}>
                            Payroll & Gaji
                          </h3>
                          <p className={`text-[9px] font-semibold mt-1 leading-normal ${
                            isPayrollAllowed ? "text-gray-400" : "text-slate-355"
                          }`}>
                            Akses riwayat slip gaji bulanan & slip kompensasi resmi.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 pl-2">
                        {isPayrollAllowed ? (
                          <>
                            {payrollSlips.length > 0 ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black bg-indigo-600 text-white uppercase tracking-wider">
                                {payrollSlips[0].periode}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black bg-gray-100 text-gray-500 uppercase tracking-wider">
                                Aktif
                              </span>
                            )}
                            <ChevronRight size={12} className="text-gray-300" />
                          </>
                        ) : (
                          <div className="flex items-center gap-1 bg-slate-100 rounded-md px-1.5 py-0.5 text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                            <Lock size={9} className="text-slate-400" />
                            <span>Terkunci</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })()}

                {/* 3. Setor API KIE AI */}
                {(() => {
                  return (
                    <button
                      onClick={() => navigateToTab("kie")}
                      className="w-full text-left rounded-2xl p-4.5 transition-all duration-305 flex items-center justify-between border bg-white border-gray-200/60 hover:bg-slate-50/30 active:scale-[0.99] cursor-pointer shadow-3xs"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-9.5 h-9.5 rounded-xl flex items-center justify-center border flex-shrink-0 bg-slate-50 border-slate-150 text-[#1C3D3F]">
                          <Key size={16} className="text-[#2AB0B2]" />
                        </div>
                        <div>
                          <h3 className="font-black text-[11px] uppercase tracking-wider leading-none text-[#1C3D3F]">
                            Setor API KIE AI
                          </h3>
                          <p className="text-[9px] font-semibold mt-1 leading-normal text-gray-400">
                            Masukkan kunci API KIE AI Anda untuk dikumpulkan ke grup Telegram.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 pl-2">
                        <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black bg-teal-600 text-white uppercase tracking-wider">
                          KIE AI
                        </span>
                        <ChevronRight size={12} className="text-gray-300" />
                      </div>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Footer Branding */}
          <footer className="w-full flex justify-center py-2 flex-shrink-0 select-none">
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest leading-none">
              sampulkreativ.app · All Rights Reserved
            </p>
          </footer>
        </div>
      )}

      {activeTab === "absen" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pt-0">

          {/* Greeting */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div
                className="w-13 h-13 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0 overflow-hidden border border-gray-150 shadow-xs bg-white"
                style={{ width: 48, height: 48 }}
              >
                {profilePhoto && profilePhoto !== "/uploads/placeholder.jpg" ? (
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
          {!loadingWfh && (
            <div className="flex-1 flex flex-col justify-center py-4">
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
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-[#1C3D3F] text-white border border-[#2AB0B2]/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2AB0B2]" /> Sudah Absen Pulang · {clockOutTime}
                    </span>
                  ) : isSakit ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Tercatat Sakit
                    </span>
                  ) : isIzin ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-600 text-white shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Tercatat Izin
                    </span>
                  ) : clockInTime ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-[#1C3D3F] text-white border border-[#2AB0B2]/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2AB0B2]" /> Sudah Absen Masuk · {clockInTime}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-500 border border-gray-250">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" /> Belum Absen
                    </span>
                  )}
                </div>

                {/* CTA Button moved under Waktu Sekarang */}
                {!loading && (
                  <div className="w-full space-y-4">
                    {clockOutTime ? (
                      <div className="text-center text-xs text-gray-400 font-semibold py-3 bg-gray-50 border border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-1.5">
                        <Check size={14} className="text-emerald-500" /> Anda telah menyelesaikan absen pulang untuk hari ini
                      </div>
                    ) : isSakit ? (
                      <div className="text-center text-xs text-rose-500 font-semibold py-3 bg-rose-50 border border-dashed border-rose-200 rounded-2xl flex items-center justify-center gap-1.5">
                        <HeartPulse size={14} className="text-rose-500 animate-pulse" /> Anda hari ini tercatat Sakit (Surat dokter terkirim)
                      </div>
                    ) : isIzin ? (
                      <div className="text-center text-xs text-amber-500 font-semibold py-3 bg-amber-50 border border-dashed border-amber-200 rounded-2xl flex items-center justify-center gap-1.5">
                        <FileText size={14} className="text-amber-500" /> Anda hari ini tercatat Izin (Keterangan terkirim)
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
                          <div className="text-center text-xs text-emerald-700 font-semibold py-3 bg-emerald-50 border border-dashed border-emerald-200 rounded-2xl flex items-center justify-center gap-1.5">
                            <Check size={14} className="text-emerald-500" /> Hari kerja remote selesai (Daily Report terkirim)
                          </div>
                        ) : (
                          <div className="text-center text-xs text-[#2AB0B2] font-semibold py-3 bg-emerald-50/50 border border-dashed border-emerald-100 rounded-2xl flex items-center justify-center gap-1.5">
                            <Laptop size={14} className="text-[#2AB0B2]" /> Remote Active (Silakan Kirim Daily Report untuk menyelesaikan absensi)
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
                              className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1C3D3F] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97] transition-all"
                            >
                              <FileText size={14} className="text-[#2AB0B2]" /> Pengajuan Izin
                            </button>
                          )}
                          {remotePermissions?.sick?.allowed && (
                            <button
                              onClick={() => openModal("Sakit")}
                              className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1C3D3F] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97] transition-all"
                            >
                              <HeartPulse size={14} className="text-rose-600" /> Izin Sakit
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {/* Status & Kontrol Remote Working (WFH) */}
                    {!loadingWfh && (
                      <div className="pt-3.5 border-t border-slate-100 mt-2 flex flex-col gap-2">
                        {/* 1. Jik                        {/* 1. Jika belum mengajukan & diizinkan mengajukan */}
                        {!wfhRequest && remotePermissions?.remote?.allowed && !clockInTime && !clockOutTime && !isSakit && !isIzin && (
                          <div className="bg-slate-50 border border-gray-150 rounded-2xl p-3.5 flex flex-col gap-2.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pekerjaan Jarak Jauh</p>
                            <p className="text-gray-500 text-[11px] leading-normal">Bekerja di luar kantor? Ajukan Remote Working (WFH) untuk melakukan absensi hari ini.</p>
                            <button
                              onClick={() => {
                                setWfhAlasan("");
                                setWfhErrorMsg("");
                                setWfhModalOpen(true);
                              }}
                              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
                            >
                              <Laptop size={14} /> Ajukan Remote Working
                            </button>
                          </div>
                        )}
 
                        {/* 2. Jika pengajuan sedang PENDING */}
                        {wfhRequest && wfhRequest.status === "PENDING" && (
                          <div className="bg-slate-50 border border-gray-150 rounded-2xl p-3.5 flex flex-col gap-2.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status Remote Working</p>
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-500 text-white uppercase tracking-wider">
                                <Clock size={10} className="animate-pulse" /> Pending Persetujuan
                              </span>
                              <button
                                type="button"
                                onClick={handleCancelWfh}
                                disabled={wfhSubmitting}
                                className="text-xs font-bold text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                Batalkan
                              </button>
                            </div>
                            <p className="text-gray-500 text-[11px] italic leading-normal">&ldquo;Alasan: {wfhRequest.alasan}&rdquo;</p>
                          </div>
                        )}
 
                        {/* 3. Jika pengajuan APPROVED (WFH Aktif) */}
                        {wfhRequest && wfhRequest.status === "APPROVED" && isWfhActive && (
                          <div className="bg-[#1C3D3F] border border-[#2AB0B2]/20 rounded-2xl p-4 flex flex-col gap-3 text-white">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-[#2AB0B2] text-white uppercase tracking-wider">
                                <Check size={10} /> Remote Working Aktif
                              </span>
                              <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">Bypass Radius Kantor</span>
                            </div>
                            
                            {clockInTime && (
                              wfhRequest.report_submitted_at ? (
                                <div className="p-3 bg-emerald-950/40 rounded-xl border border-dashed border-emerald-500/30 text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                                  <Check size={12} className="text-emerald-400" /> Daily Report Hari Ini Sudah Dikirim
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <p className="text-gray-300 text-[11px] leading-normal">Anda telah melakukan absen masuk hari ini. Silakan kirim Laporan Kerja (Daily Report) sebelum menyelesaikan hari kerja.</p>
                                  <button
                                    onClick={() => {
                                      setReportContent("");
                                      setReportAttachments([]);
                                      setReportErrorMsg("");
                                      setReportModalOpen(true);
                                    }}
                                    className="w-full py-3 rounded-xl bg-white hover:bg-slate-100 text-[#1C3D3F] font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
                                  >
                                    <FileText size={14} /> Kirim Daily Report WFH
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        )}
 
                        {/* 4. Jika pengajuan REJECTED */}
                        {wfhRequest && wfhRequest.status === "REJECTED" && !clockInTime && !clockOutTime && (
                          <div className="bg-slate-50 border border-gray-150 rounded-2xl p-3.5 flex flex-col gap-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status Remote Working</p>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-red-600 text-white uppercase tracking-wider self-start">
                              <X size={10} /> Pengajuan Ditolak
                            </span>
                            <p className="text-gray-500 text-[11px] leading-normal mt-1">Pengajuan kerja remote ditolak atasan. Harap melakukan absensi secara normal di area kantor.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Copyright */}
          <p className="text-[10px] text-gray-400 text-center py-4 select-none flex-shrink-0 mt-auto">
            © 2026 sampulkreativ · sampulkreativ.app · All rights reserved
          </p>
        </div>
      )}

      {activeTab === "pkl" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden pt-0">

          {/* PKL Student Dashboard Section */}
          {isStudent && (
            <div className="flex-1 flex flex-col min-h-0">
              {studentDashboard.isLoading ? (
                <div className="space-y-4 flex-grow">
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : studentDashboard.isError ? (
                <div className="bg-white rounded-[20px] p-6 border border-slate-150 shadow-3xs flex flex-col items-center justify-center text-center">
                  <ErrorState
                    onRetry={studentDashboard.refetch}
                    message={(studentDashboard.error as any)?.error?.message || "Gagal memuat dashboard aktivitas siswa."}
                  />
                </div>
              ) : studentDashboard.data ? (
                <StudentDashboardView
                  data={studentDashboard.data}
                  toggleTask={studentDashboard.toggleTask}
                  isToggling={studentDashboard.isToggling}
                  embedded={true}
                />
              ) : null}
            </div>
          )}
        </div>
      )}

      {activeTab === "payroll" && (
        <div className="flex-1 flex flex-col min-h-0 pt-0">

          {/* Content */}
          {loadingPayroll ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400 text-xs font-medium">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2AB0B2] border-t-transparent mb-2" />
              Memuat data slip gaji...
            </div>
          ) : payrollSlips.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-white border border-gray-150 rounded-3xl shadow-xs">
              <CreditCard size={32} className="text-slate-300 mb-2" />
              <p className="text-xs font-bold">{payrollError || "Belum ada riwayat slip gaji untuk akun Anda."}</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto pb-4 pr-1">
              {payrollSlips.map((slip) => (
                <div 
                  key={slip.id}
                  onClick={() => setSelectedSlip(slip)}
                  className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs hover:border-[#2AB0B2] transition-all duration-200 cursor-pointer flex items-center justify-between active:scale-[0.99]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#1C3D3F]">{slip.periode}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                        {slip.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-semibold">{slip.slip_no}</p>
                    <p className="text-[11px] text-slate-500 font-extrabold">{slip.jabatan}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 leading-none font-bold uppercase">Gaji Bersih</p>
                    <p className="text-sm font-black text-[#2AB0B2] mt-1">{formatRupiah(slip.gaji_bersih)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "kie" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pt-4 px-4 pb-8">
          <KieSubmissionView onBack={() => navigateToTab("menu")} />
        </div>
      )}

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 transition-opacity select-none animate-fadeIn">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 transition-opacity select-none animate-fadeIn">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 transition-opacity select-none animate-fadeIn">
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

      {/* Selected Payroll Slip Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 select-none animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl border border-slate-200 flex flex-col max-h-[85vh] text-[#1C3D3F]">
            {/* Header */}
            <div className="text-center pb-4 border-b border-dashed border-gray-150 flex-shrink-0">
              <h4 className="text-xs font-black text-[#2AB0B2] uppercase tracking-widest">SAMPUL KREATIV</h4>
              <p className="text-[10px] font-bold text-gray-400 mt-0.5">SLIP GAJI RESMI KARYAWAN</p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#1C3D3F] text-white">
                Periode: {selectedSlip.periode}
              </div>
            </div>

            {/* Info Karyawan */}
            <div className="py-3 grid grid-cols-2 gap-y-2 text-[11px] border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="text-gray-400 font-bold">NAMA KARYAWAN</p>
                <p className="font-extrabold text-slate-800 mt-0.5">{selectedSlip.nama_lengkap}</p>
              </div>
              <div>
                <p className="text-gray-400 font-bold">JABATAN</p>
                <p className="font-extrabold text-slate-800 mt-0.5">{selectedSlip.jabatan}</p>
              </div>
              <div>
                <p className="text-gray-400 font-bold">NOMOR SLIP</p>
                <p className="font-semibold text-slate-500 mt-0.5">{selectedSlip.slip_no}</p>
              </div>
              <div>
                <p className="text-gray-400 font-bold">TANGGAL CETAK</p>
                <p className="font-semibold text-slate-500 mt-0.5">
                  {selectedSlip.tanggal_cetak ? new Date(selectedSlip.tanggal_cetak).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                  }) : "-"}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 text-[11px] min-h-0">
              {/* Pendapatan */}
              <div>
                <h5 className="font-extrabold text-[#2AB0B2] mb-1.5 uppercase tracking-wider text-[10px]">Detail Pendapatan</h5>
                <div className="space-y-1.5 bg-slate-50/50 p-2.5 rounded-xl border border-gray-150/50">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gaji Pokok</span>
                    <span className="font-semibold text-slate-850">{formatRupiah(selectedSlip.gaji_pokok)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tunjangan Makan</span>
                    <span className="font-semibold text-slate-850">{formatRupiah(selectedSlip.tunjangan_makan)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tunjangan Transport</span>
                    <span className="font-semibold text-slate-850">{formatRupiah(selectedSlip.tunjangan_transport)}</span>
                  </div>
                  {selectedSlip.bonus > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bonus Kinerja</span>
                      <span className="font-semibold text-emerald-600">{formatRupiah(selectedSlip.bonus)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 border-t border-gray-150 font-bold text-slate-850">
                    <span>Total Pendapatan</span>
                    <span>{formatRupiah(selectedSlip.total_pendapatan)}</span>
                  </div>
                </div>
              </div>

              {/* Potongan */}
              <div>
                <h5 className="font-extrabold text-rose-500 mb-1.5 uppercase tracking-wider text-[10px]">Detail Potongan</h5>
                <div className="space-y-1.5 bg-slate-50/50 p-2.5 rounded-xl border border-gray-150/50">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Potongan Sakit</span>
                    <span className="font-semibold text-slate-850">{formatRupiah(selectedSlip.potongan_sakit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Potongan Izin</span>
                    <span className="font-semibold text-slate-850">{formatRupiah(selectedSlip.potongan_izin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Potongan Mangkir (Alpha)</span>
                    <span className="font-semibold text-slate-850">{formatRupiah(selectedSlip.potongan_alpha)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-gray-150 font-bold text-slate-850">
                    <span>Total Potongan</span>
                    <span className="text-rose-500">-{formatRupiah(selectedSlip.total_potongan)}</span>
                  </div>
                </div>
              </div>

              {/* Kehadiran Ringkas */}
              <div>
                <h5 className="font-extrabold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">Ringkasan Kehadiran</h5>
                <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-bold">
                  <div className="bg-slate-50 border border-gray-150 p-1.5 rounded-lg">
                    <p className="text-gray-400 text-[8px] uppercase">Kantor</p>
                    <p className="text-[#1C3D3F] mt-0.5">{selectedSlip.hari_kantor}H</p>
                  </div>
                  <div className="bg-slate-50 border border-gray-150 p-1.5 rounded-lg">
                    <p className="text-gray-400 text-[8px] uppercase">WFH</p>
                    <p className="text-[#1C3D3F] mt-0.5">{selectedSlip.hari_remote}H</p>
                  </div>
                  <div className="bg-slate-50 border border-gray-150 p-1.5 rounded-lg">
                    <p className="text-gray-400 text-[8px] uppercase">Sakit</p>
                    <p className="text-rose-600 mt-0.5">{selectedSlip.hari_sakit}H</p>
                  </div>
                  <div className="bg-slate-50 border border-gray-150 p-1.5 rounded-lg">
                    <p className="text-gray-400 text-[8px] uppercase">Izin</p>
                    <p className="text-amber-600 mt-0.5">{selectedSlip.hari_izin}H</p>
                  </div>
                  <div className="bg-slate-50 border border-gray-150 p-1.5 rounded-lg">
                    <p className="text-gray-400 text-[8px] uppercase">Alpha</p>
                    <p className="text-red-500 mt-0.5">{selectedSlip.hari_alpha}H</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Gaji Bersih */}
            <div className="bg-[#1C3D3F] text-white p-4 rounded-2xl flex justify-between items-center shadow-xs mt-3 flex-shrink-0">
              <div>
                <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Gaji Bersih Diterima</p>
                <p className="text-base font-black text-[#2AB0B2] mt-0.5">{formatRupiah(selectedSlip.gaji_bersih)}</p>
              </div>
              <div className="text-right">
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-white uppercase tracking-wider">
                  {selectedSlip.status}
                </span>
              </div>
            </div>

            {/* Action */}
            <button
              onClick={() => setSelectedSlip(null)}
              className="mt-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center flex-shrink-0 active:scale-97"
            >
              Tutup Slip Gaji
            </button>
          </div>
        </div>
      )}

      {/* Toast Alert Notification */}
      {notification && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 bg-[#1C3D3F] text-white px-5 py-3 rounded-2xl shadow-lg text-xs font-bold whitespace-nowrap flex items-center gap-2 border border-[#2AB0B2]/30 animate-fadeIn">
          <span>{notification}</span>
        </div>
      )}

    </div>
  );
}

export default function UserHomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center font-sans">
        <p className="text-gray-400 font-semibold text-sm">Memuat Dashboard...</p>
      </div>
    }>
      <UserDashboardContent />
    </Suspense>
  );
}
