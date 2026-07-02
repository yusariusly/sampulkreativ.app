"use client";

import React, { useEffect, useState, Suspense, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Home, History, User, LogOut, Settings, ArrowLeft, Key } from "lucide-react";
import { SavingsProgressBar } from "@/features/pkl-activity/components/SavingsProgressBar";

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

function TopNavbar({
  setShowAdminModal,
  handleLogout,
}: {
  setShowAdminModal: (show: boolean) => void;
  handleLogout: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");

  return (
    <header className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between shadow-xs select-none print:hidden flex-shrink-0">
      <div className="flex items-center gap-2">
        {currentView && currentView !== "menu" && (
          <button
            onClick={() => router.push("/user")}
            className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer mr-0.5"
            title="Kembali"
          >
            <ArrowLeft size={16} />
          </button>
        )}
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
  );
}

/**
 * Komponen wrapper untuk menampilkan SavingsProgressBar secara global.
 * Menyembunyikan diri di view=pkl (karena di-render inline di StudentDashboardView).
 */
function GlobalSavingsNotice({ isStudent }: { isStudent: boolean }) {
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");
  const pathname = usePathname();

  // Hanya tampilkan untuk siswa
  if (!isStudent) return null;

  // Di view PKL, SavingsProgressBar sudah di-render inline di bawah notice reward/punishment
  if (pathname === "/user" && currentView === "pkl") return null;

  return (
    <div className="px-5 pt-2 flex-shrink-0 print:hidden">
      <SavingsProgressBar />
    </div>
  );
}

function KieProgressNotice() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [debt, setDebt] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) return;
      const userObj = JSON.parse(storedUser);
      const deviceId = localStorage.getItem("v2_device_id") || "";

      const res = await fetch(`/api/kie/today-count?user_id=${userObj.id}&device_id=${deviceId}`);
      if (res.ok) {
        const data = await res.json();
        setCount(data.count_today || 0);
        setDebt(data.kie_debt || 0);
      }
    } catch (err) {
      console.error("Gagal memuat KIE progress:", err);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchCount());
    const handleUpdate = () => {
      Promise.resolve().then(() => fetchCount());
    };
    window.addEventListener("kie-submitted", handleUpdate);
    return () => window.removeEventListener("kie-submitted", handleUpdate);
  }, [fetchCount]);

  // Hanya tampilkan di halaman /user utama
  if (pathname !== "/user" || (currentView && currentView !== "menu")) return null;

  // Hitung target dinamis (default 10 + hutang)
  const baseTarget = 10 + debt;
  const totalBoxes = Math.max(baseTarget, count);

  const progressPercent = count > 0 ? (count / totalBoxes) * 100 : 0;
  const bgSizePercent = count > 0 ? (totalBoxes / count) * 100 : 100;

  // Soft transition stops (0.5 units padding on each side of the transition point)
  const stop1 = ((4 + debt - 0.5) / totalBoxes) * 100;
  const stop2 = ((4 + debt + 0.5) / totalBoxes) * 100;
  const stop3 = ((8 + debt - 0.5) / totalBoxes) * 100;
  const stop4 = ((8 + debt + 0.5) / totalBoxes) * 100;

  const gradient = `linear-gradient(to right, #EF4444 0%, #EF4444 ${stop1}%, #F59E0B ${stop2}%, #F59E0B ${stop3}%, #10B981 ${stop4}%, #10B981 100%)`;

  return (
    <div className="px-5 pt-2 flex-shrink-0 print:hidden select-none">
      <div className="bg-white border border-gray-150 rounded-[16px] p-3 shadow-3xs flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
          <span>KIE PROGRESS</span>
          <span className="text-[#1C3D3F]">{count}/{baseTarget}</span>
        </div>
        
        {/* Single continuous progress bar with 3 softly transitioned colored zones */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full border border-gray-200/50 overflow-hidden flex relative mt-0.5">
          {/* Target Marker line if count exceeds baseTarget */}
          {count > baseTarget && (
            <div
              style={{ left: `${(baseTarget / totalBoxes) * 100}%` }}
              className="absolute top-0 bottom-0 w-0.5 border-l border-dashed border-gray-400/80 z-10"
              title="Target Harian"
            />
          )}

          {/* Filled portion with soft color transitions relative to parent container */}
          <div
            style={{
              width: `${progressPercent}%`,
              backgroundImage: gradient,
              backgroundSize: `${bgSizePercent}% 100%`,
              backgroundRepeat: "no-repeat"
            }}
            className="h-full transition-all duration-500 ease-out"
          />
        </div>

        {debt > 0 && (
          <div className="mt-0.5 px-2.5 py-1.5 bg-red-50/60 border border-red-100/50 rounded-lg flex items-start gap-1.5 text-[9px]">
            <span className="shrink-0 px-1 py-0.5 bg-red-100 text-red-600 font-bold rounded-[3px] uppercase tracking-wider text-[7px] mt-0.5">
              HUTANG: {debt}
            </span>
            <span className="text-red-500 font-semibold leading-relaxed">
              Anda memiliki hutang setoran KIE. Silakan menyetor lebih dari 4 KIE hari ini untuk melunasinya.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}


export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  // Admin login verification modal states
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ role?: string; id?: string | number } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const storedUserStr = localStorage.getItem("v2_user");
      let storedUser = null;
      if (storedUserStr) {
        try {
          storedUser = JSON.parse(storedUserStr);
          if (storedUser && storedUser.role !== "admin") {
            setCurrentUser(storedUser);
            setAuthorized(true);
          }
        } catch {
          // handled silently
        }
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
        } catch {
          router.push("/");
        }
      };

      if (!storedUser || storedUser.role === "admin") {
        // Sesi saat ini kosong atau admin, tetapi sedang mengakses halaman user.
        // Kembalikan ke akun karyawan yang terikat pada perangkat ini.
        recheckDevice();
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
    } catch {
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

  if (!isMounted || !authorized) {
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
          <Suspense fallback={
            <header className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between shadow-xs select-none print:hidden flex-shrink-0">
              <div className="flex items-center gap-2">
                <AppLogo size={30} />
                <div>
                  <p className="font-extrabold text-sm leading-none text-[#1C3D3F]">sampulkreativ.app</p>
                  <p className="text-[9px] font-semibold text-gray-400 mt-1 uppercase tracking-wider">by sampulkreativ</p>
                </div>
              </div>
            </header>
          }>
            <TopNavbar
              setShowAdminModal={setShowAdminModal}
              handleLogout={handleLogout}
            />
          </Suspense>
        )}

        {/* Screen Content Viewport */}
        <div className="flex-1 flex flex-col overflow-y-auto relative">
          {/* Global Savings Notice (semua halaman kecuali view=pkl karena di-render inline di sana) */}
          <Suspense fallback={null}>
            <GlobalSavingsNotice isStudent={currentUser?.role === 'student'} />
          </Suspense>
          {/* KIE Progress Notice */}
          <Suspense fallback={null}>
            <KieProgressNotice />
          </Suspense>
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
