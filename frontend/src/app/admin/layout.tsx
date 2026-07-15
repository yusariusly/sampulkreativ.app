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
  Laptop,
  ClipboardList,
  Award,
  PiggyBank,
  Tablet,
  Key,
  Wallet,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";

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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load sidebar collapsed state on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("v2_admin_sidebar_collapsed");
      setIsCollapsed(saved === "true");
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    if (typeof window !== "undefined") {
      localStorage.setItem("v2_admin_sidebar_collapsed", String(nextState));
    }
  };

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
          Promise.resolve().then(() => setAuthorized(true));
        }
      } catch (err) {
        router.push("/");
      }
    }
  }, [router]);

  // Close mobile drawer when path changes
  useEffect(() => {
    Promise.resolve().then(() => setIsMobileMenuOpen(false));
  }, [pathname]);

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      const deviceId = localStorage.getItem("v2_device_id");
      if (deviceId) {
        try {
          const response = await fetch(`/api/auth/check-device?device_id=${deviceId}`);
          const data = await response.json();
          if (response.ok && data.registered && data.user.is_active === 1) {
            localStorage.setItem("v2_user", JSON.stringify(data.user));
            router.push("/user");
            return;
          }
        } catch (e) {
          console.error("Gagal mencocokkan kembali perangkat saat logout admin:", e);
        }
      }
      localStorage.removeItem("v2_user");
      router.push("/");
    }
  };

  const navItems = [
    { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/admin/data", label: "Data Absensi", Icon: Database },
    { href: "/admin/remote", label: "Remote Working", Icon: Laptop },
    { href: "/admin/pkl", label: "Aktivitas PKL", Icon: ClipboardList },
    { href: "/admin/pkl/score", label: "Poin PKL", Icon: Award },
    { href: "/admin/certificate", label: "Nilai Sertifikat", Icon: FileText },
    { href: "/admin/pkl/savings", label: "Tabungan Buku", Icon: PiggyBank },
    { href: "/station", label: "Stasiun Absensi", Icon: Tablet },
    { href: "/admin/qr", label: "Generate QR", Icon: QrCode },
    { href: "/admin/users", label: "Pengguna", Icon: Users },
    { href: "/admin/kie", label: "API KIE", Icon: Key },
    { href: "/admin/payroll", label: "Sistem Payroll", Icon: Wallet },
  ];

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center font-sans">
        <p className="text-gray-400 font-semibold text-sm">Memeriksa Otorisasi Admin...</p>
      </div>
    );
  }

  const renderSidebarContent = (collapsed: boolean = false) => (
    <div className="flex flex-col h-full">
      {/* Brand Logo */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-2 mb-8 select-none`}>
        <div className="flex items-center gap-2.5">
          <AppLogo size={collapsed ? 30 : 34} />
          {!collapsed && (
            <div>
              <p className="font-extrabold text-sm leading-none text-[#1C3D3F]">sampulkreativ.app</p>
              <p className="text-[9px] font-semibold text-gray-400 mt-1 uppercase tracking-wider">by sampulkreativ</p>
            </div>
          )}
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
              title={collapsed ? label : undefined}
              className={`w-full flex items-center ${collapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"} rounded-xl text-sm font-medium transition-all ${
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
              {!collapsed && <span className="transition-opacity duration-300">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer Controls */}
      <div className="pt-4 border-t border-gray-100 space-y-1">
        <Link
          href="/admin/settings"
          title={collapsed ? "Pengaturan" : undefined}
          className={`flex items-center ${collapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"} text-sm rounded-xl transition-all w-full text-left cursor-pointer font-medium ${
            pathname === "/admin/settings"
              ? "text-[#2AB0B2] bg-[#2AB0B2]/10 font-semibold"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Settings size={18} />
          {!collapsed && <span>Pengaturan</span>}
        </Link>
        
        <button
          onClick={handleLogout}
          title={collapsed ? "Log Out" : undefined}
          className={`flex items-center ${collapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"} text-sm text-red-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-all w-full text-left cursor-pointer font-medium`}
        >
          <LogOut size={18} />
          {!collapsed && <span>Log Out</span>}
        </button>

        {!collapsed && (
          <div className="pt-3.5 border-t border-gray-100/60 select-none">
            <p className="text-[10px] font-bold leading-tight text-gray-400">
              © 2026 sampulkreativ
            </p>
            <p className="text-[9px] text-gray-300 mt-0.5">
              Absensi · All rights reserved
            </p>
          </div>
        )}
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
            <p className="font-extrabold text-sm leading-none text-[#1C3D3F]">sampulkreativ.app</p>
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

      <aside 
        className={`md:hidden fixed top-0 bottom-0 right-0 z-50 w-[270px] bg-white p-6 shadow-2xl border-l border-gray-100 flex flex-col transition-transform duration-300 ease-in-out transform ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Desktop Sidebar Panel */}
      <aside 
        className={`hidden md:flex bg-white border-r border-gray-100 flex-col py-7 flex-shrink-0 print:hidden sticky top-0 h-screen transition-all duration-300 ease-in-out relative z-30 ${
          isCollapsed ? "w-[76px] px-3" : "w-[240px] px-4"
        }`}
      >
        {/* Floating Toggle Button on the Right Border */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex absolute top-9 -right-3 w-6 h-6 rounded-full bg-white border border-gray-250 shadow-sm items-center justify-center text-gray-400 hover:text-[#2AB0B2] hover:border-[#2AB0B2] hover:bg-[#2AB0B2]/5 transition-all active:scale-90 cursor-pointer z-50"
          title={isCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={12} strokeWidth={2.5} /> : <ChevronLeft size={12} strokeWidth={2.5} />}
        </button>

        {renderSidebarContent(isCollapsed)}
      </aside>

      {/* Main Administrative Dashboard Screen Area */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
