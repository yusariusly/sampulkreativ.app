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
  const [activeTab, setActiveTab] = useState<"all" | "front" | "back">("all");
  
  // Dynamic certificate number and date
  const defaultCertNo = `CTF-SKT/06/2026-0054`;
  const [certNumber, setCertNumber] = useState(defaultCertNo);
  const [certDate, setCertDate] = useState(`Cimahi, September 2026`);
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

  // Dedicated clean iframe printing for 100% exact landscape A4 output
  const handlePrint = () => {
    const existingFrame = document.getElementById("certificate-print-iframe");
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "certificate-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // Build Month Headers HTML
    const monthHeadersHtml = gradeData.months
      .map(
        m => `<th style="border: 1.5px solid #1E293B; padding: 6px 8px; text-align: center; font-size: 11px; font-weight: 800; width: 80px; background: #F8FAFC;">${m.month_label}</th>`
      )
      .join("");

    // Build Criteria Rows HTML
    const rowsHtml = criteriaRows
      .map(
        row => `
        <tr>
          <td style="border: 1.5px solid #1E293B; padding: 6px 8px; text-align: center; font-size: 11px; font-weight: bold; color: #1E293B;">${row.no}</td>
          <td style="border: 1.5px solid #1E293B; padding: 6px 12px; font-size: 11px; font-weight: bold; color: #1E293B;">${row.name}</td>
          ${row.monthScores.map(score => `<td style="border: 1.5px solid #1E293B; padding: 6px 8px; text-align: center; font-size: 11px; font-weight: bold; color: #1E293B;">${score !== null ? score : '—'}</td>`).join('')}
          <td style="border: 1.5px solid #1E293B; padding: 6px 8px; text-align: center; font-size: 11px; font-weight: 900; color: #1E293B; background: #F8FAFC;">${row.finalScore}</td>
          <td style="border: 1.5px solid #1E293B; padding: 6px 8px; text-align: center; font-size: 11px; font-weight: 900; color: #1E293B;">${row.predikat}</td>
        </tr>
      `
      )
      .join("");

    // Build Catatan Pembimbing HTML
    const notesHtml = gradeData.months
      .map(m => {
        const noteText = notes[m.month_number] || m.notes;
        return `
          <div style="margin-bottom: 4px;">
            <strong style="color: #1E293B; font-weight: 800;">• ${m.month_label}:</strong>
            <span style="font-style: italic; color: #475569; margin-left: 4px;">${noteText ? `"${noteText}"` : 'Sangat disiplin, aktif, dan menyelesaikan seluruh target magang dengan sangat baik.'}</span>
          </div>
        `;
      })
      .join("");

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Sertifikat PKL - ${student.student_name}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #FFFFFF;
            font-family: Arial, Helvetica, sans-serif;
          }
          .cert-page {
            width: 297mm;
            height: 209.5mm;
            page-break-after: always;
            break-after: page;
            position: relative;
            background-size: 100% 100%;
            background-repeat: no-repeat;
            background-position: center center;
            overflow: hidden;
          }
          .cert-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          /* High-res printable images */
          .bg-img {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
          }
          .content-layer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 2;
          }
        </style>
      </head>
      <body>
        <!-- ══ PAGE 1: SISI DEPAN ══ -->
        <div class="cert-page">
          <img src="/cert_template_front.png" class="bg-img" alt="Front Template" />
          <div class="content-layer">
            <!-- Nomor Sertifikat -->
            <div style="position: absolute; left: 440px; top: 268px; font-size: 12px; font-weight: bold; color: #1E293B;">
              ${certNumber}
            </div>

            <!-- Nama Siswa -->
            <div style="position: absolute; left: 240px; top: 334px; width: 544px; text-align: center;">
              <span style="display: inline-block; font-size: 23px; font-weight: 900; color: #1E293B; letter-spacing: 0.5px; border-bottom: 2px solid #1E293B; padding-bottom: 2px;">
                ${student.student_name}
              </span>
            </div>

            <!-- Asal Sekolah -->
            <div style="position: absolute; left: 462px; top: 388px; font-size: 12px; font-weight: 800; color: #1E293B;">
              ${student.school_name || "Politeknik Negeri Bandung"}
            </div>

            <!-- Tanggal Cimahi -->
            <div style="position: absolute; left: 630px; top: 497px; font-size: 11.5px; font-weight: bold; color: #1E293B;">
              ${certDate}
            </div>

            <!-- Tanda Tangan Direktur -->
            <div style="position: absolute; left: 565px; top: 552px; width: 228px; text-align: center;">
              <div style="font-size: 12px; font-weight: 900; color: #1E293B; border-bottom: 2px solid #1E293B; padding-bottom: 3px;">
                ${directorName}
              </div>
            </div>
          </div>
        </div>

        <!-- ══ PAGE 2: SISI BELAKANG ══ -->
        <div class="cert-page">
          <img src="/cert_template_back.png" class="bg-img" alt="Back Template" />
          <div class="content-layer">
            <!-- Judul Belakang -->
            <div style="position: absolute; left: 150px; top: 128px; width: 724px; text-align: center; font-size: 14.5px; font-weight: 900; color: #1E293B;">
              Nilai Praktek Kerja Industri No sertifikat: ${certNumber}
            </div>

            <!-- Tabel Nilai Pilihan 2 -->
            <div style="position: absolute; left: 150px; top: 165px; width: 724px;">
              <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #1E293B; background: #FFFFFF;">
                <thead>
                  <tr style="background: #F8FAFC;">
                    <th style="border: 1.5px solid #1E293B; padding: 6px 8px; text-align: center; font-size: 11px; font-weight: 900; width: 40px; color: #1E293B;">No</th>
                    <th style="border: 1.5px solid #1E293B; padding: 6px 12px; text-align: left; font-size: 11px; font-weight: 900; color: #1E293B;">Komponen Penilaian</th>
                    ${monthHeadersHtml}
                    <th style="border: 1.5px solid #1E293B; padding: 6px 8px; text-align: center; font-size: 11px; font-weight: 900; width: 85px; color: #1E293B;">Skor Akhir</th>
                    <th style="border: 1.5px solid #1E293B; padding: 6px 8px; text-align: center; font-size: 11px; font-weight: 900; width: 85px; color: #1E293B;">Predikat</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                  <tr style="background: #F8FAFC; font-weight: 900;">
                    <td colspan="${2 + gradeData.months.length}" style="border: 1.5px solid #1E293B; padding: 6px 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #1E293B;">
                      Rata-rata Keseluruhan
                    </td>
                    <td style="border: 1.5px solid #1E293B; padding: 6px 8px; text-align: center; font-size: 12px; font-weight: 900; color: #2AB0B2;">
                      ${overallScore}
                    </td>
                    <td style="border: 1.5px solid #1E293B; padding: 6px 8px; text-align: center; font-size: 11px; font-weight: 900; color: #1E293B;">
                      ${overallPredikatLabel}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Footer: Catatan Pembimbing (Kiri Bawah) -->
            <div style="position: absolute; left: 150px; top: 465px; width: 440px;">
              <div style="border: 1.5px solid #CBD5E1; background: rgba(248, 250, 252, 0.9); padding: 8px 12px; border-radius: 8px;">
                <div style="font-size: 10.5px; font-weight: 900; color: #1E293B; margin-bottom: 4px; display: flex; items-center; gap: 4px;">
                  <span>💬 CATATAN PERKEMBANGAN SISWA</span>
                </div>
                <div style="font-size: 9.5px; color: #334155; line-height: 1.35;">
                  ${notesHtml}
                </div>
              </div>
            </div>

            <!-- Footer: Tanda Tangan Direktur (Kanan Bawah) -->
            <div style="position: absolute; right: 150px; top: 465px; width: 200px; text-align: center;">
              <div style="font-size: 11px; font-weight: bold; color: #1E293B; margin-bottom: 45px;">
                ${certDate}
              </div>
              <div style="font-size: 11.5px; font-weight: 900; color: #1E293B; border-bottom: 2px solid #1E293B; padding-bottom: 2px;">
                ${directorName} S.Kom
              </div>
              <div style="font-size: 10px; color: #64748B; margin-top: 2px;">
                ${directorTitle}
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(printHtml);
    doc.close();

    // Allow images to load before calling print
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/85 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#2AB0B2]/20 text-[#2AB0B2] rounded-xl">
            <Printer size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              Preview Sertifikat PKL — {student.student_name}
            </h2>
            <p className="text-[11px] text-slate-400">
              Desain Resmi Sampulkreativ Technology (A4 Landscape 2 Halaman)
            </p>
          </div>
        </div>

        {/* Page Switcher Tabs */}
        <div className="flex items-center bg-slate-800 border border-slate-700/80 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === "all" ? "bg-[#2AB0B2] text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Semua (2 Halaman)
          </button>
          <button
            onClick={() => setActiveTab("front")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === "front" ? "bg-[#2AB0B2] text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Halaman 1 (Depan)
          </button>
          <button
            onClick={() => setActiveTab("back")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === "back" ? "bg-[#2AB0B2] text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Halaman 2 (Belakang)
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-[#2AB0B2] hover:bg-[#209092] text-white px-5 py-2 rounded-xl text-xs font-extrabold transition-all shadow-md active:scale-95 cursor-pointer"
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

      {/* Modal Preview Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center gap-8 bg-slate-950/70">
        
        {/* ════════════════════════════════════════════════════════════════════
            PREVIEW PAGE 1: SISI DEPAN (FRONT)
           ════════════════════════════════════════════════════════════════════ */}
        {(activeTab === "all" || activeTab === "front") && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Halaman 1 — Sisi Depan (Sertifikat)
            </span>
            <div
              className="relative w-[920px] h-[637px] bg-white rounded-xl shadow-2xl overflow-hidden select-none"
              style={{
                backgroundImage: "url('/cert_template_front.png')",
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
              }}
            >
              {/* Nomor Sertifikat */}
              <div
                style={{
                  position: "absolute",
                  left: "395px",
                  top: "241px",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  color: "#1E293B",
                }}
              >
                {certNumber}
              </div>

              {/* Nama Siswa */}
              <div
                style={{
                  position: "absolute",
                  left: "215px",
                  top: "300px",
                  width: "490px",
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "20px",
                    fontWeight: 900,
                    color: "#1E293B",
                    letterSpacing: "0.5px",
                    borderBottom: "2px solid #1E293B",
                    paddingBottom: "2px",
                  }}
                >
                  {student.student_name}
                </span>
              </div>

              {/* Asal Sekolah */}
              <div
                style={{
                  position: "absolute",
                  left: "415px",
                  top: "348px",
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#1E293B",
                }}
              >
                {student.school_name || "Politeknik Negeri Bandung"}
              </div>

              {/* Tanggal Cimahi */}
              <div
                style={{
                  position: "absolute",
                  left: "565px",
                  top: "446px",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  color: "#1E293B",
                }}
              >
                {certDate}
              </div>

              {/* Tanda Tangan Direktur */}
              <div
                style={{
                  position: "absolute",
                  left: "508px",
                  top: "496px",
                  width: "205px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 900,
                    color: "#1E293B",
                    borderBottom: "2px solid #1E293B",
                    paddingBottom: "2px",
                  }}
                >
                  {directorName}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PREVIEW PAGE 2: SISI BELAKANG (BACK)
           ════════════════════════════════════════════════════════════════════ */}
        {(activeTab === "all" || activeTab === "back") && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Halaman 2 — Sisi Belakang (Transkrip Nilai)
            </span>
            <div
              className="relative w-[920px] h-[637px] bg-white rounded-xl shadow-2xl overflow-hidden select-none"
              style={{
                backgroundImage: "url('/cert_template_back.png')",
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
              }}
            >
              {/* Judul Belakang */}
              <div
                style={{
                  position: "absolute",
                  left: "135px",
                  top: "115px",
                  width: "650px",
                  textAlign: "center",
                  fontSize: "13px",
                  fontWeight: 900,
                  color: "#1E293B",
                }}
              >
                Nilai Praktek Kerja Industri No sertifikat: {certNumber}
              </div>

              {/* Tabel Nilai (Pilihan 2) */}
              <div
                style={{
                  position: "absolute",
                  left: "135px",
                  top: "148px",
                  width: "650px",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    border: "1.5px solid #1E293B",
                    background: "#FFFFFF",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      <th style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "10px", fontWeight: 900, width: "36px", color: "#1E293B" }}>
                        No
                      </th>
                      <th style={{ border: "1.5px solid #1E293B", padding: "5px 10px", textAlign: "left", fontSize: "10px", fontWeight: 900, color: "#1E293B" }}>
                        Komponen Penilaian
                      </th>
                      {gradeData.months.map(m => (
                        <th
                          key={m.month_number}
                          style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "10px", fontWeight: 900, width: "70px", color: "#1E293B", background: "#F8FAFC" }}
                        >
                          {m.month_label}
                        </th>
                      ))}
                      <th style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "10px", fontWeight: 900, width: "75px", color: "#1E293B" }}>
                        Skor Akhir
                      </th>
                      <th style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "10px", fontWeight: 900, width: "75px", color: "#1E293B" }}>
                        Predikat
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteriaRows.map(row => (
                      <tr key={row.no}>
                        <td style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "10px", fontWeight: "bold", color: "#1E293B" }}>
                          {row.no}
                        </td>
                        <td style={{ border: "1.5px solid #1E293B", padding: "5px 10px", fontSize: "10px", fontWeight: "bold", color: "#1E293B" }}>
                          {row.name}
                        </td>
                        {row.monthScores.map((score, mIdx) => (
                          <td
                            key={mIdx}
                            style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "10px", fontWeight: "bold", color: "#1E293B" }}
                          >
                            {score !== null ? score : "—"}
                          </td>
                        ))}
                        <td style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "10px", fontWeight: 900, color: "#1E293B", background: "#F8FAFC" }}>
                          {row.finalScore}
                        </td>
                        <td style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "10px", fontWeight: 900, color: "#1E293B" }}>
                          {row.predikat}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: "#F8FAFC", fontWeight: 900 }}>
                      <td
                        colSpan={2 + gradeData.months.length}
                        style={{ border: "1.5px solid #1E293B", padding: "5px 10px", textAlign: "right", fontSize: "10px", textTransform: "uppercase", color: "#1E293B" }}
                      >
                        Rata-rata Keseluruhan
                      </td>
                      <td style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "11px", fontWeight: 900, color: "#2AB0B2" }}>
                        {overallScore}
                      </td>
                      <td style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "10px", fontWeight: 900, color: "#1E293B" }}>
                        {overallPredikatLabel}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Catatan Pembimbing (Kiri Bawah) */}
              <div
                style={{
                  position: "absolute",
                  left: "135px",
                  top: "418px",
                  width: "395px",
                }}
              >
                <div
                  style={{
                    border: "1.5px solid #CBD5E1",
                    background: "rgba(248, 250, 252, 0.9)",
                    padding: "7px 10px",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9.5px",
                      fontWeight: 900,
                      color: "#1E293B",
                      marginBottom: "3px",
                    }}
                  >
                    💬 CATATAN PERKEMBANGAN SISWA
                  </div>
                  <div style={{ fontSize: "8.5px", color: "#334155", lineHeight: 1.35 }}>
                    {gradeData.months.map(m => {
                      const noteText = notes[m.month_number] || m.notes;
                      return (
                        <div key={m.month_number} style={{ marginBottom: "2px" }}>
                          <strong style={{ color: "#1E293B" }}>• {m.month_label}:</strong>
                          <span style={{ fontStyle: "italic", color: "#475569", marginLeft: "3px" }}>
                            {noteText ? `"${noteText}"` : "Sangat disiplin, aktif, dan menyelesaikan seluruh target magang dengan sangat baik."}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tanda Tangan Direktur (Kanan Bawah) */}
              <div
                style={{
                  position: "absolute",
                  right: "135px",
                  top: "418px",
                  width: "180px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "10px", fontWeight: "bold", color: "#1E293B", marginBottom: "40px" }}>
                  {certDate}
                </div>
                <div style={{ fontSize: "10.5px", fontWeight: 900, color: "#1E293B", borderBottom: "2px solid #1E293B", paddingBottom: "2px" }}>
                  {directorName} S.Kom
                </div>
                <div style={{ fontSize: "9px", color: "#64748B", marginTop: "2px" }}>
                  {directorTitle}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
