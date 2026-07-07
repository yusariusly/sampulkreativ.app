"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bell, X } from "lucide-react";

const TEMPLATES = [
  { id: "1", text: "Gajian bulan ini akan ditransfer pada tanggal [Tanggal]." },
  { id: "2", text: "Slip gaji dan pembayaran akan diproses pada tanggal [Tanggal]." },
  { id: "3", text: "Estimasi transfer gajian: [Tanggal]. Mohon ditunggu." }
];

export default function PaydayNotice() {
  const pathname = usePathname();
  const [noticeText, setNoticeText] = useState("");
  const [isActiveConfig, setIsActiveConfig] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkNotice = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          const active = data.payroll_notice_active === "1";
          const dateStr = data.payroll_notice_date || "";
          const tempId = data.payroll_notice_template_id || "1";

          if (active && dateStr.trim() !== "") {
            // Check if notice date is in the past
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const noticeDate = new Date(dateStr);
            noticeDate.setHours(0, 0, 0, 0);

            if (noticeDate >= today) {
              const template = TEMPLATES.find((t) => t.id === tempId) || TEMPLATES[0];
              
              // Format date to Indonesian words
              const formatDateIndonesian = (ds: string) => {
                const date = new Date(ds);
                if (isNaN(date.getTime())) return ds;
                
                const days = date.getDate();
                const months = [
                  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
                ];
                const monthName = months[date.getMonth()];
                const year = date.getFullYear();
                
                return `${days} ${monthName} ${year}`;
              };

              const processedText = template.text.replace("[Tanggal]", formatDateIndonesian(dateStr));
              setNoticeText(processedText);
              setIsActiveConfig(true);
            }
          }
        }
      } catch (err) {
        console.error("Gagal memeriksa notice gajian:", err);
      } finally {
        setLoading(false);
      }
    };

    checkNotice();
  }, []);

  // Exclude notice from showing on selfie, debug, and QR scanning pages
  const isExcludedPage = 
    pathname === "/user/selfie" || 
    pathname === "/user/selfie-debug" || 
    pathname === "/user/qr-scan";

  if (loading || !isActiveConfig || isDismissed || isExcludedPage) return null;

  return (
    <>
      {/* Dynamic Keyframes for a premium entrance and bell shake */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatIn {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes bellRing {
          0%, 100% { transform: rotate(0); }
          15% { transform: rotate(10deg); }
          30% { transform: rotate(-10deg); }
          45% { transform: rotate(5deg); }
          60% { transform: rotate(-5deg); }
          75% { transform: rotate(2deg); }
          90% { transform: rotate(-2deg); }
        }
        .animate-float-in {
          animation: floatIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-bell-ring {
          animation: bellRing 1.5s ease-in-out infinite;
          transform-origin: top center;
        }
      `}} />

      <div className="absolute top-4 left-4 right-4 z-[9999] animate-float-in select-none print:hidden">
        <div className="bg-[#1C3D3F]/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-lg border-l-4 border-[#2AB0B2] flex items-center justify-between gap-3 shadow-teal-950/20">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 bg-[#2AB0B2]/20 text-[#2AB0B2] rounded-xl flex-shrink-0 animate-bell-ring">
              <Bell size={16} className="stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#2AB0B2] mb-0.5 leading-none">
                Info Penggajian
              </p>
              <p className="text-xs font-semibold text-gray-100 leading-snug break-words">
                {noticeText}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer flex-shrink-0"
            aria-label="Tutup notifikasi"
          >
            <X size={14} className="stroke-[2.5]" />
          </button>
        </div>
      </div>
    </>
  );
}
