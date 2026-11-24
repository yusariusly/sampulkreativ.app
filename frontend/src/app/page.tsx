"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Shield, QrCode, AlertCircle, CheckCircle2, RefreshCw, KeyRound, X, Send, AlertTriangle, Check } from "lucide-react";
import jsQR from "jsqr";

function AppLogo({ size = 80 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt="Logo"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="object-contain"
    />
  );
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "";

  try {
    const existing = localStorage.getItem("v2_device_id");
    if (existing) return existing;
  } catch (e) {
    // localStorage not accessible
  }
  
  const screenSpec = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}`;
  const userAgent = navigator.userAgent || "";
  const language = navigator.language || "";
  
  let canvasHash = "";
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      canvas.width = 200;
      canvas.height = 40;
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(100, 5, 50, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("Absensi_SK_FP_v2", 2, 10);
      ctx.fillStyle = "rgba(102, 204, 0, 0.6)";
      ctx.fillText("Absensi_SK_FP_v2", 4, 12);
      const dataUrl = canvas.toDataURL();
      let hash = 0;
      for (let i = 0; i < dataUrl.length; i++) {
        hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
        hash |= 0;
      }
      canvasHash = Math.abs(hash).toString(36);
    }
  } catch (e) {
    canvasHash = "canvas-err";
  }

  let webglHash = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        webglHash = `${vendor}_${renderer}`;
      }
    }
  } catch (e) {
    webglHash = "webgl-err";
  }

  const rawSignature = `${screenSpec}|${userAgent}|${language}|${canvasHash}|${webglHash}`;
  let finalHash = 0;
  for (let i = 0; i < rawSignature.length; i++) {
    finalHash = (finalHash << 5) - finalHash + rawSignature.charCodeAt(i);
    finalHash |= 0;
  }
  
  const fingerprint = "hw-" + Math.abs(finalHash).toString(36);
  try {
    localStorage.setItem("v2_device_id", fingerprint);
  } catch (e) {}
  return fingerprint;
}

function getDeviceInfo() {
  if (typeof window === "undefined") return "Unknown Device";
  const ua = navigator.userAgent;
  let deviceName = "Perangkat Tidak Dikenal";
  if (/android/i.test(ua)) {
    const matches = ua.match(/Android\s+[^;]+;\s+([^;)]+)/);
    if (matches && matches[1]) {
      deviceName = `Android (${matches[1].trim()})`;
    } else {
      deviceName = "Android Device";
    }
  } else if (/iPad|iPhone|iPod/.test(ua)) {
    deviceName = "Apple iPhone/iPad";
  } else if (/Macintosh/.test(ua)) {
    deviceName = "Mac OS";
  } else if (/Windows/.test(ua)) {
    deviceName = "Windows PC";
  } else if (/Linux/.test(ua)) {
    deviceName = "Linux PC";
  }
  return deviceName;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"qr-scan" | "admin-login">("qr-scan");
  const [isCheckingDevice, setIsCheckingDevice] = useState(true);

  // QR Scanner
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "error">("idle");
  const [scanMessage, setScanMessage] = useState("");

  // Admin States
  const [adminUser, setAdminUser] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Admin Reset Credentials Modal States (via Email OTP)
  const [showAdminResetModal, setShowAdminResetModal] = useState(false);
  const [adminResetStep, setAdminResetStep] = useState<"REQUEST" | "VERIFY">("REQUEST");
  const [adminResetOtp, setAdminResetOtp] = useState("");
  const [adminResetNewUser, setAdminResetNewUser] = useState("");
  const [adminResetNewPw, setAdminResetNewPw] = useState("");
  const [adminResetConfirmPw, setAdminResetConfirmPw] = useState("");
  const [showAdminResetNewPw, setShowAdminResetNewPw] = useState(false);
  const [adminResetLoading, setAdminResetLoading] = useState(false);
  const [adminResetMaskedEmail, setAdminResetMaskedEmail] = useState("");
  const [adminResetError, setAdminResetError] = useState<string | null>(null);
  const [adminResetSuccess, setAdminResetSuccess] = useState<string | null>(null);

  const handleOpenResetAdminModal = () => {
    setShowAdminResetModal(true);
    setAdminResetStep("REQUEST");
    setAdminResetOtp("");
    setAdminResetNewUser(adminUser || "admin");
    setAdminResetNewPw("");
    setAdminResetConfirmPw("");
    setShowAdminResetNewPw(false);
    setAdminResetError(null);
    setAdminResetSuccess(null);
  };

  const handleRequestAdminOtp = async () => {
    setAdminResetLoading(true);
    setAdminResetError(null);
    setAdminResetSuccess(null);
    try {
      const res = await fetch("/api/admin/auth/request-otp", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setAdminResetMaskedEmail(data.email || "email HRD/Admin di pengaturan");
        setAdminResetStep("VERIFY");
        setAdminResetSuccess("Kode OTP berhasil dikirimkan ke email!");
      } else {
        setAdminResetError(data.error || "Gagal mengirimkan kode OTP.");
      }
    } catch (err) {
      setAdminResetError("Terjadi kesalahan koneksi saat meminta kode OTP.");
    } finally {
      setAdminResetLoading(false);
    }
  };

  const handleSubmitAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminResetError(null);
    setAdminResetSuccess(null);

    if (!adminResetOtp.trim() || adminResetOtp.trim().length !== 6) {
      setAdminResetError("Kode OTP 6-digit wajib diisi dengan benar.");
      return;
    }
    if (!adminResetNewUser.trim() && !adminResetNewPw.trim()) {
      setAdminResetError("Harap masukkan username baru atau password baru.");
      return;
    }
    if (adminResetNewPw && adminResetNewPw.trim().length < 4) {
      setAdminResetError("Password baru minimal 4 karakter.");
      return;
    }
    if (adminResetNewPw && adminResetNewPw !== adminResetConfirmPw) {
      setAdminResetError("Konfirmasi password baru tidak cocok.");
      return;
    }

    setAdminResetLoading(true);
    try {
      const res = await fetch("/api/admin/auth/update-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp: adminResetOtp.trim(),
          new_username: adminResetNewUser.trim() || undefined,
          new_password: adminResetNewPw.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.new_username) {
          setAdminUser(data.new_username);
        }
        if (adminResetNewPw.trim()) {
          setAdminPw(adminResetNewPw.trim());
        }
        setShowAdminResetModal(false);
        setError("");
        alert("✅ Kredensial Administrator berhasil diperbarui! Silakan klik 'Masuk sebagai Admin'.");
      } else {
        setAdminResetError(data.error || "Gagal memperbarui kredensial admin.");
      }
    } catch (err) {
      setAdminResetError("Terjadi kesalahan jaringan.");
    } finally {
      setAdminResetLoading(false);
    }
  };

  // Check existing session on mount
  useEffect(() => {
    let active = true;

    // Safety timeout: ensure the loading screen never hangs indefinitely
    const safetyTimeout = setTimeout(() => {
      if (active) {
        setIsCheckingDevice(false);
      }
    }, 2500);

    const checkDeviceBinding = async () => {
      if (typeof window === "undefined") return;

      let deviceId = "";
      try {
        deviceId = getOrCreateDeviceId();
      } catch (e) {
        console.error("Gagal mendapatkan device ID:", e);
      }
      
      const stored = localStorage.getItem("v2_user");

      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (token) {
        sessionStorage.setItem("v2_scanned_token", token);
      }

      // If user directly requested admin login
      if (params.get("admin") === "true") {
        setMode("admin-login");
        clearTimeout(safetyTimeout);
        setIsCheckingDevice(false);
        return;
      }

      try {
        const controller = new AbortController();
        const fetchTimer = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`/api/auth/check-device?device_id=${encodeURIComponent(deviceId)}`, {
          signal: controller.signal
        });
        clearTimeout(fetchTimer);
        const data = await response.json();

        if (active) {
          if (response.ok && data.registered) {
            localStorage.setItem("v2_user", JSON.stringify(data.user));
            if (data.user.role === "admin") {
              clearTimeout(safetyTimeout);
              router.replace("/admin");
              return;
            }
            if (data.user.is_active === 1) {
              const activeToken = token || sessionStorage.getItem("v2_scanned_token");
              if (activeToken) {
                try {
                  const attnRes = await fetch(`/api/attendance?user_id=${data.user.id}`);
                  if (attnRes.ok) {
                    const logs = await attnRes.json();
                    const todayJakarta = new Intl.DateTimeFormat('en-CA', {
                      timeZone: 'Asia/Jakarta',
                      year: 'numeric', month: '2-digit', day: '2-digit'
                    }).format(new Date());
                    const todayLogs = logs.filter(
                      (log: any) => (log.waktu_absen || '').slice(0, 10) === todayJakarta
                    );
                    const hasClockedOut = todayLogs.some((log: any) => log.status === "Pulang");
                    const hasClockedIn = todayLogs.some((log: any) => log.status === "Hadir" || log.status === "Terlambat");
                    const hasIzinSakit = todayLogs.some((log: any) => log.status === "Izin" || log.status === "Sakit");
                    if (hasIzinSakit || hasClockedOut) {
                      clearTimeout(safetyTimeout);
                      router.replace("/user");
                      return;
                    } else if (hasClockedIn) {
                      localStorage.setItem("v2_clockInDate", new Date().toDateString());
                      sessionStorage.setItem("v2_absen_type", "pulang");
                      clearTimeout(safetyTimeout);
                      router.replace("/user/selfie");
                      return;
                    } else {
                      sessionStorage.setItem("v2_absen_type", "masuk");
                      clearTimeout(safetyTimeout);
                      router.replace("/user/selfie");
                      return;
                    }
                  }
                } catch (e) {
                  console.error("Gagal memeriksa status absensi:", e);
                }
              }
              clearTimeout(safetyTimeout);
              router.replace("/user");
              return;
            }
          }
        }
      } catch (err) {
        console.error("Gagal mencocokkan perangkat secara online:", err);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.role === "admin") {
              clearTimeout(safetyTimeout);
              router.replace("/admin");
              return;
            }
            if (parsed.is_active === 1) {
              clearTimeout(safetyTimeout);
              router.replace("/user");
              return;
            }
          } catch (e) {}
        }
      }

      if (active) {
        clearTimeout(safetyTimeout);
        setIsCheckingDevice(false);
      }
    };

    checkDeviceBinding();
    return () => {
      active = false;
      clearTimeout(safetyTimeout);
    };
  }, [router]);

  // Camera management
  const stopCamera = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      setCameraLoading(true);
      setCameraError(null);
      setScanning(true);
      setScanStatus("idle");

      if (typeof window !== "undefined" && !window.isSecureContext) {
        setCameraError("Kamera diblokir karena koneksi tidak aman (HTTP). Gunakan HTTPS.");
        setCameraLoading(false);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Kamera tidak didukung browser Anda atau diblokir karena HTTP.");
        setCameraLoading(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      activeStreamRef.current = stream;

      // Detect if front camera is being used (e.g. laptop falls back to front cam)
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings();
      const facing = settings?.facingMode;
      // If facingMode is explicitly 'user' OR not available (common on laptops with only front cam), treat as front
      setIsFrontCamera(facing === 'user' || !facing);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }
      setCameraLoading(false);
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setCameraError("Gagal mengakses kamera. Pastikan izin kamera diizinkan untuk situs ini.");
      setCameraLoading(false);
    }
  };

  // Start / stop camera with mode
  useEffect(() => {
    if (!isCheckingDevice && mode === "qr-scan") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isCheckingDevice]);

  // QR scan loop
  useEffect(() => {
    if (!scanning || cameraLoading || mode !== "qr-scan") return;

    let timeoutId: any;

    const scanLoop = () => {
      if (!scanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          const maxDim = 480;
          let scanWidth = video.videoWidth;
          let scanHeight = video.videoHeight;
          if (scanWidth > maxDim) {
            scanHeight = Math.round((video.videoHeight / video.videoWidth) * maxDim);
            scanWidth = maxDim;
          }
          canvas.width = scanWidth;
          canvas.height = scanHeight;
          ctx.drawImage(video, 0, 0, scanWidth, scanHeight);

          const imageData = ctx.getImageData(0, 0, scanWidth, scanHeight);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code) {
            const scannedData = code.data.trim();
            let token = scannedData;

            // Extract token from URL format: /station?token=<token>
            try {
              if (scannedData.startsWith("http://") || scannedData.startsWith("https://")) {
                const urlObj = new URL(scannedData);
                const tokenParam = urlObj.searchParams.get("token");
                if (tokenParam) token = tokenParam.trim();
              }
            } catch (e) {
              console.error("Gagal parse URL QR:", e);
            }

            // Attempt QR login
            setScanning(false);
            stopCamera();
            handleQRLogin(token);
            return;
          }
        }
      }
      timeoutId = setTimeout(scanLoop, 150);
    };

    timeoutId = setTimeout(scanLoop, 150);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, cameraLoading, mode]);

  const handleQRLogin = async (token: string) => {
    setScanStatus("idle");
    setScanMessage("Memverifikasi QR...");
    setLoading(true);

    try {
      const deviceId = getOrCreateDeviceId();
      const deviceInfo = getDeviceInfo();

      const response = await fetch("/api/auth/qr-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, device_id: deviceId, device_info: deviceInfo }),
      });

      const data = await response.json();

      if (!response.ok) {
        setScanStatus("error");
        setScanMessage(data.error || "QR Code tidak valid");
        setLoading(false);
        // Restart camera after 2.5s
        setTimeout(() => {
          setScanStatus("idle");
          setScanMessage("");
          setScanning(true);
          startCamera();
        }, 2500);
        return;
      }

      localStorage.setItem("v2_user", JSON.stringify(data));
      setScanStatus("success");
      setScanMessage(`Selamat datang, ${data.nama_lengkap}!`);

      if (navigator.vibrate) navigator.vibrate(200);

      setTimeout(() => {
        if (data.is_active === 1) {
          router.push("/user");
        }
      }, 1200);
    } catch (err) {
      setScanStatus("error");
      setScanMessage("Terjadi kesalahan koneksi internet");
      setLoading(false);
      setTimeout(() => {
        setScanStatus("idle");
        setScanMessage("");
        setScanning(true);
        startCamera();
      }, 2500);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!adminUser.trim() || !adminPw.trim()) {
      setError("Username dan password wajib diisi");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: adminUser.trim(), password: adminPw }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Gagal login admin");
        setLoading(false);
        return;
      }

      localStorage.setItem("v2_user", JSON.stringify(data));
      router.push("/admin");
    } catch (err) {
      setError("Terjadi kesalahan koneksi internet");
      setLoading(false);
    }
  };

  // Loading screen — checking device
  if (isCheckingDevice) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#1C3D3F] via-[#2AB0B2] to-[#209092] flex flex-col items-center justify-center text-white p-6 relative">
        <div className="flex flex-col items-center max-w-sm text-center space-y-6 animate-fade-in">
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/20 shadow-xl animate-pulse">
            <AppLogo size={80} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-wide animate-pulse">Mencocokkan Perangkat...</h2>
            <p className="text-xs text-white/70">Sistem sedang memverifikasi HP Anda secara aman.</p>
          </div>
          <div className="flex items-center gap-1.5 pt-2">
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#F6C13B] animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" />
          </div>

          {/* Quick bypass buttons so users or admins are never stuck */}
          <div className="flex flex-col gap-2 pt-6 w-full max-w-xs">
            <button
              type="button"
              onClick={() => setIsCheckingDevice(false)}
              className="w-full text-xs text-white/90 hover:text-white py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all font-medium border border-white/20 cursor-pointer shadow-sm active:scale-95"
            >
              Lewati ke Scan Kartu
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("admin-login");
                setIsCheckingDevice(false);
              }}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-white/60 hover:text-[#F6C13B] py-2 transition-colors cursor-pointer"
            >
              <Shield size={13} />
              Masuk sebagai Administrator
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full flex bg-[#0A1A1B]">

      {/* Left branding panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1C3D3F] via-[#2AB0B2] to-[#209092] p-12 text-white flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full filter blur-3xl -mr-64 -mt-64 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#F6C13B]/10 rounded-full filter blur-3xl -ml-48 -mb-48 pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20">
            <AppLogo size={48} />
          </div>
          <div>
            <h2 className="font-bold text-lg tracking-wide">sampulkreativ.app</h2>
            <p className="text-[10px] text-white/60 tracking-widest uppercase mt-0.5">by sampulkreativ</p>
          </div>
        </div>

        <div className="my-auto max-w-md space-y-6 relative z-10">
          <h1 className="text-4xl font-extrabold leading-tight">
            Satu Aplikasi untuk Semua <span className="text-[#F6C13B]">Kebutuhan Internal</span>
          </h1>
          <p className="text-white/80 text-sm leading-relaxed">
            Portal internal terintegrasi dari SampulKreativ. Cukup daftarkan perangkat Anda sekali untuk mengakses layanan absensi online, sistem payroll, dan program PKL secara aman dan praktis.
          </p>
          <div className="flex flex-col gap-3">
            {[
              "Absensi online dengan QR Code kartu karyawan",
              "Sistem payroll & laporan kehadiran terintegrasi",
              "Program PKL & monitoring siswa magang",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm text-white/90">
                <div className="w-5 h-5 rounded-full bg-[#F6C13B]/20 border border-[#F6C13B]/40 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F6C13B]" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-white/50 relative z-10 select-none">
          © 2026 sampulkreativ · sampulkreativ.app · All Rights Reserved.
        </div>
      </div>

      {/* Right Column: QR Scanner or Admin Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 relative bg-[#0A1A1B]">
        <div className="w-full max-w-[420px] flex flex-col items-center">

          {/* Mobile logo */}
          <div className="lg:hidden mb-6 flex flex-col items-center select-none">
            <AppLogo size={72} />
            <div className="text-[10px] font-bold text-white/40 mt-2 uppercase tracking-widest">by sampulkreativ</div>
          </div>

          {mode === "qr-scan" ? (
            <div className="w-full flex flex-col items-center">
              <div className="mb-5 text-center">
                <h1 className="text-2xl font-extrabold text-white mb-1">Scan Kartu Anda</h1>
                <p className="text-white/50 text-sm">Arahkan kamera ke QR Code yang ada di kartu karyawan</p>
              </div>

              {/* Camera viewfinder */}
              <div className="relative w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden border-2 border-[#2AB0B2]/40 shadow-2xl bg-black">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={isFrontCamera ? { transform: "scaleX(-1)" } : undefined}
                  autoPlay
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Scan frame corners */}
                {scanStatus === "idle" && !cameraError && !cameraLoading && (
                  <>
                    <div className="absolute top-4 left-4 w-8 h-8 border-t-3 border-l-3 border-[#2AB0B2] rounded-tl-lg" style={{ borderTopWidth: 3, borderLeftWidth: 3 }} />
                    <div className="absolute top-4 right-4 w-8 h-8 border-t-3 border-r-3 border-[#2AB0B2] rounded-tr-lg" style={{ borderTopWidth: 3, borderRightWidth: 3 }} />
                    <div className="absolute bottom-4 left-4 w-8 h-8 border-b-3 border-l-3 border-[#2AB0B2] rounded-bl-lg" style={{ borderBottomWidth: 3, borderLeftWidth: 3 }} />
                    <div className="absolute bottom-4 right-4 w-8 h-8 border-b-3 border-r-3 border-[#2AB0B2] rounded-br-lg" style={{ borderBottomWidth: 3, borderRightWidth: 3 }} />
                    
                  </>
                )}

                {/* Loading camera */}
                {cameraLoading && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                    <div className="w-10 h-10 border-2 border-[#2AB0B2] border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-xs text-white/70">Memuat kamera...</p>
                  </div>
                )}

                {/* Camera error */}
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white p-4 text-center">
                    <AlertCircle size={32} className="text-red-400 mb-2" />
                    <p className="text-xs text-white/80 leading-relaxed">{cameraError}</p>
                    <button
                      onClick={() => startCamera()}
                      className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-[#2AB0B2] hover:bg-[#209092] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                    >
                      <RefreshCw size={12} /> Coba Lagi
                    </button>
                  </div>
                )}

                {/* Scan success overlay */}
                {scanStatus === "success" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1C3D3F]/95 text-white">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mb-3">
                      <CheckCircle2 size={32} className="text-green-400" />
                    </div>
                    <p className="text-sm font-bold text-green-300">{scanMessage}</p>
                    <p className="text-xs text-white/50 mt-1">Mengalihkan ke dashboard...</p>
                  </div>
                )}

                {/* Scan error overlay */}
                {scanStatus === "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 text-white p-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-3">
                      <AlertCircle size={28} className="text-red-400" />
                    </div>
                    <p className="text-sm font-bold text-red-300">QR Tidak Valid</p>
                    <p className="text-xs text-white/60 mt-1 leading-relaxed">{scanMessage}</p>
                    <p className="text-[10px] text-white/40 mt-2">Kamera akan restart otomatis...</p>
                  </div>
                )}

                {/* Processing overlay */}
                {loading && scanStatus === "idle" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                    <div className="w-10 h-10 border-2 border-[#F6C13B] border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-xs text-white/70">{scanMessage || "Memverifikasi..."}</p>
                  </div>
                )}
              </div>


              {/* Admin login link */}
              <button
                onClick={() => { setMode("admin-login"); setError(""); stopCamera(); }}
                className="mt-6 flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer"
              >
                <Shield size={11} />
                Masuk sebagai Administrator
              </button>
            </div>
          ) : (
            /* Admin Login Form */
            <div className="w-full">
              <div className="mb-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-3">
                  <Shield size={24} className="text-[#F6C13B]" />
                </div>
                <h1 className="text-2xl font-extrabold text-white mb-1">Administrator</h1>
                <p className="text-white/50 text-sm">Masukkan kredensial admin Anda</p>
              </div>

              {error && (
                <div className="w-full mb-4 p-3.5 bg-red-500/10 text-red-400 rounded-2xl text-xs font-semibold border border-red-500/20 text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="w-full space-y-4">
                <div>
                  <label className="block text-xs font-bold text-white/40 mb-2 uppercase tracking-wider pl-1">Username Admin</label>
                  <input
                    type="text"
                    placeholder="Masukkan username"
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl bg-white/5 border-2 border-white/10 focus:border-[#2AB0B2] outline-none text-white transition-colors placeholder:text-white/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/40 mb-2 uppercase tracking-wider pl-1">Password Admin</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="Masukkan password"
                      value={adminPw}
                      onChange={(e) => setAdminPw(e.target.value)}
                      className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-white/5 border-2 border-white/10 focus:border-[#2AB0B2] outline-none text-white transition-colors placeholder:text-white/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 cursor-pointer hover:text-white/60"
                    >
                      {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Link Ganti / Lupa Password Admin via Email OTP */}
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={handleOpenResetAdminModal}
                    className="text-xs text-[#2AB0B2] hover:text-[#52c8ca] font-semibold transition-colors cursor-pointer hover:underline"
                  >
                    Ganti Username / Password Admin via OTP?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 mt-2 rounded-2xl text-white font-bold text-base shadow-md active:scale-[0.98] transition-transform cursor-pointer flex items-center justify-center bg-[#2AB0B2] hover:bg-[#209092] disabled:opacity-50"
                >
                  {loading ? "Memproses..." : "Masuk sebagai Admin"}
                </button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode("qr-scan"); setError(""); }}
                    className="text-xs text-[#2AB0B2] hover:underline font-bold flex items-center gap-1 mx-auto cursor-pointer"
                  >
                    ← Kembali ke Scan QR
                  </button>
                </div>
              </form>
            </div>
          )}

          <p className="text-[11px] text-white/20 mt-8 text-center select-none">
            © 2026 sampulkreativ · sampulkreativ.app · All rights reserved
          </p>
        </div>
      </div>

      {/* Modal Alur Ganti Username / Password Admin via OTP Email */}
      {showAdminResetModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowAdminResetModal(false)}>
          <div className="w-full max-w-md bg-[#132B2C] rounded-3xl p-6 sm:p-7 border border-white/15 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-white" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowAdminResetModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X size={18} />
            </button>

            {/* Header Modal */}
            <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-white/10">
              <div className="w-11 h-11 rounded-2xl bg-[#2AB0B2]/15 border border-[#2AB0B2]/30 flex items-center justify-center text-[#2AB0B2] shrink-0">
                <Shield size={22} />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">
                  Ganti Kredensial Administrator
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Verifikasi keamanan via kode OTP email HRD / Admin
                </p>
              </div>
            </div>

            {/* Error & Success Alerts */}
            {adminResetError && (
              <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-300 font-semibold flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0 text-red-400" />
                <span>{adminResetError}</span>
              </div>
            )}
            {adminResetSuccess && (
              <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2">
                <Check size={15} className="shrink-0 text-emerald-400" />
                <span>{adminResetSuccess}</span>
              </div>
            )}

            {/* Step 1: Request OTP */}
            {adminResetStep === "REQUEST" ? (
              <div className="space-y-4">
                <p className="text-xs text-white/70 leading-relaxed">
                  Untuk mengubah username atau password akun Administrator, sistem akan mengirimkan kode verifikasi (OTP) 6-digit ke <strong>email HRD / Admin</strong> yang terdaftar di pengaturan.
                </p>

                <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl text-xs text-white/80 space-y-1">
                  <div className="font-semibold text-white/50">Akun sasaran:</div>
                  <div className="font-mono text-[#2AB0B2] font-bold text-sm">@{adminUser || "admin"} (Administrator)</div>
                </div>

                <button
                  type="button"
                  onClick={handleRequestAdminOtp}
                  disabled={adminResetLoading}
                  className="w-full py-3.5 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                >
                  {adminResetLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Mengirimkan Kode OTP...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Kirim Kode OTP ke Email</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Step 2: Input OTP & Set New Username / Password */
              <form onSubmit={handleSubmitAdminCredentials} className="space-y-4">
                <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-xs text-teal-300">
                  Kode OTP telah dikirim ke <strong>{adminResetMaskedEmail}</strong>. Masukkan kode tersebut di bawah ini:
                </div>

                {/* Input OTP */}
                <div>
                  <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider pl-1">
                    Kode Verifikasi (OTP 6-Digit) *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={adminResetOtp}
                    onChange={(e) => setAdminResetOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 focus:border-[#2AB0B2] outline-none text-center font-mono text-xl font-black tracking-[8px] text-white bg-white/5 focus:bg-white/10 transition-all placeholder:text-white/20"
                    required
                  />
                </div>

                {/* Input Username Baru */}
                <div>
                  <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider pl-1">
                    Username Admin Baru (Opsional)
                  </label>
                  <input
                    type="text"
                    value={adminResetNewUser}
                    onChange={(e) => setAdminResetNewUser(e.target.value)}
                    placeholder="Biarkan jika tidak ingin ganti username"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 focus:border-[#2AB0B2] outline-none font-mono text-sm text-white bg-white/5 focus:bg-white/10 transition-all placeholder:text-white/20"
                  />
                </div>

                {/* Input Password Baru */}
                <div>
                  <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider pl-1">
                    Password Baru (Opsional)
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminResetNewPw ? "text" : "password"}
                      value={adminResetNewPw}
                      onChange={(e) => setAdminResetNewPw(e.target.value)}
                      placeholder="Minimal 4 karakter"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-white/15 focus:border-[#2AB0B2] outline-none text-sm text-white bg-white/5 focus:bg-white/10 transition-all font-mono placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminResetNewPw(!showAdminResetNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                    >
                      {showAdminResetNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Konfirmasi Password Baru jika password baru diisi */}
                {adminResetNewPw.trim() !== "" && (
                  <div>
                    <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider pl-1">
                      Konfirmasi Password Baru *
                    </label>
                    <input
                      type="password"
                      value={adminResetConfirmPw}
                      onChange={(e) => setAdminResetConfirmPw(e.target.value)}
                      placeholder="Ketik ulang password baru"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 focus:border-[#2AB0B2] outline-none text-sm text-white bg-white/5 focus:bg-white/10 transition-all font-mono placeholder:text-white/20"
                      required
                    />
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleRequestAdminOtp}
                    disabled={adminResetLoading}
                    className="text-xs font-bold text-[#2AB0B2] hover:underline cursor-pointer"
                  >
                    Kirim Ulang OTP
                  </button>
                  <button
                    type="submit"
                    disabled={adminResetLoading || adminResetOtp.length < 6}
                    className="px-5 py-2.5 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                  >
                    {adminResetLoading ? "Menyimpan..." : "Verifikasi & Simpan"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Scan line animation */}
      <style>{`
        @keyframes scan-line {
          0% { top: 10%; }
          50% { top: 85%; }
          100% { top: 10%; }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
          position: absolute;
        }
      `}</style>
    </main>
  );
}
