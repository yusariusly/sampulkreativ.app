"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, User, Phone, Shield } from "lucide-react";

function AppLogo({ size = 80 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
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
  
  // 1. Core hardware attributes
  const screenSpec = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const userAgent = navigator.userAgent;
  const language = navigator.language || "";
  
  // 2. Canvas Fingerprint (Highly unique to OS font rendering & GPU)
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

  // 3. WebGL GPU vendor & renderer
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
  
  // Hash the raw signature string
  let finalHash = 0;
  for (let i = 0; i < rawSignature.length; i++) {
    finalHash = (finalHash << 5) - finalHash + rawSignature.charCodeAt(i);
    finalHash |= 0;
  }
  
  const fingerprint = "hw-" + Math.abs(finalHash).toString(36);
  
  // Cache in localStorage
  localStorage.setItem("v2_device_id", fingerprint);
  
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
  const [mode, setMode] = useState<"register" | "admin-login">("register");
  const [isCheckingDevice, setIsCheckingDevice] = useState(true);
  
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ nama_lengkap: string; username: string; device_info?: string } | null>(null);
  const [dots, setDots] = useState(".");

  // Registration States
  const [namaLengkap, setNamaLengkap] = useState("");
  const [noHp, setNoHp] = useState("");
  
  // Admin States
  const [adminUser, setAdminUser] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check existing session and match device online on mount
  useEffect(() => {
    let active = true;

    const checkDeviceBinding = async () => {
      if (typeof window === "undefined") return;

      const deviceId = getOrCreateDeviceId();
      const stored = localStorage.getItem("v2_user");

      // Extract and save token from URL query params
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (token) {
        sessionStorage.setItem("v2_scanned_token", token);
      }

      try {
        const response = await fetch(`/api/auth/check-device?device_id=${deviceId}`);
        const data = await response.json();

        if (active) {
          if (response.ok && data.registered) {
            localStorage.setItem("v2_user", JSON.stringify(data.user));
            if (data.user.role === "admin") {
              router.replace("/admin");
              return;
            }
            if (data.user.is_active === 1) {
              const activeToken = token || sessionStorage.getItem("v2_scanned_token");
              if (activeToken) {
                router.replace("/user/selfie");
              } else {
                router.replace("/user");
              }
              return;
            } else {
              setIsPendingApproval(true);
              setPendingUser(data.user);
              setIsCheckingDevice(false);
              return;
            }
          }
        }
      } catch (err) {
        console.error("Gagal mencocokkan perangkat secara online:", err);
        // Fallback to local storage session if offline
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.role === "admin") {
              router.replace("/admin");
              return;
            }
            if (parsed.is_active === 1) {
              const activeToken = token || sessionStorage.getItem("v2_scanned_token");
              if (activeToken) {
                router.replace("/user/selfie");
              } else {
                router.replace("/user");
              }
              return;
            } else {
              setIsPendingApproval(true);
              setPendingUser(parsed);
              setIsCheckingDevice(false);
              return;
            }
          } catch (e) {}
        }
      }

      if (active) {
        setIsCheckingDevice(false);
      }
    };

    checkDeviceBinding();

    return () => {
      active = false;
    };
  }, [router]);

  // Handle dots animation & silent polling for approval
  useEffect(() => {
    let active = true;
    let dotsInterval: NodeJS.Timeout;
    let pollInterval: NodeJS.Timeout;

    if (isPendingApproval) {
      // 1. Dots animation looping: . -> .. -> ... -> .
      dotsInterval = setInterval(() => {
        if (!active) return;
        setDots((prev) => {
          if (prev === ".") return "..";
          if (prev === "..") return "...";
          return ".";
        });
      }, 600);

      // 2. Background polling: check if approved every 3 seconds
      const deviceId = getOrCreateDeviceId();
      pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/auth/check-device?device_id=${deviceId}`);
          const data = await response.json();
          if (active && response.ok && data.registered && data.user.is_active === 1) {
            localStorage.setItem("v2_user", JSON.stringify(data.user));
            const activeToken = sessionStorage.getItem("v2_scanned_token");
            if (activeToken) {
              router.replace("/user/selfie");
            } else {
              router.replace("/user");
            }
          }
        } catch (e) {
          console.error("Gagal melakukan pencocokan latar belakang:", e);
        }
      }, 3000);
    }

    return () => {
      active = false;
      clearInterval(dotsInterval);
      clearInterval(pollInterval);
    };
  }, [isPendingApproval, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!namaLengkap.trim() || !noHp.trim()) {
      setError("Nama Lengkap dan Nomor Telepon wajib diisi");
      return;
    }

    setLoading(true);

    try {
      const deviceId = getOrCreateDeviceId();
      const deviceInfo = getDeviceInfo();

      const response = await fetch("/api/auth/register-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_lengkap: namaLengkap.trim(),
          username: noHp.trim(),
          device_id: deviceId,
          device_info: deviceInfo
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Gagal melakukan registrasi");
        setLoading(false);
        return;
      }

      localStorage.setItem("v2_user", JSON.stringify(data));
      
      if (data.is_active === 1) {
        const activeToken = sessionStorage.getItem("v2_scanned_token");
        if (activeToken) {
          router.push("/user/selfie");
        } else {
          router.push("/user");
        }
      } else {
        setIsPendingApproval(true);
        setPendingUser(data);
        setLoading(false);
      }
    } catch (err) {
      setError("Terjadi kesalahan koneksi internet");
      setLoading(false);
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
        body: JSON.stringify({
          username: adminUser.trim(),
          password: adminPw
        }),
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

  if (isCheckingDevice) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#1C3D3F] via-[#2AB0B2] to-[#209092] flex flex-col items-center justify-center text-white p-6">
        <div className="flex flex-col items-center max-w-sm text-center space-y-6 animate-fade-in">
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/20 shadow-xl animate-pulse">
            <AppLogo size={80} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-wide animate-pulse">Mencocokkan Perangkat...</h2>
            <p className="text-xs text-white/70">
              Sistem sedang memverifikasi HP Anda secara aman. Silakan tunggu sebentar.
            </p>
          </div>
          <div className="flex items-center gap-1.5 pt-4">
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#F6C13B] animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" />
          </div>
        </div>
      </div>
    );
  }

  if (isPendingApproval && pendingUser) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#1C3D3F] via-[#2AB0B2] to-[#209092] flex flex-col items-center justify-center text-white p-6">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-3xl shadow-2xl text-center space-y-6 animate-fade-in">
          <div className="mx-auto w-16 h-16 bg-amber-500/20 text-[#F6C13B] rounded-full flex items-center justify-center border border-amber-500/30">
            <Shield size={32} className="animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-wide">Pendaftaran Berhasil!</h2>
            <p className="text-sm text-white/80">
              Halo, <span className="font-semibold text-white">{pendingUser.nama_lengkap}</span>. HP Anda telah berhasil terhubung di sistem absensi.
            </p>
          </div>

          <div className="bg-black/10 rounded-2xl p-4 text-left space-y-2 border border-white/10 text-xs font-medium text-white/90">
            <div>
              <span className="text-white/60 block">Nomor Telepon</span>
              <span>{pendingUser.username}</span>
            </div>
            <div>
              <span className="text-white/60 block">Perangkat HP</span>
              <span>{pendingUser.device_info || "Perangkat Terikat"}</span>
            </div>
            <div>
              <span className="text-white/60 block">Status Akun</span>
              <span className="text-[#F6C13B] font-bold">Menunggu Persetujuan Admin{dots}</span>
            </div>
          </div>

          <p className="text-xs text-white/70 italic">
            Harap hubungi Administrator kantor untuk memberikan persetujuan akses pada akun Anda agar dapat melakukan absensi.
          </p>
        </div>
      </div>
    );
  }
  return (
    <main className="min-h-screen w-full flex bg-white lg:bg-[#F9FAFB]">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1C3D3F] via-[#2AB0B2] to-[#209092] p-12 text-white flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full filter blur-3xl -mr-64 -mt-64 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#F6C13B]/10 rounded-full filter blur-3xl -ml-48 -mb-48 pointer-events-none" />
        
        <div className="flex items-center gap-3 relative z-10">
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20">
            <AppLogo size={48} />
          </div>
          <div>
            <h2 className="font-bold text-lg tracking-wide">Absensi SK</h2>
            <p className="text-[10px] text-white/60 tracking-widest uppercase mt-0.5">by sampulkreativ</p>
          </div>
        </div>

        <div className="my-auto max-w-md space-y-4 relative z-10">
          <h1 className="text-4xl font-extrabold leading-tight">
            Absen Cepat dengan <span className="text-[#F6C13B]">Registrasi Sekali</span> &amp; Scan QR
          </h1>
          <p className="text-white/80 text-sm leading-relaxed">
            Tidak perlu login berulang kali. Cukup daftarkan diri Anda sekali menggunakan HP Anda. Sistem akan mencocokkan identitas Anda otomatis saat pemindaian QR dan selfie.
          </p>
        </div>

        <div className="text-xs text-white/50 relative z-10 select-none">
          © 2026 sampulkreativ · Absensi · All Rights Reserved.
        </div>
      </div>

      {/* Right Column: Register/Login Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 md:p-12 relative">
        <div className="w-full max-w-[420px] bg-transparent shadow-none p-6 sm:p-10 flex flex-col justify-center">
          
          <div className="lg:hidden mb-6 flex flex-col items-center select-none">
            <AppLogo size={88} />
            <div className="text-[10px] font-bold text-gray-400 mt-2.5 uppercase tracking-widest">by sampulkreativ</div>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-[#1C3D3F] mb-1.5">
              {mode === "register" ? "Absensi Karyawan" : "Administrator"}
            </h1>
            <p className="text-gray-400 text-sm">
              {mode === "register" 
                ? "Daftarkan diri Anda sekali menggunakan HP ini untuk mulai melakukan absensi." 
                : "Masukkan kredensial admin Anda untuk mengelola sistem."}
            </p>
          </div>

          {error && (
            <div className="w-full mb-4 p-3.5 bg-red-50 text-red-600 rounded-2xl text-xs font-semibold border border-red-100 text-center">
              {error}
            </div>
          )}

          {mode === "register" ? (
            <form onSubmit={handleRegister} className="w-full space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                  <User size={13} className="text-[#2AB0B2]" /> Nama Lengkap
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap Anda"
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#F3F4F6] border-2 border-transparent focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors placeholder:text-gray-400"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                  <Phone size={13} className="text-[#2AB0B2]" /> Nomor Telepon
                </label>
                <input
                  type="tel"
                  placeholder="Contoh: 08123456789"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#F3F4F6] border-2 border-transparent focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors placeholder:text-gray-400"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-2 rounded-2xl text-white font-bold text-base shadow-md active:scale-[0.98] transition-transform cursor-pointer flex items-center justify-center bg-[#2AB0B2] hover:bg-[#209092] disabled:opacity-50"
              >
                {loading ? "Memproses..." : "Daftar & Masuk Absensi"}
              </button>
              
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode("admin-login");
                    setError("");
                  }}
                  className="text-xs text-[#2AB0B2] hover:underline font-bold flex items-center gap-1 mx-auto cursor-pointer"
                >
                  <Shield size={12} /> Masuk sebagai Administrator
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="w-full space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider pl-1">Username Admin</label>
                <input
                  type="text"
                  placeholder="Masukkan username"
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#F3F4F6] border-2 border-transparent focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors placeholder:text-gray-400"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider pl-1">Password Admin</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Masukkan password"
                    value={adminPw}
                    onChange={(e) => setAdminPw(e.target.value)}
                    className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-[#F3F4F6] border-2 border-transparent focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors placeholder:text-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer hover:text-gray-600"
                  >
                    {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-2 rounded-2xl text-white font-bold text-base shadow-md active:scale-[0.98] transition-transform cursor-pointer flex items-center justify-center bg-[#2AB0B2] hover:bg-[#209092] disabled:opacity-50"
              >
                {loading ? "Memproses..." : "Masuk sebagai Admin"}
              </button>
              
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  className="text-xs text-[#2AB0B2] hover:underline font-bold cursor-pointer"
                >
                  Kembali ke Absensi Karyawan
                </button>
              </div>
            </form>
          )}

          <p className="lg:hidden text-[11px] text-gray-400 mt-8 text-center select-none">
            © 2026 sampulkreativ · Absensi · All rights reserved
          </p>
        </div>
      </div>
    </main>
  );
}
