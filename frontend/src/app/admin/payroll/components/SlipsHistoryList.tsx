"use client";

import React, { useEffect, useState, useCallback } from "react";
import { History, Eye, CheckCircle2 } from "lucide-react";

interface Slip {
  id: string;
  user_id: string;
  username: string;
  nama_lengkap: string;
  periode: string;
  slip_no: string;
  tanggal_cetak: string;
  hari_kantor: number;
  hari_remote: number;
  hari_sakit: number;
  hari_izin: number;
  hari_alpha: number;
  gaji_pokok: number;
  tunjangan_makan: number;
  tunjangan_transport: number;
  potongan_alpha: number;
  potongan_sakit: number;
  potongan_izin: number;
  total_pendapatan: number;
  total_potongan: number;
  gaji_bersih: number;
  status: string;
  jabatan: string;
  bonus: number;
}

interface SlipsHistoryListProps {
  userId: string;
  refreshTrigger: number;
  onSelectSlip: (slip: Slip) => void;
}

export default function SlipsHistoryList({
  userId,
  refreshTrigger,
  onSelectSlip,
}: SlipsHistoryListProps) {
  const [slips, setSlips] = useState<Slip[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSlips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/slips?user_id=${userId}`);
      if (!res.ok) throw new Error("Gagal mengambil riwayat slip");
      const data = await res.json();
      setSlips(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSlips();
  }, [fetchSlips, refreshTrigger]);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs">
      <div className="flex items-center gap-2 mb-5 border-b border-gray-50 pb-3">
        <History size={18} className="text-[#2AB0B2]" />
        <h3 className="font-bold text-[#1C3D3F] text-base">Riwayat Slip Gaji</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-xs text-gray-400 font-medium">
          Memuat riwayat slip...
        </div>
      ) : slips.length === 0 ? (
        <div className="text-center py-8 text-xs text-gray-400 font-semibold">
          Belum ada slip gaji yang pernah diterbitkan untuk karyawan ini.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-bold">
                <th className="py-3 px-2">Periode</th>
                <th className="py-3 px-2">Nomor Slip</th>
                <th className="py-3 px-2 text-right">Gaji Bersih</th>
                <th className="py-3 px-2 text-center">Status</th>
                <th className="py-3 px-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-medium text-slate-700">
              {slips.map((slip) => (
                <tr key={slip.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-2 font-bold text-slate-800">{slip.periode}</td>
                  <td className="py-3 px-2 text-slate-500 font-mono">{slip.slip_no}</td>
                  <td className="py-3 px-2 text-right font-extrabold text-[#1C3D3F]">
                    {formatRupiah(slip.gaji_bersih)}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-150">
                      <CheckCircle2 size={10} />
                      {slip.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <button
                      onClick={() => onSelectSlip(slip)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2AB0B2]/10 hover:bg-[#2AB0B2]/20 text-[#209092] rounded-lg text-[10px] font-bold cursor-pointer transition-colors active:scale-95"
                    >
                      <Eye size={12} />
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
