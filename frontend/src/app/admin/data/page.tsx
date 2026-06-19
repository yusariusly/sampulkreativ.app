"use client";

import React, { useEffect, useState } from "react";
import { Search, Calendar, ChevronDown, Download, CheckCircle2, XCircle, Send } from "lucide-react";

const TEAL = "#2AB0B2";

const STATUS_STYLES: Record<string, string> = {
  Hadir: "bg-green-500 text-white",
  Libur: "bg-[#F6C13B] text-white",
  Alpa: "bg-red-500 text-white",
  Sakit: "bg-blue-500 text-white",
  Izin: "bg-orange-400 text-white",
  Pulang: "bg-indigo-600 text-white",
};

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  return (
    <span
      className={`rounded-full font-bold inline-block text-center select-none ${
        small ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm"
      } ${STATUS_STYLES[status] ?? "bg-gray-200 text-gray-700"}`}
    >
      {status}
    </span>
  );
}

export default function AdminDataPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Photo Audit Modal State
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedLogName, setSelectedLogName] = useState("");

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/attendance");
      if (res.ok) {
        const data = await res.json();
        setRows(data);
      }
    } catch (err) {
      console.error("Gagal memuat log absensi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const AVATAR_COLORS = [TEAL, "#F6C13B", "#10B981", "#3B82F6", "#6B7280", "#8B5CF6", "#F59E0B"];

  // Filter rows based on search query
  const filteredRows = rows.filter(
    (row) =>
      row.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (row.username && row.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      row.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString("id-ID", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + " WIB";
  };

  // Export to CSV Function
  const handleExportCSV = () => {
    if (filteredRows.length === 0) return;

    // Build CSV headers and rows
    const headers = ["ID", "Waktu Absen", "Username", "Nama Lengkap", "Latitude", "Longitude", "Status", "Manual Override"];
    const csvContent = [
      headers.join(","),
      ...filteredRows.map((r) =>
        [
          r.id,
          `"${new Date(r.waktu_absen).toLocaleString("id-ID")}"`,
          r.username || "",
          `"${r.nama_lengkap}"`,
          r.latitude || "null",
          r.longitude || "null",
          r.status,
          r.diubah_oleh_admin ? "True" : "False",
        ].join(",")
      ),
    ].join("\n");

    // Create file blob and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan-absensi-${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 bg-[#F0F2F5] p-6 md:p-10 select-none relative">
      {/* Photo View Modal Overlay */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl overflow-hidden max-w-sm w-full shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#1C3D3F] mb-4 text-center">Foto Kehadiran</h3>
            
            <div className="w-full aspect-[3/4] bg-gray-100 rounded-2xl overflow-hidden border mb-6 relative flex flex-col items-center justify-center p-6 text-center select-none">
              {selectedPhoto === "telegram" ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-[#2AB0B2]/10 flex items-center justify-center text-[#2AB0B2] mb-4">
                    <Send size={32} strokeWidth={2} />
                  </div>
                  <p className="font-bold text-gray-750 text-sm text-gray-700">Foto Dikirim ke Telegram</p>
                  <p className="text-xs text-gray-450 mt-1.5 leading-relaxed">
                    Sesuai pengaturan sistem, foto selfie kehadiran ini langsung diteruskan ke Telegram grup dan tidak disimpan di storage server.
                  </p>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedPhoto} alt="Selfie Kehadiran" className="w-full h-full object-cover" />
              )}
            </div>

            <p className="text-center text-sm font-semibold text-[#1C3D3F] mb-6">
              Karyawan: {selectedLogName}
            </p>

            <button
              onClick={() => setSelectedPhoto(null)}
              className="w-full py-3.5 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors text-sm"
            >
              Tutup Detail
            </button>
          </div>
        </div>
      )}

      {/* Header bar with controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#1C3D3F]">Data Absensi</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 w-full md:w-60 shadow-xs">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama / status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 outline-none text-sm text-gray-500 bg-transparent"
            />
          </div>
          
          {/* Date Picker Button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredRows.length === 0}
            className="flex items-center justify-center gap-2 bg-[#2AB0B2] text-white rounded-xl px-4 py-2.5 text-sm font-semibold shadow-xs hover:bg-[#209092] transition-colors cursor-pointer w-full md:w-auto disabled:opacity-50"
          >
            <Download size={16} />
            <span>Ekspor Laporan (CSV)</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-xs overflow-hidden border border-gray-100/50">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {["Waktu", "Nama", "Lokasi", "Foto", "Status"].map((h) => (
                  <th key={h} className="text-left px-6 py-4 text-sm font-semibold text-gray-700">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-sm text-gray-400 font-medium">
                    Memuat log absensi...
                  </td>
                </tr>
              ) : filteredRows.length > 0 ? (
                filteredRows.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/35 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                      {formatDateTime(r.waktu_absen)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                      {r.nama_lengkap}
                      {r.diubah_oleh_admin && (
                        <span className="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded ml-2 font-semibold text-[10px]">
                          Manual Override
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {r.latitude ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}` : "Tanpa GPS"}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          setSelectedPhoto(r.foto_url);
                          setSelectedLogName(r.nama_lengkap);
                        }}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs select-none cursor-pointer overflow-hidden border border-gray-100 hover:scale-105 transition-transform"
                        style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                        title="Lihat foto kehadiran"
                      >
                        {r.foto_url === "telegram" ? (
                          <div className="w-full h-full bg-[#2AB0B2]/10 flex items-center justify-center text-[#2AB0B2]">
                            <Send size={12} strokeWidth={2.5} />
                          </div>
                        ) : r.foto_url && r.foto_url !== "/uploads/placeholder.jpg" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.foto_url} alt="Selfie preview" className="w-full h-full object-cover" />
                        ) : (
                          r.nama_lengkap
                            .split(" ")
                            .map((w: string) => w[0])
                            .join("")
                            .slice(0, 2)
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={r.status} small />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-sm text-gray-400 font-medium">
                    Tidak ada log absensi yang cocok dengan kata kunci
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
