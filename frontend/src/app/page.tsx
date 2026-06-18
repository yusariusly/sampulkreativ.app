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
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#F0F2F5] px-4">
      <div className="w-full max-w-[390px] bg-white rounded-[40px] shadow-2xl p-8 border border-gray-100 flex flex-col items-center justify-center">
        <div className="mb-5 mt-2 flex flex-col items-center select-none">
          <AppLogo size={88} />
          <div className="text-[10px] font-bold text-gray-400 mt-2.5 uppercase tracking-widest">by sampulkreativ</div>
        </div>
        <h1 className="text-[2rem] font-bold mb-1 text-[#1C3D3F] text-center">Selamat Datang</h1>
        <p className="text-gray-400 text-sm mb-8 text-center">Silakan masuk ke akun Anda</p>

        {error && (
          <div className="w-full mb-4 p-3 bg-red-50 text-red-500 rounded-xl text-xs font-semibold border border-red-100 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full space-y-4 mb-8">
          <input
            type="text"
            placeholder="Username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl bg-[#F3F4F6] border-2 border-transparent focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors"
          />
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              placeholder="Password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-full px-4 py-4 pr-12 rounded-2xl bg-[#F3F4F6] border-2 border-transparent focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPw((p) => !p)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
            >
              {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-md active:scale-[0.98] transition-transform cursor-pointer flex items-center justify-center bg-[#2AB0B2] hover:bg-[#209092] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? "Memproses..." : "Login"}
          </button>
        </form>

        {/* Demo Credentials Info Box */}
        <div className="mt-8 p-4 bg-[#F9FAFB] rounded-2xl border border-gray-100 text-xs text-gray-400 space-y-1 w-full select-none">
          <p className="font-bold text-gray-600">Info Akun Demo:</p>
          <p>• Admin: <code className="bg-white px-1.5 py-0.5 rounded border font-semibold text-[#2AB0B2]">admin</code> / <code className="bg-white px-1.5 py-0.5 rounded border font-semibold text-[#2AB0B2]">admin</code></p>
          <p>• Karyawan: <code className="bg-white px-1.5 py-0.5 rounded border font-semibold text-[#F6C13B]">ghani</code> / <code className="bg-white px-1.5 py-0.5 rounded border font-semibold text-[#F6C13B]">ghani</code></p>
        </div>

        {/* Copyright Footer */}
        <p className="text-[11px] text-gray-400 mt-8 text-center select-none">
          © 2026 sampulkreativ · Absensi · All rights reserved
        </p>
      </div>
    </main>
  );
}
