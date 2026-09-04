"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, ShieldCheck, ArrowLeft, MapPin, RefreshCw } from "lucide-react";
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

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

  // Koordinat GPS & Lokasi Kantor
  const [officeCoords, setOfficeCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [stationCoords, setStationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceFromOffice, setDistanceFromOffice] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isWithinOfficeRange, setIsWithinOfficeRange] = useState<boolean | null>(null);

  // Flag pembatas jarak kantor (Di-hide/bypass agar absensi stasiun admin tidak tergantung jarak lokasi)
  const ENABLE_STATION_LOCATION_LOCK = true;

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

  // 2. Ambil Koordinat Kantor dari Settings
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.office_latitude && data.office_longitude) {
          const lat = parseFloat(data.office_latitude.toString().replace(",", "."));
          const lng = parseFloat(data.office_longitude.toString().replace(",", "."));
          if (!isNaN(lat) && !isNaN(lng)) {
            setOfficeCoords({ lat, lng });
          }
        }
      })
      .catch((err) => console.error("Gagal memuat setting koordinat kantor:", err));
  }, []);

  // 3. Deteksi GPS Perangkat Stasiun
  const checkGeolocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Perangkat/browser ini tidak mendukung sensor GPS.");
      setGpsLoading(false);
      setIsWithinOfficeRange(false);
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setStationCoords({ lat, lng });
        setGpsLoading(false);
        setGpsError(null);

        if (officeCoords) {
          const dist = calculateDistance(lat, lng, officeCoords.lat, officeCoords.lng);
          setDistanceFromOffice(Math.round(dist));
          setIsWithinOfficeRange(dist <= 30);
        } else {
          setIsWithinOfficeRange(true);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError("Akses GPS ditolak. Izin lokasi wajib diaktifkan agar stasiun absen dapat memvalidasi posisi kantor.");
        } else {
          setGpsError("Gagal mendapatkan sinyal GPS. Pastikan sensor lokasi perangkat aktif.");
        }
        setIsWithinOfficeRange(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    checkGeolocation();

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setStationCoords({ lat, lng });
          setGpsLoading(false);
          setGpsError(null);

          if (officeCoords) {
            const dist = calculateDistance(lat, lng, officeCoords.lat, officeCoords.lng);
            setDistanceFromOffice(Math.round(dist));
            setIsWithinOfficeRange(dist <= 30);
          }
        },
        (err) => {
          console.warn("GPS watch warning:", err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [officeCoords]);

  // 4. Loop jam & tanggal stasiun (WIB)
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

  // 5. Tangani hasil pindai QR
  const handleScanSuccess = async (token: string) => {
    if (ENABLE_STATION_LOCATION_LOCK && officeCoords && isWithinOfficeRange === false) {
      setErrorMessage(
        distanceFromOffice !== null
          ? `Perangkat stasiun berada di luar kantor (${distanceFromOffice}m). Maksimal 30 meter.`
          : "Perangkat stasiun berada di luar jangkauan kantor."
      );
      setCurrentState("WARNING");
      return;
    }

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

  // 6. Tangani capture selfie & submit check-in
  const handleCaptureSelfie = async (base64Image: string) => {
    if (ENABLE_STATION_LOCATION_LOCK && officeCoords && isWithinOfficeRange === false) {
      setErrorMessage(
        distanceFromOffice !== null
          ? `Perangkat stasiun berada di luar jangkauan kantor (${distanceFromOffice} meter). Maksimal 30 meter.`
          : "Perangkat stasiun berada di luar jangkauan kantor."
      );
      setCurrentState("WARNING");
      return;
    }

    if (ENABLE_STATION_LOCATION_LOCK && officeCoords && !stationCoords) {
      setErrorMessage("Sinyal GPS belum terkunci. Mohon tunggu hingga lokasi kantor terdeteksi.");
      setCurrentState("WARNING");
      return;
    }

    setCurrentState("SUBMITTING");
    try {
      const response = await fetch("/api/attendance/station/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: scannedToken,
          foto_base64: base64Image,
          status: nextStatus,
          latitude: stationCoords?.lat ?? null,
          longitude: stationCoords?.lng ?? null,
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

  // 7. Tangani penolakan/peringatan agar kembali ke mode scan setelah 3.5 detik
  useEffect(() => {
    if (currentState === "WARNING") {
      const timer = setTimeout(() => {
        setCurrentState("SCANNING");
        setErrorMessage(null);
        setCurrentUser(null);
      }, 3500);
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
        {currentState === "SCANNING" || currentState === "VERIFYING" ? (
          <QrScannerView
            onScanSuccess={handleScanSuccess}
            scanError={cameraError}
            setScanError={setCameraError}
            isActive={currentState === "SCANNING" && (!ENABLE_STATION_LOCATION_LOCK || (isWithinOfficeRange !== false && !gpsError))}
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

      {/* 2. Floating Header Widgets (Logo Brand, Kembali ke Admin, Status GPS) */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2 pointer-events-auto">
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

        {/* Status GPS Kantor (Di-hide agar tidak tampil di stasiun admin) */}
        {ENABLE_STATION_LOCATION_LOCK && (
        <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl shadow-xl">
          <MapPin
            size={15}
            className={`flex-shrink-0 ${
              isWithinOfficeRange === true
                ? "text-emerald-400 animate-pulse"
                : isWithinOfficeRange === false
                ? "text-rose-500"
                : "text-amber-400 animate-bounce"
            }`}
          />
          <div className="flex flex-col">
            <span
              className={`text-[9px] font-black tracking-wider uppercase leading-none ${
                isWithinOfficeRange === true
                  ? "text-emerald-400"
                  : isWithinOfficeRange === false
                  ? "text-rose-400"
                  : "text-amber-400"
              }`}
            >
              {gpsLoading
                ? "Mencari GPS..."
                : isWithinOfficeRange === true
                ? "Lokasi Kantor Valid"
                : "Di Luar Kantor"}
            </span>
            <span className="text-[8px] font-bold text-slate-400 mt-0.5 leading-none">
              {distanceFromOffice !== null
                ? `${distanceFromOffice}m dari kantor (Maks 30m)`
                : gpsError
                ? "GPS Nonaktif"
                : "Menghubungkan satelit..."}
            </span>
          </div>
        </div>
        )}
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

      {/* 4. GPS Blocking Overlay jika di luar jangkauan atau GPS dinonaktifkan (Di-hide) */}
      {ENABLE_STATION_LOCATION_LOCK && (isWithinOfficeRange === false || gpsError) && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-35 flex flex-col items-center justify-center p-6 text-center">
          <div className="p-8 bg-slate-900/95 rounded-3xl border border-rose-500/30 shadow-2xl flex flex-col items-center max-w-sm w-full mx-auto animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-500 mb-4">
              <MapPin size={32} />
            </div>
            <h3 className="text-base font-black text-white mb-2">Stasiun Di Luar Jangkauan Kantor</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              {gpsError
                ? gpsError
                : `Perangkat stasiun terdeteksi berjarak ${distanceFromOffice} meter dari kantor. Stasiun absensi hanya dapat dioperasikan di area kantor resmi Sampul Kreativ (radius maksimal 30 meter).`}
            </p>
            <button
              onClick={checkGeolocation}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#2AB0B2] hover:bg-[#209092] text-white text-xs font-bold rounded-xl transition-all shadow-lg active:scale-95"
            >
              <RefreshCw size={14} className={gpsLoading ? "animate-spin" : ""} />
              <span>Coba Deteksi Ulang GPS</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Modal Overlays for State Transitions */}
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
            <p className="text-xs text-slate-400">Menyimpan koordinat kantor & foto selfie</p>
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
