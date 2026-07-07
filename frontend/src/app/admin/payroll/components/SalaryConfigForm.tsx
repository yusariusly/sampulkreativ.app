"use client";

import React, { useState, useEffect } from "react";
import { Edit3, Save, CheckCircle } from "lucide-react";

interface Employee {
  user_id: string;
  username: string;
  nama_lengkap: string;
  role: string;
  gaji_pokok: number;
  tunjangan_makan: number;
  tunjangan_transport: number;
  potongan_alpha: number;
  jabatan: string;
  bonus: number;
}

interface SalaryConfigFormProps {
  employee: Employee;
  onSaveSuccess: () => void;
}

export default function SalaryConfigForm({
  employee,
  onSaveSuccess,
}: SalaryConfigFormProps) {
  const [jabatan, setJabatan] = useState("");
  const [gajiPokok, setGajiPokok] = useState(0);
  const [tunjanganMakan, setTunjanganMakan] = useState(0);
  const [tunjanganTransport, setTunjanganTransport] = useState(0);
  const [bonus, setBonus] = useState(0);
  
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Sync state with selected employee
  useEffect(() => {
    setJabatan(employee.jabatan || "Karyawan");
    setGajiPokok(Number(employee.gaji_pokok) || 0);
    setTunjanganMakan(Number(employee.tunjangan_makan) || 0);
    setTunjanganTransport(Number(employee.tunjangan_transport) || 0);
    setBonus(Number(employee.bonus) || 0);
    setSuccess(false);
    setErrorMsg("");
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccess(false);

    try {
      const res = await fetch("/api/payroll/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: employee.user_id,
          gaji_pokok: gajiPokok,
          tunjangan_makan: tunjanganMakan,
          tunjangan_transport: tunjanganTransport,
          potongan_alpha: gajiPokok,
          jabatan: jabatan,
          bonus: bonus,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        onSaveSuccess();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setErrorMsg(data.error || "Gagal menyimpan konfigurasi");
      }
    } catch (err) {
      setErrorMsg("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  };

  const formatDotNumber = (num: number): string => {
    if (num === 0) return "0";
    return new Intl.NumberFormat("id-ID").format(num);
  };

  const parseDotNumber = (str: string): number => {
    const clean = str.replace(/\./g, "");
    return Math.max(0, parseInt(clean) || 0);
  };

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  const estimasiBulanan = 22 * (gajiPokok + tunjanganMakan + tunjanganTransport) + bonus;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs relative">
      <div className="flex items-center gap-2 mb-5 border-b border-gray-50 pb-3">
        <Edit3 size={18} className="text-[#2AB0B2]" />
        <h3 className="font-bold text-[#1C3D3F] text-base">Konfigurasi Finansial</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Jabatan */}
        <div>
          <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
            Jabatan
          </label>
          <input
            type="text"
            value={jabatan}
            onChange={(e) => setJabatan(e.target.value)}
            placeholder="Contoh: Senior Developer"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-xs text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gaji Pokok */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
              Gaji Pokok / Hari (Rp)
            </label>
            <input
              type="text"
              value={formatDotNumber(gajiPokok)}
              onChange={(e) => setGajiPokok(parseDotNumber(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-xs text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all"
              required
            />
          </div>

          {/* Bonus Default */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
              Bonus Rutin (Rp)
            </label>
            <input
              type="text"
              value={formatDotNumber(bonus)}
              onChange={(e) => setBonus(parseDotNumber(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-xs text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tunjangan Makan */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
              Tunj. Makan / Hari (WFO)
            </label>
            <input
              type="text"
              value={formatDotNumber(tunjanganMakan)}
              onChange={(e) => setTunjanganMakan(parseDotNumber(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-xs text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all"
              required
            />
          </div>
 
          {/* Tunjangan Transport */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
              Tunj. Transport / Hari (WFO)
            </label>
            <input
              type="text"
              value={formatDotNumber(tunjanganTransport)}
              onChange={(e) => setTunjanganTransport(parseDotNumber(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-xs text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all"
              required
            />
          </div>
        </div>

        {/* Estimasi Hasil Akhir Bulanan */}
        <div className="bg-[#1C3D3F]/5 border border-slate-100 p-4 rounded-xl flex items-center justify-between text-xs mt-3 select-none">
          <div>
            <p className="font-bold text-[#1C3D3F] text-[13px]">Estimasi Hasil Akhir Bulanan (22 Hari)</p>
            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Asumsi 22 hari kerja (Senin-Jumat) full masuk tanpa alpa</p>
          </div>
          <div className="text-right">
            <span className="text-base font-black text-[#2AB0B2]">{formatRupiah(estimasiBulanan)}</span>
          </div>
        </div>

        {/* Rincian Pemotongan Harian Otomatis */}
        <div className="bg-rose-50/20 border border-rose-100/30 p-4 rounded-xl space-y-2 text-xs select-none">
          <p className="font-bold text-rose-800 text-[11px] uppercase tracking-wide">Rincian Pemotongan Harian Otomatis</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-gray-400 font-semibold">Potongan Alpa / Hari (Gaji Pokok)</p>
              <p className="text-xs font-bold text-rose-600 mt-0.5">{formatRupiah(gajiPokok)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold">Potongan Sakit & Izin / Hari (Makan + Transport)</p>
              <p className="text-xs font-bold text-rose-600 mt-0.5">{formatRupiah(tunjanganMakan + tunjanganTransport)}</p>
            </div>
          </div>
        </div>

        {/* Feedback Messages */}
        {success && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 p-3.5 rounded-xl animate-fadeIn">
            <CheckCircle size={14} />
            <span>Konfigurasi gaji berhasil diperbarui!</span>
          </div>
        )}

        {errorMsg && (
          <div className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-150 p-3.5 rounded-xl">
            {errorMsg}
          </div>
        )}

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50 active:scale-97"
          >
            <Save size={14} />
            {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
          </button>
        </div>
      </form>
    </div>
  );
}
