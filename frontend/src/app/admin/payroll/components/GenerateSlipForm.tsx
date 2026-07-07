"use client";

import React, { useState, useEffect } from "react";
import { Calculator, Play, RefreshCw } from "lucide-react";

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

interface GenerateSlipFormProps {
  employee: Employee;
  onPreviewRequested: (slipDetails: any) => void;
}

export default function GenerateSlipForm({
  employee,
  onPreviewRequested,
}: GenerateSlipFormProps) {
  const bulanNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  
  // Calculations state
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);
  
  // Attendance metrics
  const [hariKantor, setHariKantor] = useState(0);
  const [hariRemote, setHariRemote] = useState(0);
  const [hariSakit, setHariSakit] = useState(0);
  const [hariIzin, setHariIzin] = useState(0);
  const [hariAlpha, setHariAlpha] = useState(0);

  // Editable earnings/deductions
  const [gajiPokok, setGajiPokok] = useState(0);
  const [tunjanganMakan, setTunjanganMakan] = useState(0);
  const [tunjanganTransport, setTunjanganTransport] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [potonganAlpha, setPotonganAlpha] = useState(0);
  const [potonganSakit, setPotonganSakit] = useState(0);
  const [potonganIzin, setPotonganIzin] = useState(0);

  // Sync basic numbers on change of employee
  useEffect(() => {
    setCalculated(false);
  }, [employee, selectedMonth, selectedYear]);

  const handleCalculateAttendance = async () => {
    setLoading(true);
    setCalculated(false);
    
    try {
      const res = await fetch(`/api/attendance?user_id=${employee.user_id}`);
      if (!res.ok) throw new Error("Gagal mengambil log absensi");
      const logs = await res.json();

      const dailyStatus: Record<string, string> = {};
      
      logs.forEach((log: any) => {
        const d = new Date(log.waktu_absen);
        if (d.getFullYear() === selectedYear && d.getMonth() === selectedMonth) {
          const key = d.toISOString().split("T")[0];
          const st = log.status;
          if (!dailyStatus[key]) {
            dailyStatus[key] = st;
          } else {
            const cur = dailyStatus[key];
            if (st === "Hadir" || st === "Terlambat") dailyStatus[key] = "Hadir";
            else if (st === "Remote" && cur !== "Hadir" && cur !== "Terlambat") dailyStatus[key] = "Remote";
          }
        }
      });

      let kantor = 0, remote = 0, sakit = 0, izin = 0, alpa = 0;
      Object.values(dailyStatus).forEach((st) => {
        if (st === "Hadir" || st === "Terlambat") kantor++;
        else if (st === "Remote") remote++;
        else if (st === "Sakit") sakit++;
        else if (st === "Izin") izin++;
        else if (st === "Alpa") alpa++;
      });

      setHariKantor(kantor);
      setHariRemote(remote);
      setHariSakit(sakit);
      setHariIzin(izin);
      setHariAlpha(alpa);

      // Pre-fill calculation values based on user configuration and formulas
      const gp = (kantor + remote + sakit + izin) * Number(employee.gaji_pokok);
      const makan = (kantor + remote + sakit) * Number(employee.tunjangan_makan);
      const transport = (kantor + remote + sakit) * Number(employee.tunjangan_transport);
      const bns = Number(employee.bonus || 0);
      const alphaDed = alpa * Number(employee.potongan_alpha);

      setGajiPokok(gp);
      setTunjanganMakan(makan);
      setTunjanganTransport(transport);
      setBonus(bns);
      setPotonganAlpha(alphaDed);
      setPotonganSakit(0);
      setPotonganIzin(0);

      setCalculated(true);
    } catch (err) {
      console.error(err);
      alert("Gagal menghitung absensi karyawan.");
    } finally {
      setLoading(false);
    }
  };

  const totalPendapatan = gajiPokok + tunjanganMakan + tunjanganTransport + bonus;
  const totalPotongan = potonganAlpha + potonganSakit + potonganIzin;
  const gajiBersih = totalPendapatan - totalPotongan;

  const handleRequestPreview = () => {
    const formattedMonth = bulanNames[selectedMonth];
    const slipDetails = {
      user_id: employee.user_id,
      nama_lengkap: employee.nama_lengkap,
      jabatan: employee.jabatan || "Karyawan",
      periode: `${formattedMonth} ${selectedYear}`,
      periode_month: selectedMonth + 1,
      periode_year: selectedYear,
      hari_kantor: hariKantor,
      hari_remote: hariRemote,
      hari_sakit: hariSakit,
      hari_izin: hariIzin,
      hari_alpha: hariAlpha,
      gaji_pokok: gajiPokok,
      tunjangan_makan: tunjanganMakan,
      tunjangan_transport: tunjanganTransport,
      bonus: bonus,
      potongan_alpha: potonganAlpha,
      potongan_sakit: potonganSakit,
      potongan_izin: potonganIzin,
      total_pendapatan: totalPendapatan,
      total_potongan: totalPotongan,
      gaji_bersih: gajiBersih,
    };
    onPreviewRequested(slipDetails);
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

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs">
      <div className="flex items-center gap-2 mb-5 border-b border-gray-50 pb-3">
        <Calculator size={18} className="text-[#2AB0B2]" />
        <h3 className="font-bold text-[#1C3D3F] text-base">Generate Slip Gaji</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Month Selector */}
        <div>
          <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
            Bulan
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-xs text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all cursor-pointer"
          >
            {bulanNames.map((name, index) => (
              <option key={index} value={index}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Year Selector */}
        <div>
          <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
            Tahun
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-xs text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all cursor-pointer"
          >
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-start mb-6">
        <button
          onClick={handleCalculateAttendance}
          disabled={loading}
          className="px-5 py-2.5 bg-[#1C3D3F] hover:bg-[#153032] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          {loading ? "Menghitung Absensi..." : "Hitung Absensi Bulan Terpilih"}
        </button>
      </div>

      {calculated && (
        <div className="space-y-6 pt-2 border-t border-dashed border-gray-100 animate-fadeIn">
          {/* Attendance Stats Cards */}
          <div>
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2.5">
              Rekap Log Kehadiran ({bulanNames[selectedMonth]} {selectedYear})
            </h4>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-slate-50 border border-gray-150/50 p-2.5 rounded-xl">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Kantor</p>
                <p className="text-xs font-extrabold text-[#1C3D3F] mt-1">{hariKantor} H</p>
              </div>
              <div className="bg-slate-50 border border-gray-150/50 p-2.5 rounded-xl">
                <p className="text-[9px] font-bold text-gray-400 uppercase">WFH</p>
                <p className="text-xs font-extrabold text-[#1C3D3F] mt-1">{hariRemote} H</p>
              </div>
              <div className="bg-slate-50 border border-gray-150/50 p-2.5 rounded-xl">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Sakit</p>
                <p className="text-xs font-extrabold text-rose-500 mt-1">{hariSakit} H</p>
              </div>
              <div className="bg-slate-50 border border-gray-150/50 p-2.5 rounded-xl">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Izin</p>
                <p className="text-xs font-extrabold text-amber-500 mt-1">{hariIzin} H</p>
              </div>
              <div className="bg-slate-50 border border-gray-150/50 p-2.5 rounded-xl">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Alpha</p>
                <p className="text-xs font-extrabold text-red-500 mt-1">{hariAlpha} H</p>
              </div>
            </div>
          </div>

          {/* Earnings / Deductions Editor Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings */}
            <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-gray-100">
              <h5 className="font-extrabold text-[#2AB0B2] text-[10px] uppercase tracking-wider mb-2">
                Rincian Pendapatan
              </h5>
              
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-semibold">Gaji Pokok ({hariKantor + hariRemote + hariSakit + hariIzin} Hari):</span>
                  <span className="font-bold text-slate-800">{formatRupiah(gajiPokok)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-semibold">Tunjangan Makan ({hariKantor + hariRemote + hariSakit} Hari):</span>
                  <span className="font-bold text-slate-800">{formatRupiah(tunjanganMakan)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-semibold">Tunjangan Transport ({hariKantor + hariRemote + hariSakit} Hari):</span>
                  <span className="font-bold text-slate-800">{formatRupiah(tunjanganTransport)}</span>
                </div>
                
                {/* Editable Bonus Input */}
                <div className="pt-2 border-t border-gray-150/80 flex items-center justify-between">
                  <label className="text-gray-500 font-semibold">Bonus Kinerja (Rp):</label>
                  <input
                    type="text"
                    value={formatDotNumber(bonus)}
                    onChange={(e) => setBonus(parseDotNumber(e.target.value))}
                    className="w-28 px-2.5 py-1 rounded-lg border border-gray-200 focus:border-[#2AB0B2] outline-none text-[11px] text-right font-bold text-emerald-600 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-gray-100">
              <h5 className="font-extrabold text-rose-500 text-[10px] uppercase tracking-wider mb-2">
                Rincian Potongan
              </h5>

              <div className="space-y-2.5 text-xs">
                {/* Editable Alpha deduction */}
                <div className="flex items-center justify-between">
                  <label className="text-gray-500 font-semibold">Potongan Alpha ({hariAlpha} Hari):</label>
                  <input
                    type="text"
                    value={formatDotNumber(potonganAlpha)}
                    onChange={(e) => setPotonganAlpha(parseDotNumber(e.target.value))}
                    className="w-28 px-2.5 py-1 rounded-lg border border-gray-200 focus:border-[#2AB0B2] outline-none text-[11px] text-right font-bold text-slate-700 bg-white"
                  />
                </div>
                
                {/* Editable Sakit deduction */}
                <div className="flex items-center justify-between">
                  <label className="text-gray-500 font-semibold">Potongan Sakit ({hariSakit} Hari):</label>
                  <input
                    type="text"
                    value={formatDotNumber(potonganSakit)}
                    onChange={(e) => setPotonganSakit(parseDotNumber(e.target.value))}
                    className="w-28 px-2.5 py-1 rounded-lg border border-gray-200 focus:border-[#2AB0B2] outline-none text-[11px] text-right font-bold text-slate-700 bg-white"
                  />
                </div>

                {/* Editable Izin deduction */}
                <div className="flex items-center justify-between">
                  <label className="text-gray-500 font-semibold">Potongan Izin ({hariIzin} Hari):</label>
                  <input
                    type="text"
                    value={formatDotNumber(potonganIzin)}
                    onChange={(e) => setPotonganIzin(parseDotNumber(e.target.value))}
                    className="w-28 px-2.5 py-1 rounded-lg border border-gray-200 focus:border-[#2AB0B2] outline-none text-[11px] text-right font-bold text-slate-700 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Clean Total net summary and Action */}
          <div className="bg-[#1C3D3F] text-white p-4.5 rounded-2xl flex justify-between items-center shadow-xs">
            <div>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Estimasi Gaji Bersih</p>
              <p className="text-lg font-black text-[#2AB0B2] mt-0.5">{formatRupiah(gajiBersih)}</p>
            </div>
            <div>
              <button
                onClick={handleRequestPreview}
                className="px-5 py-2.5 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-97"
              >
                Pratinjau Slip Resmi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
