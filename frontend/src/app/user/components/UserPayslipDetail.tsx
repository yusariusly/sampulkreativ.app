"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Download, CreditCard, Calendar, ShieldCheck, RefreshCw } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface PayrollSlip {
  id: number;
  periode: string;
  nama_lengkap: string;
  jabatan: string;
  slip_no: string;
  tanggal_cetak?: string;
  gaji_pokok: number;
  tunjangan_makan: number;
  tunjangan_transport: number;
  bonus: number;
  total_pendapatan: number;
  potongan_sakit: number;
  potongan_izin: number;
  potongan_alpha: number;
  total_potongan: number;
  hari_kantor: number;
  hari_remote: number;
  hari_sakit: number;
  hari_izin: number;
  hari_alpha: number;
  gaji_bersih: number;
  status: string;
}

interface UserPayslipDetailProps {
  slip: PayrollSlip;
  onBack: () => void;
}

export default function UserPayslipDetail({ slip, onBack }: UserPayslipDetailProps) {
  const [activeSegment, setActiveSegment] = useState<"pendapatan" | "potongan">("pendapatan");
  const [downloading, setDownloading] = useState(false);
  const [approver, setApprover] = useState({ name: "M. Firas Faisal", role: "Direktur Utama" });

  // Fetch approver details to match admin settings
  useEffect(() => {
    const fetchApprover = async () => {
      try {
        const res = await fetch("/api/payroll/approver");
        if (res.ok) {
          const data = await res.json();
          if (data.name && data.role) {
            setApprover({ name: data.name, role: data.role });
          }
        }
      } catch (err) {
        console.error("Gagal memuat info penyetuju", err);
      }
    };
    fetchApprover();
  }, []);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  const displayCetakDate = slip.tanggal_cetak
    ? new Date(slip.tanggal_cetak).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

  const handleDownloadPDF = async () => {
    setDownloading(true);
    const element = document.getElementById("payslip-print-area-user");
    if (!element) {
      setDownloading(false);
      return;
    }

    try {
      // Temporarily remove hidden classes for canvas rendering
      element.style.display = "block";
      element.style.position = "static";
      element.style.visibility = "visible";

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // Restore styling
      element.style.display = "none";
      element.style.position = "fixed";
      element.style.visibility = "hidden";

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 5, imgWidth, imgHeight);
      pdf.save(`Slip_Gaji_${slip.nama_lengkap.replace(/\s+/g, "_")}_${slip.periode.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Gagal mengekspor PDF.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 text-[#1C3D3F] select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#2AB0B2] transition-colors"
        >
          <ArrowLeft size={16} />
          Kembali
        </button>
        <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
          {slip.status}
        </span>
      </div>

      {/* Slip Metadata Card */}
      <div className="bg-[#1C3D3F] text-white rounded-3xl p-4 shadow-sm relative overflow-hidden mb-4">
        <div className="absolute right-[-10px] bottom-[-15px] opacity-10 text-white">
          <CreditCard size={120} />
        </div>
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            <Calendar size={12} className="text-[#2AB0B2]" />
            Periode: {slip.periode}
          </div>
          <h4 className="text-sm font-black tracking-wide text-white">{slip.nama_lengkap}</h4>
          <p className="text-xs text-slate-300 font-semibold">{slip.jabatan}</p>
          <p className="text-[9px] text-slate-400 font-medium tracking-wide font-mono pt-1">{slip.slip_no}</p>
        </div>
      </div>

      {/* Segmented Controller (Tabs) */}
      <div className="bg-slate-100 p-1 rounded-xl flex gap-1 mb-4">
        <button
          onClick={() => setActiveSegment("pendapatan")}
          className={`flex-1 py-2 text-center text-xs font-extrabold rounded-lg transition-all ${
            activeSegment === "pendapatan"
              ? "bg-white text-[#1C3D3F] shadow-xs"
              : "text-gray-500 hover:text-slate-700"
          }`}
        >
          Pendapatan
        </button>
        <button
          onClick={() => setActiveSegment("potongan")}
          className={`flex-1 py-2 text-center text-xs font-extrabold rounded-lg transition-all ${
            activeSegment === "potongan"
              ? "bg-white text-[#1C3D3F] shadow-xs"
              : "text-gray-500 hover:text-slate-700"
          }`}
        >
          Potongan & Kehadiran
        </button>
      </div>

      {/* Dynamic Compact Details Container (Fits in screen, no scroll) */}
      <div className="flex-1 bg-white border border-gray-150/65 p-4 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
        <div className="space-y-4">
          {activeSegment === "pendapatan" ? (
            <div className="space-y-3">
              <h5 className="font-extrabold text-[#2AB0B2] text-[10px] uppercase tracking-wider border-b border-gray-50 pb-1">
                Rincian Pendapatan
              </h5>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-semibold">Gaji Pokok:</span>
                  <span className="font-bold text-slate-800">{formatRupiah(slip.gaji_pokok)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-semibold">Tunjangan Makan:</span>
                  <span className="font-bold text-slate-800">{formatRupiah(slip.tunjangan_makan)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-semibold">Tunjangan Transport:</span>
                  <span className="font-bold text-slate-800">{formatRupiah(slip.tunjangan_transport)}</span>
                </div>
                {slip.bonus > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold font-medium">Bonus Kinerja:</span>
                    <span className="font-bold text-emerald-600">{formatRupiah(slip.bonus)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2.5 border-t border-dashed border-gray-150 font-black text-[#1C3D3F]">
                  <span>Total Pendapatan:</span>
                  <span>{formatRupiah(slip.total_pendapatan)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Potongan */}
              <div className="space-y-3">
                <h5 className="font-extrabold text-rose-500 text-[10px] uppercase tracking-wider border-b border-gray-50 pb-1">
                  Rincian Potongan
                </h5>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">Potongan Sakit:</span>
                    <span className="font-bold text-slate-800">{formatRupiah(slip.potongan_sakit)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">Potongan Izin:</span>
                    <span className="font-bold text-slate-800">{formatRupiah(slip.potongan_izin)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">Potongan Mangkir (Alpha):</span>
                    <span className="font-bold text-slate-800">{formatRupiah(slip.potongan_alpha)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2.5 border-t border-dashed border-gray-150 font-black text-rose-600">
                    <span>Total Potongan:</span>
                    <span>-{formatRupiah(slip.total_potongan)}</span>
                  </div>
                </div>
              </div>

              {/* Attendance Stats */}
              <div className="space-y-2">
                <h5 className="font-extrabold text-slate-400 text-[10px] uppercase tracking-wider border-b border-gray-50 pb-1">
                  Ringkasan Kehadiran
                </h5>
                <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-bold">
                  <div className="bg-slate-50 border border-gray-150/40 p-1.5 rounded-lg">
                    <p className="text-gray-400 text-[8px] uppercase">WFO</p>
                    <p className="text-[#1C3D3F] mt-0.5">{slip.hari_kantor}H</p>
                  </div>
                  <div className="bg-slate-50 border border-gray-150/40 p-1.5 rounded-lg">
                    <p className="text-gray-400 text-[8px] uppercase">WFH</p>
                    <p className="text-[#1C3D3F] mt-0.5">{slip.hari_remote}H</p>
                  </div>
                  <div className="bg-slate-50 border border-gray-150/40 p-1.5 rounded-lg">
                    <p className="text-gray-400 text-[8px] uppercase">Sakit</p>
                    <p className="text-rose-600 mt-0.5">{slip.hari_sakit}H</p>
                  </div>
                  <div className="bg-slate-50 border border-gray-150/40 p-1.5 rounded-lg">
                    <p className="text-gray-400 text-[8px] uppercase">Izin</p>
                    <p className="text-amber-600 mt-0.5">{slip.hari_izin}H</p>
                  </div>
                  <div className="bg-slate-50 border border-gray-150/40 p-1.5 rounded-lg">
                    <p className="text-gray-400 text-[8px] uppercase">Alfa</p>
                    <p className="text-red-500 mt-0.5">{slip.hari_alpha}H</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Gaji Bersih & Download Button */}
        <div className="pt-3 mt-3 border-t border-gray-100 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-gray-400 font-semibold">Total Pendapatan:</span>
            <span className="font-bold text-slate-700">{formatRupiah(slip.total_pendapatan)}</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-gray-400 font-semibold">Total Potongan:</span>
            <span className="font-bold text-rose-500">-{formatRupiah(slip.total_potongan)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-150">
            <span className="text-xs font-black text-[#1C3D3F]">Gaji Bersih Diterima</span>
            <span className="text-sm font-black text-[#2AB0B2]">{formatRupiah(slip.gaji_bersih)}</span>
          </div>

          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="w-full py-2.5 bg-[#2AB0B2] hover:bg-[#209092] disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs active:scale-[0.98] mt-1"
          >
            {downloading ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {downloading ? "Mengekspor PDF..." : "Unduh Slip Gaji (PDF)"}
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* HIDDEN OFFICIAL PRINT LAYOUT FOR PDF EXPORT */}
      {/* ========================================== */}
      <div
        id="payslip-print-area-user"
        style={{
          display: "none",
          position: "fixed",
          left: "-9999px",
          top: "0",
          width: "794px", // standard A4 width
          padding: "40px",
          backgroundColor: "#ffffff",
          fontFamily: "Courier, monospace",
          color: "#000000",
          boxSizing: "border-box",
        }}
      >
        {/* Kop Surat */}
        <div style={{ textAlign: "center", marginBottom: "20px", borderBottom: "2px solid #000", paddingBottom: "10px" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "900", letterSpacing: "1px" }}>SAMPUL KREATIV</h2>
          <p style={{ margin: "2px 0 0 0", fontSize: "10px" }}>
            Gd. BITC Lt.3, Jl. HMS Mintareja Sarjana Hukum, Baros
          </p>
          <p style={{ margin: "1px 0 0 0", fontSize: "10px" }}>
            Kec. Cimahi Tengah, Kota Cimahi, Jawa Barat 40521
          </p>
          <p style={{ margin: "1px 0 0 0", fontSize: "10px" }}>
            Email: contact@sampulkreativ.id, Web: sampulkreativ.id
          </p>
        </div>

        {/* Judul Slip */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ border: "1px solid #000", padding: "6px", display: "inline-block", fontWeight: "bold", fontSize: "12px", width: "100%" }}>
            SLIP GAJI KARYAWAN
          </div>
        </div>

        {/* Informasi Karyawan */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "10px", marginBottom: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "130px 10px 1fr" }}>
            <span>Nama Karyawan</span>
            <span>:</span>
            <span style={{ fontWeight: "bold" }}>{slip.nama_lengkap}</span>

            <span>Jabatan</span>
            <span>:</span>
            <span>{slip.jabatan}</span>

            <span>Periode</span>
            <span>:</span>
            <span style={{ fontWeight: "bold" }}>{slip.periode}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "100px 10px 1fr" }}>
            <span>Slip No</span>
            <span>:</span>
            <span>{slip.slip_no}</span>

            <span>Tanggal Cetak</span>
            <span>:</span>
            <span>{displayCetakDate}</span>
          </div>
        </div>

        {/* Tabel Slip Resmi */}
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: "9px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #000", backgroundColor: "#f2f2f2", fontWeight: "bold" }}>
              <th style={{ borderRight: "1px solid #000", padding: "6px", textAlign: "left", width: "25%" }} colSpan={2}>
                DATA ABSENSI
              </th>
              <th style={{ borderRight: "1px solid #000", padding: "6px", textAlign: "left", width: "40%" }}>
                PENDAPATAN
              </th>
              <th style={{ padding: "6px", textAlign: "left", width: "35%" }}>
                POTONGAN
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ borderRight: "1px solid #000", padding: "6px", textAlign: "left" }}>Hari Masuk Kantor</td>
              <td style={{ borderRight: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>{slip.hari_kantor}</td>
              <td style={{ borderRight: "1px solid #000", padding: "6px", display: "flex", justifyContent: "space-between" }}>
                <span>Gaji Pokok</span>
                <span style={{ fontWeight: "bold" }}>{formatRupiah(slip.gaji_pokok)}</span>
              </td>
              <td style={{ padding: "6px", display: "flex", justifyContent: "space-between" }}>
                <span>Tanpa Keterangan</span>
                <span style={{ fontWeight: "bold" }}>{formatRupiah(slip.potongan_alpha)}</span>
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ borderRight: "1px solid #000", padding: "6px", textAlign: "left" }}>Hari Masuk Remote</td>
              <td style={{ borderRight: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>{slip.hari_remote}</td>
              <td style={{ borderRight: "1px solid #000", padding: "6px", display: "flex", justifyContent: "space-between" }}>
                <span>Tunjangan Makan</span>
                <span style={{ fontWeight: "bold" }}>{formatRupiah(slip.tunjangan_makan)}</span>
              </td>
              <td style={{ padding: "6px", display: "flex", justifyContent: "space-between" }}>
                <span>Sakit</span>
                <span style={{ fontWeight: "bold" }}>{formatRupiah(slip.potongan_sakit)}</span>
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ borderRight: "1px solid #000", padding: "6px", textAlign: "left" }}>Total Hari Bekerja</td>
              <td style={{ borderRight: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: "bold" }}>{slip.hari_kantor + slip.hari_remote}</td>
              <td style={{ borderRight: "1px solid #000", padding: "6px", display: "flex", justifyContent: "space-between" }}>
                <span>Tunjangan Transport</span>
                <span style={{ fontWeight: "bold" }}>{formatRupiah(slip.tunjangan_transport)}</span>
              </td>
              <td style={{ padding: "6px", display: "flex", justifyContent: "space-between" }}>
                <span>Izin</span>
                <span style={{ fontWeight: "bold" }}>{formatRupiah(slip.potongan_izin)}</span>
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid #000" }}>
              <td style={{ borderRight: "1px solid #000", padding: "6px" }}></td>
              <td style={{ borderRight: "1px solid #000", padding: "6px" }}></td>
              <td style={{ borderRight: "1px solid #000", padding: "6px", display: "flex", justifyContent: "space-between" }}>
                <span>Bonus Kinerja</span>
                <span style={{ fontWeight: "bold", color: "#16a34a" }}>{formatRupiah(slip.bonus)}</span>
              </td>
              <td style={{ padding: "6px" }}></td>
            </tr>
            {/* Subtotal */}
            <tr style={{ borderBottom: "1px solid #000", fontWeight: "bold", backgroundColor: "#fbfbfb" }}>
              <td style={{ borderRight: "1px solid #000", padding: "6px" }} colSpan={2}></td>
              <td style={{ borderRight: "1px solid #000", padding: "6px", display: "flex", justifyContent: "space-between" }}>
                <span>Total Pendapatan</span>
                <span>{formatRupiah(slip.total_pendapatan)}</span>
              </td>
              <td style={{ padding: "6px", display: "flex", justifyContent: "space-between" }}>
                <span>Total Potongan</span>
                <span style={{ color: "#dc2626" }}>-{formatRupiah(slip.total_potongan)}</span>
              </td>
            </tr>
            {/* Gaji Bersih */}
            <tr style={{ fontWeight: "900", fontSize: "10px", backgroundColor: "#f4f4f5" }}>
              <td style={{ padding: "6px" }} colSpan={2}></td>
              <td style={{ border: "1px solid #000", padding: "6px" }}>
                GAJI BERSIH DITERIMA
              </td>
              <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right", color: "#1C3D3F" }}>
                {formatRupiah(slip.gaji_bersih)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Tanda Tangan */}
        <div style={{ marginTop: "40px" }}>
          <p style={{ textAlign: "right", fontWeight: "bold", fontSize: "10px", marginBottom: "30px" }}>Cimahi, {displayCetakDate}</p>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", width: "40%" }}>
              <p style={{ fontWeight: "bold" }}>Disetujui oleh,</p>
              <div style={{ height: "50px" }} />
              <p style={{ fontWeight: "900", textDecoration: "underline" }}>{approver.name}</p>
              <p style={{ fontSize: "9px", color: "#666" }}>{approver.role}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: "40%", alignItems: "flex-end", textAlign: "right" }}>
              <p style={{ fontWeight: "bold" }}>Diterima oleh,</p>
              <div style={{ height: "50px" }} />
              <p style={{ fontWeight: "900", textDecoration: "underline" }}>{slip.nama_lengkap}</p>
              <p style={{ fontSize: "9px", color: "#666" }}>{slip.jabatan}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
