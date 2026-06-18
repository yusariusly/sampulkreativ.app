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
  let id = localStorage.getItem("v2_device_id");
  if (!id) {
    id = "dev-" + Math.random().toString(36).substring(2, 15) + "-" + Date.now().toString(36);
    localStorage.setItem("v2_device_id", id);
  }
  return id;
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

      try {
        const response = await fetch(`/api/auth/check-device?device_id=${deviceId}`);
        const data = await response.json();

        if (active) {
          if (response.ok && data.registered) {
            localStorage.setItem("v2_user", JSON.stringify(data.user));
            if (data.user.role === "admin") {
              router.replace("/admin");
            } else {
              router.replace("/user");
            }
            return;
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
            } else {
              router.replace("/user");
            }
            return;
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!namaLengkap.trim() || !noHp.trim()) {
      setError("Nama Lengkap dan Nomor WhatsApp wajib diisi");
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
      router.push("/user");
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

  return (
    <main className="min-h-screen w-full flex bg-[#F3F4F6] lg:bg-[#F9FAFB]">
      {/* Left Column: Premium Branding Banner (Desktop Only) */}
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
        <div className="w-full max-w-[420px] bg-white lg:shadow-none rounded-[40px] lg:rounded-none shadow-2xl p-8 sm:p-10 border border-gray-100 lg:border-none flex flex-col justify-center">
          
          <div className="lg:hidden mb-6 flex flex-col items-center select-none">
            <AppLogo size={88} />
            <div className="text-[10px] font-bold text-gray-400 mt-2.5 uppercase tracking-widest">by sampulkreativ</div>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-[#1C3D3F] mb-1.5">
              {mode === "register" ? "Registrasi Karyawan" : "Portal Administrator"}
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
                  <Phone size={13} className="text-[#2AB0B2]" /> Nomor WhatsApp / HP
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
                  Kembali ke Registrasi Karyawan
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
