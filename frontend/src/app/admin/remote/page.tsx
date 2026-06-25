"use client";

import React, { useEffect, useState } from "react";
import { XCircle, CheckCircle, FileText, Eye, ShieldAlert, Clock } from "lucide-react";

interface RemoteRequest {
  id: string;
  user_id: string;
  nama_lengkap: string;
  tanggal: string;
  alasan: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  expired_at: string;
  report_content: string | null;
  report_attachment_url: string | null;
  report_submitted_at: string | null;
}

export default function AdminRemotePage() {
  const [requests, setRequests] = useState<RemoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Selected daily report preview modal state
  const [selectedReport, setSelectedReport] = useState<RemoteRequest | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/remote/requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error("Gagal memuat daftar remote working:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm("Apakah Anda yakin ingin membatalkan izin Remote Working ini?")) return;

    setCancellingId(requestId);
    try {
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) return;
      const adminUser = JSON.parse(storedUser);

      const res = await fetch(`/api/remote/requests/${requestId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: adminUser.id,
          role: "admin"
        })
      });

      if (res.ok) {
        await fetchRequests();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal membatalkan permohonan");
      }
    } catch (err) {
      alert("Gagal menghubungi server");
    } finally {
      setCancellingId(null);
    }
  };

  const isRequestActive = (req: RemoteRequest) => {
    if (req.status !== "APPROVED") return false;
    return new Date(req.expired_at).getTime() > Date.now();
  };

  const getStatusBadge = (req: RemoteRequest) => {
    if (req.status === "PENDING") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
          <Clock size={12} /> Pending
        </span>
      );
    }
    if (req.status === "APPROVED") {
      const active = isRequestActive(req);
      if (active) {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 animate-pulse">
            🟢 Aktif
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
          Expired (Selesai)
        </span>
      );
    }
    if (req.status === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
          Ditolak
        </span>
      );
    }
    if (req.status === "CANCELLED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
          Dibatalkan
        </span>
      );
    }
    return null;
  };

  const filteredRequests = requests.filter((req) => {
    // 1. Filter by search term
    const matchesSearch = req.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.alasan.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Filter by status selection
    if (filterStatus === "ALL") return matchesSearch;
    if (filterStatus === "PENDING") return req.status === "PENDING" && matchesSearch;
    if (filterStatus === "ACTIVE") return isRequestActive(req) && matchesSearch;
    if (filterStatus === "FINISHED") return req.status === "APPROVED" && !isRequestActive(req) && matchesSearch;
    if (filterStatus === "REJECTED") return req.status === "REJECTED" && matchesSearch;
    if (filterStatus === "CANCELLED") return req.status === "CANCELLED" && matchesSearch;

    return matchesSearch;
  });

  return (
    <div className="flex-1 bg-[#F0F2F5] p-4 md:p-8 select-none relative min-h-screen">
      {/* Daily Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-[#1C3D3F] flex items-center gap-2">
                <FileText className="text-indigo-600" /> Daily Report WFH
              </h3>
              <button 
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4 text-sm text-[#1C3D3F]">
              <div>
                <span className="text-xs uppercase font-bold text-gray-400 block">Karyawan</span>
                <span className="font-semibold text-base">{selectedReport.nama_lengkap}</span>
              </div>

              <div>
                <span className="text-xs uppercase font-bold text-gray-400 block">Tanggal Kerja</span>
                <span>
                  {new Date(selectedReport.tanggal).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>

              <div>
                <span className="text-xs uppercase font-bold text-gray-400 block">Laporan Pekerjaan</span>
                <div className="p-3 bg-muted rounded-xl border mt-1 whitespace-pre-wrap leading-relaxed text-gray-700 italic">
                  "{selectedReport.report_content}"
                </div>
              </div>

              {selectedReport.report_attachment_url && (
                <div>
                  <span className="text-xs uppercase font-bold text-gray-400 block mb-1">Lampiran Dokumen</span>
                  <a
                    href={selectedReport.report_attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold transition-all border border-indigo-200 text-xs"
                  >
                    <Eye size={14} /> Lihat / Download Lampiran
                  </a>
                </div>
              )}

              <div className="pt-2 text-xs text-gray-400 border-t flex justify-between">
                <span>Dikirim pada: {new Date(selectedReport.report_submitted_at!).toLocaleString("id-ID")}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedReport(null)}
              className="w-full mt-6 py-3 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl font-bold flex items-center justify-center cursor-pointer shadow-xs transition-colors text-sm"
            >
              Tutup Laporan
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1C3D3F]">Manajemen Remote Working</h1>
          <p className="text-xs text-gray-500 mt-1">Audit log pengajuan izin WFH dan monitoring laporan kerja harian</p>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100/50 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Cari nama karyawan atau alasan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-sm bg-gray-55/40 text-gray-700 transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
          {[
            { value: "ALL", label: "Semua" },
            { value: "PENDING", label: "Pending" },
            { value: "ACTIVE", label: "Aktif" },
            { value: "FINISHED", label: "Selesai" },
            { value: "REJECTED", label: "Ditolak" },
            { value: "CANCELLED", label: "Dibatalkan" }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              className={`py-2 px-3 rounded-xl font-bold text-xs cursor-pointer border transition-all ${
                filterStatus === tab.value
                  ? "bg-[#2AB0B2] text-white border-[#2AB0B2]"
                  : "bg-white text-gray-550 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* WFH Requests Main Table */}
      <div className="bg-white rounded-2xl shadow-xs overflow-hidden border border-gray-100/50">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                {["Karyawan", "Tanggal Kerja", "Alasan WFH", "Status", "Audit Persetujuan / Aksi", "Daily Report"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-gray-400 font-medium">
                    <div className="w-8 h-8 border-4 border-[#2AB0B2] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    Memuat data pengajuan...
                  </td>
                </tr>
              ) : filteredRequests.length > 0 ? (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="border-b border-gray-55 last:border-0 hover:bg-gray-50/30 transition-colors">
                    {/* Employee Profile */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{req.nama_lengkap}</div>
                      <div className="text-[10px] text-gray-400 font-mono">ID: {req.user_id}</div>
                    </td>

                    {/* Date of work */}
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                      {new Date(req.tanggal).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>

                    {/* Reason */}
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={req.alasan}>
                      {req.alasan}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4">
                      {getStatusBadge(req)}
                    </td>

                    {/* Audit Logs / Action Button */}
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {req.status === "APPROVED" && (
                        <div className="space-y-1">
                          <div>
                            <span className="font-semibold">Disetujui:</span> {req.approved_by || "Atasan"}
                          </div>
                          <div>
                            <span className="font-semibold">Waktu:</span> {req.approved_at ? new Date(req.approved_at).toLocaleString("id-ID") : "-"}
                          </div>
                          {isRequestActive(req) ? (
                            <div className="pt-2">
                              <button
                                onClick={() => handleCancelRequest(req.id)}
                                disabled={cancellingId === req.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg font-bold border border-red-200 transition-colors cursor-pointer"
                              >
                                <XCircle size={12} /> Batalkan WFH
                              </button>
                            </div>
                          ) : (
                            <div className="text-gray-450 italic">Sesi kerja telah berakhir pukul 04:00</div>
                          )}
                        </div>
                      )}

                      {req.status === "REJECTED" && (
                        <div className="space-y-0.5 text-red-600/90 bg-red-50/50 p-2 rounded-lg border border-red-100 max-w-[200px]">
                          <div><span className="font-bold">Ditolak:</span> {req.rejected_by || "Atasan"}</div>
                          <div><span className="font-bold">Waktu:</span> {req.rejected_at ? new Date(req.rejected_at).toLocaleString("id-ID") : "-"}</div>
                        </div>
                      )}

                      {req.status === "CANCELLED" && (
                        <div className="space-y-0.5 text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 max-w-[200px]">
                          <div><span className="font-bold">Batal oleh:</span> {req.cancelled_by ? `User (${req.cancelled_by})` : "Admin"}</div>
                          <div><span className="font-bold">Waktu:</span> {req.cancelled_at ? new Date(req.cancelled_at).toLocaleString("id-ID") : "-"}</div>
                        </div>
                      )}

                      {req.status === "PENDING" && (
                        <div className="space-y-1">
                          <span className="text-amber-600 font-semibold block">Menunggu Konfirmasi</span>
                          <button
                            onClick={() => handleCancelRequest(req.id)}
                            disabled={cancellingId === req.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg font-bold border border-red-100 transition-colors cursor-pointer"
                          >
                            Tolak / Batalkan
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Daily Report Audit Column */}
                    <td className="px-6 py-4">
                      {req.report_submitted_at ? (
                        <button
                          onClick={() => setSelectedReport(req)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold border border-indigo-200 transition-all text-xs cursor-pointer"
                        >
                          <FileText size={13} /> Lihat Report
                        </button>
                      ) : req.status === "APPROVED" ? (
                        <span className="text-xs text-amber-500 font-semibold italic flex items-center gap-1">
                          <Clock size={12} /> Belum dikirim
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-gray-400 font-semibold">
                    Tidak ditemukan data pengajuan remote working.
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
