"use client";

import React, { useState } from "react";
import { Printer, Download, Save, X, Upload } from "lucide-react";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

interface SlipDetails {
  id?: string; // Present only if already saved
  user_id: string;
  nama_lengkap: string;
  jabatan: string;
  periode: string;
  periode_month?: number;
  periode_year?: number;
  hari_kantor: number;
  hari_remote: number;
  hari_sakit: number;
  hari_izin: number;
  hari_alpha: number;
  gaji_pokok: number;
  tunjangan_makan: number;
  tunjangan_transport: number;
  bonus: number;
  potongan_alpha: number;
  potongan_sakit: number;
  potongan_izin: number;
  total_pendapatan: number;
  total_potongan: number;
  gaji_bersih: number;
  slip_no?: string;
  tanggal_cetak?: string;
  status?: string;
  transfer_proof?: string;
}

interface PayslipPreviewModalProps {
  slip: SlipDetails;
  approverName: string;
  approverRole: string;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export default function PayslipPreviewModal({
  slip,
  approverName,
  approverRole,
  onClose,
  onSaveSuccess,
}: PayslipPreviewModalProps) {
  const [saving, setSaving] = useState(false);
  const [transferProofBase64, setTransferProofBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  const isSaved = !!slip.id;
  const monthVal = slip.periode_month ?? (new Date().getMonth() + 1);
  const yearVal = slip.periode_year ?? new Date().getFullYear();
  const slipNo = slip.slip_no || `SLIP/${monthVal < 10 ? "0" : ""}${monthVal}/${yearVal}`;
  const displayCetakDate = slip.tanggal_cetak || new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Ukuran berkas maksimal 5MB");
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTransferProofBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFile = () => {
    setFileName("");
    setTransferProofBase64(null);
  };

  const handleSaveSlip = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/payroll/slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: slip.user_id,
          periode: slip.periode,
          slip_no: slipNo,
          tanggal_cetak: new Date().toISOString().split("T")[0],
          hari_kantor: slip.hari_kantor,
          hari_remote: slip.hari_remote,
          hari_sakit: slip.hari_sakit,
          hari_izin: slip.hari_izin,
          hari_alpha: slip.hari_alpha,
          gaji_pokok: slip.gaji_pokok,
          tunjangan_makan: slip.tunjangan_makan,
          tunjangan_transport: slip.tunjangan_transport,
          potongan_alpha: slip.potongan_alpha,
          potongan_sakit: slip.potongan_sakit,
          potongan_izin: slip.potongan_izin,
          total_pendapatan: slip.total_pendapatan,
          total_potongan: slip.total_potongan,
          gaji_bersih: slip.gaji_bersih,
          status: "Dibayar",
          bonus: slip.bonus,
          transfer_proof_base64: transferProofBase64,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("Slip gaji berhasil diterbitkan dan disimpan!");
        if (onSaveSuccess) onSaveSuccess();
        onClose();
      } else {
        alert(data.error || "Gagal menerbitkan slip gaji");
      }
    } catch (err) {
      alert("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById("payslip-print-area");
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById("payslip-print-area");
          if (clonedEl) {
            clonedEl.style.display = "block";
            clonedEl.style.position = "relative";
            clonedEl.style.visibility = "visible";
            clonedEl.style.maxHeight = "none";
            clonedEl.style.height = "auto";

            let parent = clonedEl.parentElement;
            while (parent && parent !== clonedDoc.body) {
              parent.style.overflow = "visible";
              parent.style.maxHeight = "none";
              parent.style.height = "auto";
              parent = parent.parentElement;
            }
          }
        }
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 5, imgWidth, imgHeight);
      pdf.save(`Slip_Gaji_${slip.nama_lengkap.replace(/\s+/g, "_")}_${slip.periode.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Gagal mengekspor PDF.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-fadeIn overflow-y-auto print:static print:bg-white print:p-0 print:m-0">
      <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] text-[#1C3D3F] print:shadow-none print:border-none print:max-h-full print:p-0 print:w-full print:static">
        
        {/* Actions Header Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 flex-shrink-0 print:hidden">
          <h3 className="font-bold text-sm text-[#1C3D3F]">
            {isSaved ? "Dokumen Slip Gaji Resmi" : "Pratinjau Slip Gaji"}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Cetak Slip Gaji"
            >
              <Printer size={16} />
            </button>
            <button
              onClick={handleDownloadPDF}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Unduh PDF"
            >
              <Download size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Area */}
        <div className="flex-1 overflow-y-auto py-6 flex justify-center min-h-0 bg-slate-50/50 print:overflow-visible print:bg-white print:py-0 print:static">
          {/* Printable A4 Paper */}
          <div
            id="payslip-print-area"
            className="w-full max-w-[620px] bg-white border border-gray-200 shadow-xs p-8 text-[11px] font-sans text-black leading-relaxed print:border-none print:shadow-none print:p-0 print:w-full"
            style={{ fontFamily: "Arial, sans-serif" }}
          >
            {/* Kop Surat */}
            <div className="text-left mb-6 text-[10px] leading-relaxed font-sans text-black print:text-black">
              <p className="font-semibold">Gd. BITC Lt.3, Jl. HMS Mintareja Sarjana Hukum, Baros</p>
              <p className="font-semibold">Kec. Cimahi Tengah, Kota Cimahi, Jawa Barat 40521</p>
              <p className="font-semibold text-blue-800">
                Email : <span className="underline">contact@sampulkreativ.id</span>, Web : <span className="underline">sampulkreativ.id</span>
              </p>
            </div>

            {/* Title */}
            <div className="border border-black bg-[#D2E4F4] py-1.5 text-center mb-4">
              <h3 className="text-[11px] font-black tracking-wider text-black underline uppercase">
                SLIP GAJI KARYAWAN
              </h3>
            </div>

            {/* Meta Table */}
            <table className="w-full border border-black border-collapse text-[10px] mb-4">
              <tbody>
                <tr>
                  <td className="p-1.5 font-semibold text-black w-[18%]">Nama Karyawan</td>
                  <td className="p-1.5 text-black w-[32%]">: {slip.nama_lengkap}</td>
                  <td className="p-1.5 font-semibold text-black w-[18%]">Slip No</td>
                  <td className="p-1.5 text-black w-[32%]">: {slipNo}</td>
                </tr>
                <tr>
                  <td className="p-1.5 font-semibold text-black">Jabatan</td>
                  <td className="p-1.5 text-black">: {slip.jabatan}</td>
                  <td className="p-1.5 font-semibold text-black">Dicetak tgl</td>
                  <td className="p-1.5 text-black">: {displayCetakDate}</td>
                </tr>
                <tr>
                  <td className="p-1.5 font-semibold text-black">Periode</td>
                  <td className="p-1.5 text-black">: {slip.periode}</td>
                  <td className="p-1.5 text-black"></td>
                  <td className="p-1.5 text-black"></td>
                </tr>
              </tbody>
            </table>

            {/* Main Details Grid */}
            <table className="w-full border-collapse border border-black text-[9px] mb-4">
              <thead>
                <tr className="bg-[#D2E4F4] border-b border-black">
                  <th className="border-r border-black p-1.5 font-bold text-center" colSpan={2}>DATA ABSENSI</th>
                  <th className="border-r border-black p-1.5 font-bold text-center" colSpan={2}>PENDAPATAN</th>
                  <th className="p-1.5 font-bold text-center" colSpan={3}>POTONGAN</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-1.5 text-left w-[18%]">Hari Masuk Kantor</td>
                  <td className="border-r border-black p-1.5 text-center w-[6%] font-bold">{slip.hari_kantor}</td>
                  <td className="border-r border-black p-1.5 text-left w-[24%]">Gaji Pokok</td>
                  <td className="border-r border-black p-1.5 text-right w-[12%]">{formatRupiah(slip.gaji_pokok)}</td>
                  <td className="border-r border-black p-1.5 text-left w-[20%]">Tanpa Keterangan</td>
                  <td className="border-r border-black p-1.5 text-center w-[8%] font-semibold">{slip.hari_alpha}</td>
                  <td className="p-1.5 text-right w-[12%]">{formatRupiah(slip.potongan_alpha)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-1.5 text-left">Hari Masuk Remote</td>
                  <td className="border-r border-black p-1.5 text-center font-bold">{slip.hari_remote}</td>
                  <td className="border-r border-black p-1.5 text-left">Tunjangan makan</td>
                  <td className="border-r border-black p-1.5 text-right">{formatRupiah(slip.tunjangan_makan)}</td>
                  <td className="border-r border-black p-1.5 text-left">Sakit</td>
                  <td className="border-r border-black p-1.5 text-center font-semibold">{slip.hari_sakit}</td>
                  <td className="p-1.5 text-right">{formatRupiah(slip.potongan_sakit)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-1.5 text-left">Total Masuk Kerja</td>
                  <td className="border-r border-black p-1.5 text-center font-bold">{slip.hari_kantor + slip.hari_remote}</td>
                  <td className="border-r border-black p-1.5 text-left">Tunjangan transport</td>
                  <td className="border-r border-black p-1.5 text-right">{formatRupiah(slip.tunjangan_transport)}</td>
                  <td className="border-r border-black p-1.5 text-left">Izin</td>
                  <td className="border-r border-black p-1.5 text-center font-semibold">{slip.hari_izin}</td>
                  <td className="p-1.5 text-right">{formatRupiah(slip.potongan_izin)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-1.5 text-left"></td>
                  <td className="border-r border-black p-1.5 text-center"></td>
                  <td className="border-r border-black p-1.5 text-left">Bonus Kinerja</td>
                  <td className="border-r border-black p-1.5 text-right font-bold">{formatRupiah(slip.bonus)}</td>
                  <td className="border-r border-black p-1.5 text-left"></td>
                  <td className="border-r border-black p-1.5 text-center"></td>
                  <td className="p-1.5 text-right"></td>
                </tr>
                {/* Subtotals Row */}
                <tr className="border-b border-black font-bold">
                  <td className="border-r border-black p-1.5" colSpan={2}></td>
                  <td className="border-r border-black p-1.5 text-right">Total</td>
                  <td className="border-r border-black p-1.5 text-right">{formatRupiah(slip.total_pendapatan)}</td>
                  <td className="border-r border-black p-1.5 text-right" colSpan={2}>Total</td>
                  <td className="p-1.5 text-right">{formatRupiah(slip.total_potongan)}</td>
                </tr>
                {/* Net Salary Row */}
                <tr className="font-extrabold text-[10px]">
                  <td className="border-r border-black p-1.5 text-right" colSpan={6}>
                    Jumlah Gaji
                  </td>
                  <td className="p-1.5 text-right">
                    {formatRupiah(slip.gaji_bersih)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Signature Box */}
            <div className="mt-6">
              <p className="text-right font-semibold mb-6 text-[10px]">Cimahi, {displayCetakDate}</p>
              <div className="flex justify-between text-[10px]">
                <div className="flex flex-col w-[45%] text-left">
                  <p className="font-bold">Disetujui oleh,</p>
                  <div className="h-14" />
                  <p className="font-black text-black underline">{approverName}</p>
                  <p className="text-[9px] text-gray-500 font-bold">{approverRole}</p>
                </div>
                <div className="flex flex-col w-[45%] text-right items-end">
                  <p className="font-bold">Diterima oleh,</p>
                  <div className="h-14" />
                  <p className="font-black text-black underline">{slip.nama_lengkap}</p>
                  <p className="text-[9px] text-gray-500 font-bold">{slip.jabatan}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-col gap-3 p-4 border-t border-gray-100 flex-shrink-0 bg-slate-50/50 print:hidden">
          {/* Row 1: Bukti Transfer Upload / Status */}
          {!isSaved ? (
            <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-gray-200/80 shadow-2xs">
              <div className="flex-1 min-w-0">
                <h5 className="font-bold text-[#1C3D3F] text-[11px] mb-0.5">Bukti Transfer (Opsional)</h5>
                <p className="text-[9px] text-gray-500 font-semibold truncate">
                  {fileName ? fileName : "Upload bukti transfer (Format: JPG, PNG, PDF. Maks 5MB)"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {fileName && (
                  <button
                    onClick={handleRemoveFile}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    Hapus
                  </button>
                )}
                <label className="px-3 py-1.5 bg-[#2AB0B2]/10 hover:bg-[#2AB0B2]/20 text-[#209092] rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95">
                  <Upload size={12} />
                  {fileName ? "Ubah" : "Pilih Berkas"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </div>
          ) : (
            slip.transfer_proof && (
              <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-gray-200/80 shadow-2xs">
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-[#1C3D3F] text-[11px] mb-0.5">Bukti Transfer</h5>
                  <p className="text-[9px] text-gray-500 font-semibold truncate">
                    Bukti transfer pembayaran gaji periode ini telah diunggah.
                  </p>
                </div>
                <a
                  href={slip.transfer_proof}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
                >
                  <Download size={12} />
                  Unduh / Lihat
                </a>
              </div>
            )
          )}

          {/* Row 2: Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-97"
            >
              Tutup
            </button>
            {!isSaved && (
              <button
                onClick={handleSaveSlip}
                disabled={saving}
                className="px-5 py-2.5 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50 active:scale-97"
              >
                <Save size={14} />
                {saving ? "Menyimpan..." : "Simpan & Diterbitkan"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
