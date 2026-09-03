"use client";

import React, { useState } from "react";
import { X, Printer } from "lucide-react";

interface Criterion {
  id: number;
  name: string;
  sort_order: number;
}

interface MonthData {
  month_number: number;
  month_label: string;
  month_start: string;
  month_end: string;
  criteria_scores: Record<number, number>;
  activity_avg: number | null;
  notes: string | null;
  kie_submitted: number;
  kie_target: number;
  kie_pct: number;
  working_days: number;
  accumulation: number | null;
}

interface CertGradeData {
  num_months: number;
  start_date: string;
  end_date: string;
  settings: { activity_weight: number; kie_weight: number; aspect_label: string };
  criteria: Criterion[];
  months: MonthData[];
  criteria_averages: Record<number, number | null>;
  final_grade: number | null;
}

interface Student {
  student_id: string;
  student_name: string;
  school_name?: string;
  start_date: string;
  end_date: string;
}

interface CertificatePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  gradeData: CertGradeData | null;
  criteria: Criterion[];
  notes: Record<number, string>;
}

export default function CertificatePrintModal({
  isOpen,
  onClose,
  student,
  gradeData,
  criteria,
  notes,
}: CertificatePrintModalProps) {
  const [activePage, setActivePage] = useState<"all" | "front" | "back">("all");
  
  // Dynamic certificate number and date
  const defaultCertNo = `CTF-SKT/06/2026-0054`;
  const [certNumber, setCertNumber] = useState(defaultCertNo);
  const [certDate, setCertDate] = useState(`Cimahi, April 2026`);
  const [directorName, setDirectorName] = useState(`M. FIRAS FAISAL`);
  const [directorTitle, setDirectorTitle] = useState(`Direktur Utama`);

  if (!isOpen || !student || !gradeData) return null;

  // Active criteria to display (clean criteria, no Kehadiran/KIE)
  const displayCriteria = criteria.filter(c => c.name && !c.name.toLowerCase().includes("kehadiran"));

  // Calculate scores per criterion across months
  const criteriaRows = displayCriteria.map((c, idx) => {
    const monthScores = gradeData.months.map(m => {
      const raw = m.criteria_scores[c.id];
      if (raw !== undefined && raw !== null) {
        return Math.round(Number(raw) * 10);
      }
      return null;
    });

    const filledScores = monthScores.filter((s): s is number => s !== null);
    const avgScore = filledScores.length > 0
      ? Math.round(filledScores.reduce((a, b) => a + b, 0) / filledScores.length)
      : (gradeData.criteria_averages[c.id] !== null && gradeData.criteria_averages[c.id] !== undefined
          ? Math.round(Number(gradeData.criteria_averages[c.id]) * 10)
          : 90);

    let predikat = "A";
    if (avgScore < 70) predikat = "C";
    else if (avgScore < 85) predikat = "B";

    return {
      no: idx + 1,
      name: c.name,
      monthScores,
      finalScore: avgScore,
      predikat,
    };
  });

  // Calculate overall average score
  const validFinalScores = criteriaRows.map(r => r.finalScore);
  const overallScore = validFinalScores.length > 0
    ? Math.round(validFinalScores.reduce((a, b) => a + b, 0) / validFinalScores.length)
    : 95;

  let overallPredikatLabel = "Sangat Baik";
  if (overallScore < 75) overallPredikatLabel = "Cukup";
  else if (overallScore < 85) overallPredikatLabel = "Baik";

  // Trigger window print
  const handlePrint = () => {
    window.print();
  };

  // Reusable SVG Background for Front and Back
  const CertificateBackground = () => (
    <svg
      viewBox="0 0 1122 793"
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── TOP-LEFT WAVES ── */}
      {/* Wave Layer 1: Yellow/Gold */}
      <path
        d="M -10 -10 
           L 570 -10 
           C 510 90, 420 130, 320 180 
           C 200 240, 160 380, 110 470 
           C 70 540, 30 580, -10 610 
           Z"
        fill="#EBB036"
      />

      {/* Wave Layer 2: Soft Mint / Sage */}
      <path
        d="M -10 -10 
           L 480 -10 
           C 410 80, 340 140, 240 210 
           C 140 280, 100 390, 50 480 
           C 20 520, 0 540, -10 550 
           Z"
        fill="#76C1B4"
      />

      {/* Wave Layer 3: Deep Teal */}
      <path
        d="M -10 -10 
           L 400 -10 
           C 340 70, 280 130, 200 170 
           C 120 220, 90 320, 40 400 
           C 15 440, 0 460, -10 470 
           Z"
        fill="#2C8B82"
      />

      {/* Top Left White Accent Line Waves */}
      <path
        d="M 60 30 C 130 130, 170 230, 250 260 C 320 280, 390 220, 460 190"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M 30 90 C 90 170, 130 260, 200 290 C 270 310, 330 260, 400 230"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* ── BOTTOM-LEFT ACCENT (Yellow Curve) ── */}
      <path
        d="M -10 620 
           C 45 645, 85 690, 105 740 
           C 118 780, 125 795, 130 805 
           L -10 805 Z"
        fill="#EBB036"
      />

      {/* ── TOP-RIGHT ACCENT (Yellow Tip) ── */}
      <path
        d="M 1040 -10 
           C 1070 10, 1095 30, 1135 65 
           L 1135 -10 Z"
        fill="#EBB036"
      />

      {/* ── BOTTOM-RIGHT WAVES ── */}
      {/* Wave Layer 1: Yellow/Gold */}
      <path
        d="M 1135 430 
           C 1070 480, 980 540, 910 620 
           C 840 700, 800 750, 750 805 
           L 1135 805 Z"
        fill="#EBB036"
      />

      {/* Wave Layer 2: Soft Mint / Sage */}
      <path
        d="M 1135 500 
           C 1080 540, 1010 590, 950 660 
           C 890 730, 860 770, 820 805 
           L 1135 805 Z"
        fill="#76C1B4"
      />

      {/* Wave Layer 3: Deep Teal */}
      <path
        d="M 1135 580 
           C 1090 610, 1040 650, 990 710 
           C 950 760, 930 780, 895 805 
           L 1135 805 Z"
        fill="#2C8B82"
      />

      {/* Bottom Right White Accent Line Waves */}
      <path
        d="M 1060 740 C 990 670, 940 590, 860 570 C 790 550, 730 600, 680 630"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.8"
      />

      {/* ── ELEGANT CERTIFICATE BORDER ── */}
      {/* Outer Solid Rounded Frame */}
      <rect
        x="98"
        y="82"
        width="926"
        height="628"
        rx="22"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="1.5"
      />

      {/* Inner Dotted Frame */}
      <rect
        x="112"
        y="96"
        width="898"
        height="600"
        rx="14"
        fill="none"
        stroke="#94A3B8"
        strokeWidth="2.5"
        strokeDasharray="4 6"
      />
    </svg>
  );

  return (
    <>
      {/* Printable CSS injected dynamically */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #certificate-print-workspace,
          #certificate-print-workspace * {
            visibility: visible !important;
          }
          #certificate-print-workspace {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }
          .certificate-page-item {
            width: 297mm !important;
            height: 210mm !important;
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ── MODAL BACKDROP & CONTAINER ── */}
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/85 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 border-b border-slate-800 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2AB0B2]/20 text-[#2AB0B2] rounded-xl">
              <Printer size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Preview & Cetak Sertifikat PKL
              </h2>
              <p className="text-[11px] text-slate-400">
                Siswa: <span className="text-white font-semibold">{student.student_name}</span> · Desain Resmi Sampulkreativ
              </p>
            </div>
          </div>

          {/* Page Switcher Tabs */}
          <div className="flex items-center bg-slate-800 border border-slate-700/80 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActivePage("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activePage === "all" ? "bg-[#2AB0B2] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Semua (2 Halaman)
            </button>
            <button
              onClick={() => setActivePage("front")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activePage === "front" ? "bg-[#2AB0B2] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Halaman 1 (Depan)
            </button>
            <button
              onClick={() => setActivePage("back")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activePage === "back" ? "bg-[#2AB0B2] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Halaman 2 (Belakang)
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-[#2AB0B2] hover:bg-[#209092] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Printer size={14} />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center gap-8 bg-slate-950/60">
          <div id="certificate-print-workspace" className="flex flex-col items-center gap-8">
            
            {/* ════════════════════════════════════════════════════════════════════
                PAGE 1: SISI DEPAN (FRONT SIDE)
               ════════════════════════════════════════════════════════════════════ */}
            {(activePage === "all" || activePage === "front") && (
              <div
                className="certificate-page-item relative w-[1000px] h-[707px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between p-16 select-none"
                style={{
                  aspectRatio: "1122 / 793",
                  fontFamily: "'Montserrat', 'Inter', sans-serif",
                }}
              >
                {/* SVG Vector Frame & Waves */}
                <CertificateBackground />

                {/* ── HEADER CONTENT ── */}
                <div className="relative z-10 text-center flex flex-col items-center pt-2">
                  {/* SERTIFIKAT */}
                  <h1
                    className="text-[44px] font-black text-[#1E293B] tracking-[0.22em] leading-none mb-3"
                    style={{ fontFamily: "'Cinzel', 'Montserrat', serif" }}
                  >
                    SERTIFIKAT
                  </h1>

                  {/* Ribbon Banner: PRAKTEK KERJA INDUSTRI */}
                  <div className="relative flex items-center justify-center my-1.5">
                    {/* Left Tail fold */}
                    <div
                      className="absolute -left-6 w-6 h-9 bg-[#247A73]"
                      style={{
                        clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 35% 50%)",
                      }}
                    />
                    <div
                      className="absolute -left-2 top-full w-2 h-2 bg-[#D19B2C]"
                      style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
                    />

                    {/* Center Ribbon Body */}
                    <div className="bg-[#2AB0B2] text-white px-10 py-1.5 shadow-sm">
                      <span className="text-sm md:text-[15px] font-black tracking-[0.2em] uppercase">
                        PRAKTEK KERJA INDUSTRI
                      </span>
                    </div>

                    {/* Right Tail fold */}
                    <div
                      className="absolute -right-6 w-6 h-9 bg-[#247A73]"
                      style={{
                        clipPath: "polygon(0% 0%, 100% 0%, 65% 50%, 100% 100%, 0% 100%)",
                      }}
                    />
                    <div
                      className="absolute -right-2 top-full w-2 h-2 bg-[#D19B2C]"
                      style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
                    />
                  </div>

                  {/* Subtitle */}
                  <p className="text-[12px] font-extrabold text-[#94A3B8] tracking-[0.2em] uppercase mt-2">
                    INDUSTRIAL PRACTICE CERTIFICATE
                  </p>

                  {/* Certificate Number */}
                  <p className="text-xs font-extrabold text-[#1E293B] mt-1.5 tracking-wide">
                    No: &nbsp;<span className="font-bold">{certNumber}</span>
                  </p>
                </div>

                {/* ── BODY CONTENT ── */}
                <div className="relative z-10 text-center flex flex-col items-center my-auto px-12">
                  <p className="text-xs text-slate-500 font-medium tracking-wide mb-3">
                    Sertifikat ini menyatakan bahwa:
                  </p>

                  {/* Student Name */}
                  <div className="relative inline-block mb-3">
                    <h2
                      className="text-2xl md:text-[28px] font-black text-[#1E293B] tracking-wide pb-1.5 px-6 border-b-2 border-[#1E293B]"
                      style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                      {student.student_name}
                    </h2>
                  </div>

                  {/* Asal Sekolah */}
                  <p className="text-xs text-slate-600 font-bold mb-4">
                    Asal Sekolah : &nbsp;
                    <span className="font-extrabold text-slate-800">
                      {student.school_name || "Politeknik Negeri Bandung"}
                    </span>
                  </p>

                  {/* Description Paragraph */}
                  <p className="text-xs text-slate-500 max-w-[560px] leading-relaxed font-medium">
                    Dinyatakan selesai melaksanakan Praktek Kerja Industri di Perusahaan kami
                    dan dengan nilai yang tercantum dibalik sertifikat ini.
                  </p>
                </div>

                {/* ── FOOTER CONTENT ── */}
                <div className="relative z-10 flex items-end justify-between px-6 pb-2">
                  {/* Left: Sampulkreativ Logo & Address */}
                  <div className="flex flex-col gap-1.5 max-w-[280px]">
                    <div className="flex items-center gap-3">
                      {/* Logo Mark Vector */}
                      <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
                        <path
                          d="M6 14 L24 6 L34 11 L16 19 Z"
                          fill="#2AB0B2"
                        />
                        <path
                          d="M6 24 L24 16 L34 21 L16 29 Z"
                          fill="#EBB036"
                        />
                      </svg>
                      <div className="flex flex-col">
                        <span className="text-xs font-black tracking-wider text-[#1E293B] leading-none">
                          SAMPULKREATIV
                        </span>
                        <span className="text-[9px] font-bold tracking-[0.25em] text-slate-400 mt-0.5">
                          TECHNOLOGY
                        </span>
                      </div>
                    </div>
                    <div className="text-[9.5px] text-slate-500 font-semibold leading-tight pl-0.5 mt-1">
                      <p>Gedung BITC Lantai 3</p>
                      <p>Jl. HMS Mintaredja Baros Kota Cimahi</p>
                    </div>
                  </div>

                  {/* Right: Date, Signature & Director */}
                  <div className="flex flex-col items-center text-center min-w-[200px]">
                    <p className="text-xs font-bold text-slate-700 mb-10">
                      {certDate}
                    </p>
                    <p className="text-xs font-extrabold text-[#1E293B] pb-1 border-b-2 border-[#1E293B] w-full min-w-[180px]">
                      {directorName}
                    </p>
                    <p className="text-[11px] text-slate-500 font-semibold mt-1">
                      {directorTitle}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
                PAGE 2: SISI BELAKANG (BACK SIDE - TRANSKRIP NILAI)
               ════════════════════════════════════════════════════════════════════ */}
            {(activePage === "all" || activePage === "back") && (
              <div
                className="certificate-page-item relative w-[1000px] h-[707px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between p-16 select-none"
                style={{
                  aspectRatio: "1122 / 793",
                  fontFamily: "'Montserrat', 'Inter', sans-serif",
                }}
              >
                {/* SVG Vector Frame & Waves */}
                <CertificateBackground />

                {/* ── HEADER CONTENT ── */}
                <div className="relative z-10 text-center pt-2">
                  <h2 className="text-[15px] md:text-base font-extrabold text-[#1E293B] tracking-wide">
                    Nilai Praktek Kerja Industri No sertifikat: {certNumber}
                  </h2>
                </div>

                {/* ── TABEL NILAI (PILIHAN 2: KOLOM BULAN 1 & 2) ── */}
                <div className="relative z-10 my-auto px-6">
                  <table className="w-full text-left border-collapse border border-[#1E293B]">
                    <thead>
                      <tr className="bg-slate-50/80 text-[#1E293B]">
                        <th className="border border-[#1E293B] px-3 py-2 text-center text-[11px] font-black w-12">
                          No
                        </th>
                        <th className="border border-[#1E293B] px-4 py-2 text-[11px] font-black">
                          Komponen Penilaian
                        </th>
                        {gradeData.months.map((m) => (
                          <th
                            key={m.month_number}
                            className="border border-[#1E293B] px-3 py-2 text-center text-[11px] font-black w-24 whitespace-nowrap"
                          >
                            {m.month_label}
                          </th>
                        ))}
                        <th className="border border-[#1E293B] px-3 py-2 text-center text-[11px] font-black w-24">
                          Skor Akhir
                        </th>
                        <th className="border border-[#1E293B] px-3 py-2 text-center text-[11px] font-black w-24">
                          Predikat
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {criteriaRows.map((row) => (
                        <tr key={row.no} className="hover:bg-slate-50/50">
                          <td className="border border-[#1E293B] px-3 py-2 text-center text-xs font-bold text-slate-700">
                            {row.no}
                          </td>
                          <td className="border border-[#1E293B] px-4 py-2 text-xs font-bold text-slate-800">
                            {row.name}
                          </td>
                          {row.monthScores.map((score, mIdx) => (
                            <td
                              key={mIdx}
                              className="border border-[#1E293B] px-3 py-2 text-center text-xs font-bold text-slate-700"
                            >
                              {score !== null ? score : "—"}
                            </td>
                          ))}
                          <td className="border border-[#1E293B] px-3 py-2 text-center text-xs font-black text-slate-900 bg-slate-50/30">
                            {row.finalScore}
                          </td>
                          <td className="border border-[#1E293B] px-3 py-2 text-center text-xs font-black text-slate-900">
                            {row.predikat}
                          </td>
                        </tr>
                      ))}

                      {/* Summary Row */}
                      <tr className="bg-slate-50 font-black">
                        <td
                          colSpan={2 + gradeData.months.length}
                          className="border border-[#1E293B] px-4 py-2 text-right text-xs uppercase tracking-wider text-slate-700"
                        >
                          Rata-rata Keseluruhan
                        </td>
                        <td className="border border-[#1E293B] px-3 py-2 text-center text-sm font-black text-[#2AB0B2]">
                          {overallScore}
                        </td>
                        <td className="border border-[#1E293B] px-3 py-2 text-center text-xs font-black text-slate-900 whitespace-nowrap">
                          {overallPredikatLabel}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ── FOOTER: CATATAN PEMBIMBING (KIRI) & TANDA TANGAN (KANAN) ── */}
                <div className="relative z-10 flex items-start justify-between px-6 pb-2 gap-8">
                  {/* Left: Catatan Pembimbing Box */}
                  <div className="flex-1 max-w-[480px]">
                    <div className="p-3 rounded-xl border border-slate-300 bg-slate-50/70 shadow-3xs">
                      <p className="text-[11px] font-extrabold text-[#1E293B] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <span>💬</span>
                        <span>Catatan Perkembangan Siswa</span>
                      </p>
                      <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-700">
                        {gradeData.months.map((m) => {
                          const noteText = notes[m.month_number] || m.notes;
                          return (
                            <div key={m.month_number} className="flex flex-col">
                              <span className="font-black text-slate-800">
                                • {m.month_label}:
                              </span>
                              <p className="pl-3 italic text-slate-600">
                                {noteText ? `"${noteText}"` : "(Sangat disiplin, aktif bekerja sama, dan menyelesaikan target magang dengan baik.)"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right: Date, Signature & Director */}
                  <div className="flex flex-col items-center text-center min-w-[200px] pt-1">
                    <p className="text-xs font-bold text-slate-700 mb-10">
                      {certDate}
                    </p>
                    <p className="text-xs font-extrabold text-[#1E293B] pb-1 border-b-2 border-[#1E293B] w-full min-w-[180px]">
                      {directorName} S.Kom
                    </p>
                    <p className="text-[11px] text-slate-500 font-semibold mt-1">
                      {directorTitle}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
