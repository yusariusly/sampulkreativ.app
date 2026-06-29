"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUserStr = localStorage.getItem("v2_user");
      let storedUser = null;
      if (storedUserStr) {
        try {
          storedUser = JSON.parse(storedUserStr);
          setCurrentUser(storedUser);
        } catch (e) {}
      }

      const deviceId = localStorage.getItem("v2_device_id");

      const recheckDevice = async () => {
        if (!deviceId) {
          router.push("/");
          return;
        }
        try {
          const response = await fetch(`/api/auth/check-device?device_id=${deviceId}`);
          const data = await response.json();
          if (response.ok && data.registered && data.user.is_active === 1) {
            localStorage.setItem("v2_user", JSON.stringify(data.user));
            setCurrentUser(data.user);
            setAuthorized(true);
          } else {
            router.push("/");
          }
        } catch (err) {
          router.push("/");
        }
      };

      if (!storedUser) {
        setAuthorized(false);
        recheckDevice();
      } else if (storedUser.role === "admin") {
        // Sesi saat ini adalah admin, tetapi sedang mengakses halaman user.
        // Kembalikan ke akun karyawan yang terikat pada perangkat ini.
        setAuthorized(false);
        recheckDevice();
      } else {
        setAuthorized(true);
      }
    }
  }, [router]);

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("v2_user");
      const deviceId = localStorage.getItem("v2_device_id") || "";
      if (storedUser && deviceId) {
        try {
          const userObj = JSON.parse(storedUser);
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userObj.id,
              device_id: deviceId
            })
          });
        } catch (e) {
          console.error("Gagal melakukan panggilan API logout:", e);
        }
      }
      localStorage.removeItem("v2_user");
      localStorage.removeItem("v2_clockInTime");
      localStorage.removeItem("v2_scanned_token");
      localStorage.removeItem("v2_device_id");
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center font-sans">
        <p className="text-gray-400 font-semibold text-sm">Memeriksa Sesi...</p>
      </div>
    );
  }

  return (
    <div id="user-layout-root" className="h-[100dvh] max-h-[100dvh] bg-[#F8FAFC] flex justify-center overflow-hidden font-sans">
      {/* Centered Mobile Container */}
      <div id="user-layout-container" className="w-full max-w-md bg-[#F8FAFC] h-full max-h-full flex flex-col shadow-xs relative overflow-hidden">
        {/* Top Navbar */}
        {isBaseScreen && (
          <header className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between shadow-xs select-none print:hidden">
            <div className="flex items-center gap-2.5">
              <AppLogo size={30} />
              <div>
                <p className="font-extrabold text-sm leading-none text-[#1C3D3F]">sampulkreativ.app</p>
                <p className="text-[9px] font-semibold text-gray-400 mt-1 uppercase tracking-wider">by sampulkreativ</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAdminModal(true)}
                className="p-2 rounded-xl text-gray-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
                title="Admin Panel"
              >
                <Settings size={16} />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
                title="Keluar"
              >
                <LogOut size={16} />
              </button>
            </div>
          </header>
        )}

        {/* Screen Content Viewport */}
        <div className="flex-1 flex flex-col overflow-y-auto relative">
          {children}
        </div>

        {/* Bottom Nav Bar (Conditional with Suspense) */}
        {isBaseScreen && (
          <Suspense fallback={null}>
            <BottomNav activeTab={activeTab} />
          </Suspense>
        )}
      </div>

      {/* Admin Panel Password Verification Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 select-none">
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

function BottomNav({ activeTab }: { activeTab: string }) {
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");
  const pathname = usePathname();
  const isPortalInternal = pathname === "/user" && (!currentView || currentView === "menu");

  if (isPortalInternal) return null;

  const viewParam = currentView ? `?view=${currentView}` : "";

  return (
    <nav className="flex bg-white border-t border-gray-100 shadow-md pb-safe flex-shrink-0 select-none print:hidden">
      <Link
        href={`/user${viewParam}`}
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
        href={`/user/history${viewParam}`}
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
        href={`/user/profile${viewParam}`}
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
  );
}
