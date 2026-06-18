"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

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

export default function LoginPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Clear previous session on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("v2_user");
      localStorage.removeItem("v2_clockInTime");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!user.trim() || !pw.trim()) {
      setError("Username dan password tidak boleh kosong");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.trim(), password: pw }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Gagal masuk");
        setLoading(false);
        return;
      }

      // Save user session details
      localStorage.setItem("v2_user", JSON.stringify(data));

      if (data.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/user");
      }
    } catch (err) {
      setError("Terjadi kesalahan koneksi internet");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex bg-[#F3F4F6] lg:bg-[#F9FAFB]">
      {/* Left Column: Premium Branding Banner (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1C3D3F] via-[#2AB0B2] to-[#209092] p-12 text-white flex-col justify-between relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full filter blur-3xl -mr-64 -mt-64 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#F6C13B]/10 rounded-full filter blur-3xl -ml-48 -mb-48 pointer-events-none" />
        
        {/* Brand header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20">
            <AppLogo size={48} />
          </div>
          <div>
            <h2 className="font-bold text-lg tracking-wide">Absensi SK</h2>
            <p className="text-[10px] text-white/60 tracking-widest uppercase mt-0.5">by sampulkreativ</p>
          </div>
        </div>

        {/* Brand message */}
        <div className="my-auto max-w-md space-y-4 relative z-10">
          <h1 className="text-4xl font-extrabold leading-tight">
            Pantau Kehadiran Karyawan dengan <span className="text-[#F6C13B]">Mudah</span> &amp; <span className="text-white">Akurat</span>
          </h1>
          <p className="text-white/80 text-sm leading-relaxed">
            Sistem absensi digital mandiri dengan fitur scan kode QR berbasis lokasi, pencatatan selfie secara langsung, serta integrasi dashboard pemantauan admin yang responsif.
          </p>
        </div>

        {/* Brand footer */}
        <div className="text-xs text-white/50 relative z-10 select-none">
          © 2026 sampulkreativ · Absensi · All Rights Reserved.
        </div>
      </div>

      {/* Right Column: Login Card (Mobile: Full screen / Desktop: Centered card or panel) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 md:p-12 relative">
        <div className="w-full max-w-[400px] bg-white lg:shadow-none rounded-[40px] lg:rounded-none shadow-2xl p-8 sm:p-10 border border-gray-100 lg:border-none flex flex-col justify-center">
          
          {/* Logo on mobile only */}
          <div className="lg:hidden mb-6 flex flex-col items-center select-none">
            <AppLogo size={88} />
            <div className="text-[10px] font-bold text-gray-400 mt-2.5 uppercase tracking-widest">by sampulkreativ</div>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-[#1C3D3F] mb-1.5">Selamat Datang</h1>
            <p className="text-gray-400 text-sm">Silakan masuk untuk mengakses portal kehadiran Anda.</p>
          </div>

          {error && (
            <div className="w-full mb-4 p-3.5 bg-red-50 text-red-600 rounded-2xl text-xs font-semibold border border-red-100 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider pl-1">Username</label>
              <input
                type="text"
                placeholder="Masukkan username"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-[#F3F4F6] border-2 border-transparent focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors placeholder:text-gray-400"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider pl-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Masukkan password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-[#F3F4F6] border-2 border-transparent focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors placeholder:text-gray-400"
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
              className="w-full py-4 mt-2 rounded-2xl text-white font-bold text-base shadow-md active:scale-[0.98] transition-transform cursor-pointer flex items-center justify-center bg-[#2AB0B2] hover:bg-[#209092] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? "Memproses..." : "Masuk ke Dashboard"}
            </button>
          </form>



          {/* Copyright Footer (Mobile only) */}
          <p className="lg:hidden text-[11px] text-gray-400 mt-8 text-center select-none">
            © 2026 sampulkreativ · Absensi · All rights reserved
          </p>
        </div>
      </div>
    </main>
  );
}
