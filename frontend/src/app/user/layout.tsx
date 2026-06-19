"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, History, User, LogOut, Settings } from "lucide-react";

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

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  // Admin login verification modal states
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) {
        router.push("/");
      } else {
        setAuthorized(true);
      }
    }
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("v2_user");
      localStorage.removeItem("v2_clockInTime");
    }
    router.push("/");
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword.trim()) {
      setAdminError("Username dan password wajib diisi");
      return;
    }
    setAdminLoading(true);
    setAdminError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: adminUsername,
          password: adminPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.role === "admin") {
          localStorage.setItem("v2_user", JSON.stringify(data));
          setShowAdminModal(false);
          setAdminUsername("");
          setAdminPassword("");
          router.push("/admin");
        } else {
          setAdminError("Akses ditolak: Akun Anda bukan Administrator");
        }
      } else {
        setAdminError(data.error || "Username atau password salah");
      }
    } catch (err) {
      setAdminError("Gagal menghubungi server");
    } finally {
      setAdminLoading(false);
    }
  };

  // Check if we should show bottom nav (only for home, history, profile)
  const isBaseScreen = pathname === "/user" || pathname === "/user/history" || pathname === "/user/profile";

  // Active tab helper
  const getActiveTab = () => {
    if (pathname === "/user") return "home";
    if (pathname === "/user/history") return "history";
    if (pathname === "/user/profile") return "profile";
    return "";
  };

  const activeTab = getActiveTab();

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center font-sans">
        <p className="text-gray-400 font-semibold text-sm">Memeriksa Sesi...</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-[#F0F2F5] flex justify-center overflow-hidden font-sans">
      {/* Centered Mobile Container */}
      <div className="w-full max-w-md bg-[#F0F2F5] h-full max-h-full flex flex-col shadow-xs relative overflow-hidden">
        {/* Top Navbar */}
        {isBaseScreen && (
          <header className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between shadow-xs select-none">
            <div className="flex items-center gap-2.5">
              <AppLogo size={30} />
              <div>
                <p className="font-extrabold text-sm leading-none text-[#1C3D3F]">Absensi SK</p>
                <p className="text-[9px] font-semibold text-gray-400 mt-1 uppercase tracking-wider">by sampulkreativ</p>
              </div>
            </div>
            {pathname === "/user/profile" && (
              <button
                onClick={() => setShowAdminModal(true)}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all cursor-pointer border border-gray-200 flex items-center gap-1.5 active:scale-95 shadow-xs"
              >
                <Settings size={14} className="text-[#2AB0B2]" />
                Admin Panel
              </button>
            )}
          </header>
        )}

        {/* Screen Content Viewport */}
        <div className="flex-1 flex flex-col overflow-y-auto relative">
          {children}
        </div>

        {/* Bottom Nav Bar */}
        {isBaseScreen && (
          <nav className="flex bg-white border-t border-gray-100 shadow-md pb-safe flex-shrink-0 select-none">
            <Link
              href="/user"
              className="flex-1 flex flex-col items-center py-3.5 gap-0.5 hover:bg-gray-50/50 transition-colors"
            >
              <Home size={22} color={activeTab === "home" ? "#2AB0B2" : "#9CA3AF"} />
              <span
                className="text-xs font-semibold"
                style={{ color: activeTab === "home" ? "#2AB0B2" : "#9CA3AF" }}
              >
                Beranda
              </span>
            </Link>

            <Link
              href="/user/history"
              className="flex-1 flex flex-col items-center py-3.5 gap-0.5 hover:bg-gray-50/50 transition-colors"
            >
              <History size={22} color={activeTab === "history" ? "#2AB0B2" : "#9CA3AF"} />
              <span
                className="text-xs font-semibold"
                style={{ color: activeTab === "history" ? "#2AB0B2" : "#9CA3AF" }}
              >
                Riwayat
              </span>
            </Link>

            <Link
              href="/user/profile"
              className="flex-1 flex flex-col items-center py-3.5 gap-0.5 hover:bg-gray-50/50 transition-colors"
            >
              <User size={22} color={activeTab === "profile" ? "#2AB0B2" : "#9CA3AF"} />
              <span
                className="text-xs font-semibold"
                style={{ color: activeTab === "profile" ? "#2AB0B2" : "#9CA3AF" }}
              >
                Profil
              </span>
            </Link>
          </nav>
        )}
      </div>

      {/* Admin Panel Password Verification Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl border border-gray-150 relative">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              Verifikasi Admin
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              Masukkan username dan password admin untuk mengakses panel administrator.
            </p>

            {adminError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-semibold text-center">
                {adminError}
              </div>
            )}

            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 text-sm bg-gray-50/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 text-sm bg-gray-50/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminModal(false);
                    setAdminUsername("");
                    setAdminPassword("");
                    setAdminError("");
                  }}
                  className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={adminLoading}
                  className="py-3 bg-[#2AB0B2] hover:bg-[#209092] text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer text-center"
                >
                  {adminLoading ? "Memverifikasi..." : "Masuk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
