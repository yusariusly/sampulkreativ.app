"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, History, User, LogOut } from "lucide-react";

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
          </header>
        )}

        {/* Screen Content Viewport */}
        <div className="flex-1 flex flex-col overflow-y-auto relative">
          {children}
        </div>

        {/* Bottom Nav Bar */}
        {isBaseScreen && (
          <div className="flex flex-col select-none">
            <p className="text-[10px] text-gray-400 text-center py-2 bg-white border-t border-gray-100/60 select-none">
              © 2026 sampulkreativ · Absensi · All rights reserved
            </p>
            <nav className="flex bg-white border-t border-gray-100 shadow-md pb-safe flex-shrink-0">
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
          </div>
        )}
      </div>
    </div>
  );
}
