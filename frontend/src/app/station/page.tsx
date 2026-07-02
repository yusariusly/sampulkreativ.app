"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import QrScannerView from "./components/QrScannerView";
import SelfieCaptureView from "./components/SelfieCaptureView";
import SuccessView from "./components/SuccessView";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";

type StationState = "SCANNING" | "VERIFYING" | "SELFIE" | "SUBMITTING" | "SUCCESS" | "WARNING";

interface UserInfo {
  id: string;
  username: string;
  nama_lengkap: string;
  role: string;
}

export default function StationPage() {
  const router = useRouter();
  const { speak } = useSpeechSynthesis();

  // State Manajemen Halaman
  const [currentState, setCurrentState] = useState<StationState>("SCANNING");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [scannedToken, setScannedToken] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [nextStatus, setNextStatus] = useState<"Hadir" | "Terlambat" | "Pulang">("Hadir");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Jam & Hari Stasiun (WIB)
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  // 1. Validasi Sesi Admin pada Mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) {
        router.push("/login");
        return;
      }
      const userObj = JSON.parse(storedUser);
      if (userObj.role !== "admin" && userObj.role !== "mentor") {
        router.push("/user"); // Karyawan biasa dilempar ke dashboard user
        return;
      }
      setIsAdmin(true);
    }
  }, [router]);

  // 2. Loop jam & tanggal stasiun (WIB)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(now);
      setCurrentTime(timeStr + " WIB");

      const dateStr = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(now);
      setCurrentDate(dateStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 3. Tangani hasil pindai QR
  const handleScanSuccess = async (token: string) => {
    setScannedToken(token);
    setCurrentState("VERIFYING");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/attendance/station/verify?token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Gagal memverifikasi kartu karyawan.");
        setCurrentState("WARNING");
        return;
      }

      setCurrentUser(data.user);
      setNextStatus(data.next_status);
      setCurrentState("SELFIE");
    } catch (err) {
      console.error("Gagal verifikasi stasiun:", err);
      setErrorMessage("Terjadi kesalahan koneksi saat memverifikasi kartu.");
      setCurrentState("WARNING");
    }
  };

  // 4. Tangani capture selfie & submit check-in
  const handleCaptureSelfie = async (base64Image: string) => {
    setCurrentState("SUBMITTING");
    try {
      const response = await fetch("/api/attendance/station/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: scannedToken,
          foto_base64: base64Image,
          status: nextStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Gagal mencatat absensi.");
        setCurrentState("WARNING");
        return;
      }

      // Mainkan suara konfirmasi selamat
      if (currentUser) {
        speak(`Terima kasih, ${currentUser.nama_lengkap}. Absensi Anda berhasil!`);
      }

      // Kembali ke mode scanning secara instan agar antrean cepat
      setCurrentState("SCANNING");
      setCurrentUser(null);
      setScannedToken("");
    } catch (err) {
      console.error("Gagal submit absensi stasiun:", err);
      setErrorMessage("Terjadi kesalahan jaringan saat mengirim absensi.");
      setCurrentState("WARNING");
    }
  };

  // 5. Tangani penolakan/peringatan agar kembali ke mode scan setelah 3 detik
  useEffect(() => {
    if (currentState === "WARNING") {
      const timer = setTimeout(() => {
        setCurrentState("SCANNING");
        setErrorMessage(null);
        setCurrentUser(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentState]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-400 gap-2">
        <Loader2 className="animate-spin text-[#2AB0B2]" size={32} />
        <span className="text-xs font-semibold">Memeriksa hak akses stasiun...</span>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative bg-slate-950 overflow-hidden text-white flex items-center justify-center">
      {/* 1. Camera Feeds (Full Screen Background) */}
      <div className="absolute inset-0 w-full h-full z-0">
        {/* Render Scanner ketika scanning, atau render selfie ketika butuh foto */}
        {currentState === "SCANNING" || currentState === "VERIFYING" ? (
          <QrScannerView
            onScanSuccess={handleScanSuccess}
            scanError={cameraError}
            setScanError={setCameraError}
            isActive={currentState === "SCANNING"}
          />
        ) : (
          currentUser && (
            <SelfieCaptureView
              user={currentUser}
              nextStatus={nextStatus}
              onCapture={handleCaptureSelfie}
              onCancel={() => {
                setCurrentState("SCANNING");
                setCurrentUser(null);
              }}
            />
          )
        )}
      </div>

      {/* 2. Floating Header Widgets (Logo Brand & Kembali ke Admin) */}
      <div className="absolute top-4 left-4 z-20 flex gap-2 pointer-events-auto">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-800 shadow-xl">
          <ShieldCheck size={18} className="text-[#2AB0B2] flex-shrink-0" />
          <div className="hidden sm:block">
            <h1 className="text-[10px] font-black tracking-wider text-white uppercase leading-none">STASIUN</h1>
            <p className="text-[8px] text-[#2AB0B2] font-semibold uppercase tracking-widest mt-0.5">SAMPULKREATIV</p>
          </div>
        </div>

        <button
          onClick={() => router.push("/admin")}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs text-slate-400 hover:text-white bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl transition-all shadow-xl font-bold active:scale-95"
        >
          <ArrowLeft size={13} />
          <span>Dashboard</span>
        </button>
      </div>

      {/* 3. Floating Date & Time Clock Widget (Top Right) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 shadow-xl text-right">
        <span className="text-base sm:text-lg font-mono font-black text-white tracking-widest leading-none">
          {currentTime.replace(" WIB", "")}
        </span>
        <span className="text-[9px] text-[#2AB0B2] font-bold uppercase tracking-wider mt-1">
          {currentDate}
        </span>
      </div>

      {/* 4. Modal Overlays for State Transitions */}
      {/* A. Verifying State */}
      {currentState === "VERIFYING" && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
          <div className="p-8 bg-slate-900/95 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center max-w-xs w-full mx-auto animate-scale-in">
            <Loader2 className="animate-spin text-[#2AB0B2] mb-4" size={44} />
            <h4 className="text-sm font-bold text-white mb-1">Mencocokkan Kartu...</h4>
            <p className="text-xs text-slate-400">Menghubungi server absensi aman</p>
          </div>
        </div>
      )}

      {/* B. Submitting State */}
      {currentState === "SUBMITTING" && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
          <div className="p-8 bg-slate-900/95 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center max-w-xs w-full mx-auto animate-scale-in">
            <Loader2 className="animate-spin text-[#2AB0B2] mb-4" size={44} />
            <h4 className="text-sm font-bold text-white mb-1">Mencatat Absensi...</h4>
            <p className="text-xs text-slate-400">Mengunggah foto dan mengirim laporan</p>
          </div>
        </div>
      )}

      {/* C. Success State */}
      {currentState === "SUCCESS" && currentUser && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6">
          <SuccessView
            userName={currentUser.nama_lengkap}
            status={nextStatus}
            onFinish={() => {
              setCurrentState("SCANNING");
              setCurrentUser(null);
            }}
          />
        </div>
      )}

      {/* D. Warning/Rejected State */}
      {currentState === "WARNING" && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
          <div className="p-8 bg-slate-900/95 rounded-3xl border border-slate-850 shadow-2xl flex flex-col items-center max-w-sm w-full mx-auto animate-scale-in">
            <AlertCircle className="text-rose-500 mb-4 animate-bounce" size={50} />
            <h4 className="text-base font-black text-white mb-2">Absensi Ditolak</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{errorMessage}</p>
            <div className="w-12 h-1 bg-rose-500/20 rounded-full mt-6" />
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-2.5">
              Kembali ke pemindaian otomatis...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
