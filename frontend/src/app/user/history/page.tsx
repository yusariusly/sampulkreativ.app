"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  Hadir: "bg-green-500 text-white shadow-xs",
  Libur: "bg-[#F6C13B] text-white shadow-xs",
  Alpa: "bg-red-500 text-white shadow-xs",
  Sakit: "bg-blue-500 text-white shadow-xs",
  Izin: "bg-orange-400 text-white shadow-xs",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full font-bold px-3 py-1 text-xs select-none ${
        STATUS_STYLES[status] ?? "bg-gray-200 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (typeof window === "undefined") return;
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) {
        router.push("/");
        return;
      }

      try {
        const userObj = JSON.parse(storedUser);
        const res = await fetch(`/api/attendance?user_id=${userObj.id}`);
        if (res.ok) {
          const data = await res.json();
          setRecords(data);
        }
      } catch (err) {
        console.error("Gagal mengambil riwayat absensi:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [router]);

  const formatRecordDate = (isoString: string) => {
    const d = new Date(isoString);
    const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const MONTHS = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatRecordTime = (isoString: string) => {
    const d = new Date(isoString);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm} WIB`;
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F2F5]">
      {/* Header Panel */}
      <div className="flex items-center justify-center gap-2.5 py-5 px-5 select-none bg-[#2AB0B2] shadow-sm">
        <Calendar size={20} color="white" />
        <h1 className="text-white font-bold text-lg">Riwayat Absensi</h1>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400 font-medium bg-white rounded-2xl border border-gray-100">
            Memuat riwayat kehadiran...
          </div>
        ) : records.length > 0 ? (
          records.map((r, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-xs px-5 py-4 flex items-center justify-between border border-gray-100/50 hover:bg-gray-50/50 transition-colors"
            >
              <div>
                <p className="font-bold text-gray-800 text-sm leading-snug">
                  {formatRecordDate(r.waktu_absen)}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  {formatRecordTime(r.waktu_absen)}
                  {r.diubah_oleh_admin && (
                    <span className="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded ml-1.5 font-semibold text-[10px]">
                      Manual Override
                    </span>
                  )}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-sm text-gray-400 font-medium bg-white rounded-2xl border border-gray-100">
            Belum ada rekaman kehadiran
          </div>
        )}
      </div>
    </div>
  );
}
