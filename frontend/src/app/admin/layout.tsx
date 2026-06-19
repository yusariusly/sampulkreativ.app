"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Users,
  Settings,
  LogOut,
  QrCode,
  Menu,
  X,
} from "lucide-react";

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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) {
        router.push("/");
        return;
      }

      try {
        const userObj = JSON.parse(storedUser);
        if (userObj.role !== "admin") {
          router.push("/user");
        } else {
          setAuthorized(true);
        }
      } catch (err) {
        router.push("/");
      }
    }
  }, [router]);

  // Close mobile drawer when path changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("v2_user");
    }
    router.push("/");
  };

  const navItems = [
    { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/admin/data", label: "Data Absensi", Icon: Database },
    { href: "/admin/qr", label: "Generate QR", Icon: QrCode },
    { href: "/admin/users", label: "Pengguna", Icon: Users },
  ];

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center font-sans">
        <p className="text-gray-400 font-semibold text-sm">Memeriksa Otorisasi Admin...</p>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand Logo */}
      <div className="flex items-center justify-between px-2 mb-8 select-none">
        <div className="flex items-center gap-2.5">
          <AppLogo size={34} />
          <div>
            <p className="font-extrabold text-sm leading-none text-[#1C3D3F]">Absensi SK</p>
            <p className="text-[9px] font-semibold text-gray-400 mt-1 uppercase tracking-wider">by sampulkreativ</p>
          </div>
        </div>
        {/* Mobile Close Button Inside Sidebar */}
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="space-y-1 flex-1">
        {navItems.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "text-[#2AB0B2] bg-[#2AB0B2]/10 font-semibold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              <Icon
                size={18}
                className={isActive ? "text-[#2AB0B2]" : "text-gray-400"}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer Controls */}
      <div className="pt-4 border-t border-gray-100 space-y-1">
        <Link
          href="/admin/settings"
          className={`flex items-center gap-3 px-3.5 py-3 text-sm rounded-xl transition-all w-full text-left cursor-pointer font-medium ${
            pathname === "/admin/settings"
              ? "text-[#2AB0B2] bg-[#2AB0B2]/10 font-semibold"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Settings size={18} />
          <span>Pengaturan</span>
        </Link>
        
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3.5 py-3 text-sm text-red-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-all w-full text-left cursor-pointer font-medium"
        >
          <LogOut size={18} />
          <span>Log Out</span>
        </button>

        <div className="pt-3.5 border-t border-gray-100/60 select-none">
          <p className="text-[10px] font-bold leading-tight text-gray-400">
            © 2026 sampulkreativ
          </p>
          <p className="text-[9px] text-gray-300 mt-0.5">
            Absensi · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col md:flex-row font-sans">
      {/* Mobile Top Header Bar */}
      <header className="md:hidden w-full bg-white border-b border-gray-150 py-3.5 px-5 flex items-center justify-between shadow-xs select-none sticky top-0 z-30 print:hidden">
        <div className="flex items-center gap-2.5">
          <AppLogo size={30} />
          <div>
            <p className="font-extrabold text-sm leading-none text-[#1C3D3F]">Absensi SK</p>
            <p className="text-[9px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">Admin Panel</p>
          </div>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 active:scale-95 transition-all"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide-out Drawer Panel */}
      <aside 
        className={`md:hidden fixed top-0 bottom-0 right-0 z-50 w-[270px] bg-white p-6 shadow-2xl border-l border-gray-100 flex flex-col transition-transform duration-300 ease-in-out transform ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar Panel */}
      <aside className="hidden md:flex w-[240px] bg-white border-r border-gray-100 flex-col py-7 px-4 flex-shrink-0 print:hidden sticky top-0 h-screen overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Main Administrative Dashboard Screen Area */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
