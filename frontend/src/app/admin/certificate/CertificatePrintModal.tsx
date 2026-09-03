"use client";

import React, { useState, useEffect } from "react";
import { X, Printer, MapPin, Calendar, User, Award, FileText, SlidersHorizontal } from "lucide-react";

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
  no_karyawan?: string | null;
  start_date: string;
  end_date: string;
}

interface CertificatePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  curriculumTitle?: string;
  gradeData: CertGradeData | null;
  criteria: Criterion[];
  notes: Record<number, string>;
}

export default function CertificatePrintModal({
  isOpen,
  onClose,
  student,
  curriculumTitle,
  gradeData,
  criteria,
  notes,
}: CertificatePrintModalProps) {
  const [activeTab, setActiveTab] = useState<"all" | "front" | "back">("all");

  // Calculate dynamic cert number: CTF-SKT/{angkatan}/{tahun}-{urutan_karyawan}
  const computeCertNumber = () => {
    // 1. Angkatan (e.g. PKL Angkatan 13 -> 13, PKL Angkatan 6 -> 06)
    const angkatanMatch = curriculumTitle?.match(/\d+/);
    const angkatan = angkatanMatch ? String(angkatanMatch[0]).padStart(2, "0") : "06";

    // 2. Tahun (from start_date or current year)
    let year = "2026";
    if (student?.start_date) {
      const matchYear = student.start_date.match(/\d{4}/);
      if (matchYear) year = matchYear[0];
    }

    // 3. Urutan user dari no_karyawan (e.g. 202606150202 -> 0002, or 0054)
    let seq = "0001";
    if (student?.no_karyawan) {
      const digits = student.no_karyawan.replace(/\D/g, "");
      if (digits.length >= 12) {
        // Format YYYYMMDD02NN -> last 2 digits are sequence
        const seqNum = parseInt(digits.slice(10), 10);
        if (!isNaN(seqNum)) seq = String(seqNum).padStart(4, "0");
      } else if (digits.length > 0) {
        const seqNum = parseInt(digits.slice(-4), 10);
        if (!isNaN(seqNum)) seq = String(seqNum).padStart(4, "0");
      }
    }
    return `CTF-SKT/${angkatan}/${year}-${seq}`;
  };

  // Dynamic certificate number, place, date, signer name, and title
  const [certNumber, setCertNumber] = useState(computeCertNumber());
  const [certPlace, setCertPlace] = useState("Cimahi");
  const [certDate, setCertDate] = useState("September 2026");
  const [directorName, setDirectorName] = useState("M. FIRAS FAISAL");
  const [directorTitle, setDirectorTitle] = useState("Direktur Utama");

  // Automatically update certNumber whenever student or curriculum changes
  useEffect(() => {
    if (student) {
      setCertNumber(computeCertNumber());
    }
  }, [student?.student_id, student?.no_karyawan, curriculumTitle]);

  // Load persistent preferences from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPlace = localStorage.getItem("cert_pref_place");
      const savedDate = localStorage.getItem("cert_pref_date");
      const savedDirector = localStorage.getItem("cert_pref_director");
      const savedTitle = localStorage.getItem("cert_pref_title");
      if (savedPlace !== null) setCertPlace(savedPlace);
      if (savedDate !== null) setCertDate(savedDate);
      if (savedDirector !== null) setDirectorName(savedDirector);
      if (savedTitle !== null) setDirectorTitle(savedTitle);
    }
  }, []);

  const certFullDate = certPlace && certDate ? `${certPlace}, ${certDate}` : (certDate || certPlace || "");

  if (!isOpen || !student || !gradeData) return null;

  // Active criteria to display (clean criteria, no Kehadiran/KIE)
  const displayCriteria = criteria.filter(c => c.name && !c.name.toLowerCase().includes("kehadiran"));

  // Calculate scores per criterion across months
  const criteriaRows = displayCriteria.map((c, idx) => {
    const monthScores = gradeData.months.map(m => {
      const raw = m.criteria_scores[c.id];
      if (raw !== undefined && raw !== null) {
        const num = Number(raw);
        return num <= 10 ? Math.round(num * 10) : Math.round(num);
      }
      return null;
    });

    const filledScores = monthScores.filter((s): s is number => s !== null);
    const avgScore = filledScores.length > 0
      ? Math.round(filledScores.reduce((a, b) => a + b, 0) / filledScores.length)
      : (gradeData.criteria_averages[c.id] !== null && gradeData.criteria_averages[c.id] !== undefined
          ? (Number(gradeData.criteria_averages[c.id]) <= 10
              ? Math.round(Number(gradeData.criteria_averages[c.id]) * 10)
              : Math.round(Number(gradeData.criteria_averages[c.id])))
          : 85);

    let predikat = "A";
    if (avgScore < 75) predikat = "C";
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
        <!-- ══ PAGE 1: SISI DEPAN (100% PURE CSS TYPOGRAPHY ON CLEAN RIBBON TEMPLATE) ══ -->
        <div class="cert-page">
          <img src="/cert_template_front_clean.png" class="bg-img" alt="Template Graphic" />
          <div class="content-layer">
            <!-- Title SERTIFIKAT -->
            <div style="position: absolute; left: 0; right: 0; top: 22.0%; text-align: center; font-family: 'Montserrat', sans-serif; font-size: 38px; font-weight: 900; color: #1A3842; letter-spacing: 0.22em; text-transform: uppercase;">
              SERTIFIKAT
            </div>

            <!-- Text PRAKTEK KERJA INDUSTRI (Tepat di dalam pita asli) -->
            <div style="position: absolute; left: 30.47%; width: 39.16%; top: 29.62%; height: 4.37%; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-size: 13.5px; font-weight: 800; color: #FFFFFF; letter-spacing: 0.16em; text-transform: uppercase;">
              PRAKTEK KERJA INDUSTRI
            </div>

            <!-- Subtitle INDUSTRIAL PRACTICE CERTIFICATE -->
            <div style="position: absolute; left: 0; right: 0; top: 35.26%; text-align: center; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: #9CB3B8; letter-spacing: 0.22em; text-transform: uppercase;">
              INDUSTRIAL PRACTICE CERTIFICATE
            </div>

            <!-- No Sertifikat -->
            <div style="position: absolute; left: 0; right: 0; top: 38.36%; text-align: center; font-size: 11.5px; font-weight: 700; color: #334155;">
              No: <span style="font-weight: 800; color: #1E293B; margin-left: 6px;">${certNumber}</span>
            </div>

            <!-- Sertifikat ini menyatakan bahwa -->
            <div style="position: absolute; left: 0; right: 0; top: 43.16%; text-align: center; font-size: 12px; color: #64748B;">
              Sertifikat ini menyatakan bahwa:
            </div>

            <!-- Nama Siswa -->
            <div style="position: absolute; left: 0; right: 0; top: 46.83%; text-align: center;">
              <span style="font-family: 'Montserrat', sans-serif; font-size: 25px; font-weight: 900; color: #0F172A; letter-spacing: 0.02em; border-bottom: 2px solid #0F172A; padding-bottom: 3px; display: inline-block;">
                ${student.student_name}
              </span>
            </div>

            <!-- Asal Sekolah -->
            <div style="position: absolute; left: 0; right: 0; top: 54.44%; text-align: center; font-size: 12px; color: #475569;">
              Asal Sekolah : <strong style="color: #0F172A; font-weight: 800; margin-left: 4px;">${student.school_name || "Politeknik Negeri Bandung"}</strong>
            </div>

            <!-- Keterangan Selesai -->
            <div style="position: absolute; left: 16%; right: 16%; top: 58.67%; text-align: center; font-size: 11px; color: #64748B; line-height: 1.55;">
              Dinyatakan selesai melaksanakan Praktek Kerja Industri di Perusahaan kami<br/>
              dan dengan nilai yang tercantum dibalik sertifikat ini.
            </div>

            <!-- Footer Kiri: Logo + Alamat (Di dalam area putih bersih) -->
            <div style="position: absolute; left: 21.5%; top: 70.5%; display: flex; align-items: center; gap: 12px;">
              <img src="/logo.png" style="height: 42px; object-fit: contain;" alt="Sampulkreativ Logo" />
              <div>
                <div style="font-family: 'Montserrat', sans-serif; font-size: 12.5px; font-weight: 900; color: #1E293B; letter-spacing: 0.04em;">
                  SAMPULKREATIV
                </div>
                <div style="font-size: 9px; font-weight: 700; color: #94A3B8; letter-spacing: 0.1em; text-transform: uppercase;">
                  TECHNOLOGY
                </div>
                <div style="font-size: 8.5px; color: #94A3B8; line-height: 1.35; margin-top: 3px;">
                  Gedung BITC Lantai 3<br/>
                  Jl. HMS Mintaredja Baros Kota Cimahi
                </div>
              </div>
            </div>

            <!-- Footer Kanan: Tanggal & Tanda Tangan (Di dalam area putih bersih) -->
            <div style="position: absolute; right: 20.5%; top: 69.5%; width: 180px; text-align: center;">
              <div style="font-size: 11px; font-weight: 700; color: #1E293B; margin-bottom: 38px;">
                ${certFullDate}
              </div>
              <div style="font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 900; color: #1E293B; border-bottom: 2px solid #1E293B; padding-bottom: 3px; display: inline-block; width: 100%;">
                ${directorName}
              </div>
              <div style="font-size: 10px; color: #64748B; margin-top: 3px; font-weight: 600;">
                ${directorTitle}
              </div>
            </div>
          </div>
        </div>

        <!-- ══ PAGE 2: SISI BELAKANG (100% PURE CSS LAYOUT) ══ -->
        <div class="cert-page">
          <img src="/cert_template_back_clean.png" class="bg-img" alt="Back Template" />
          <div class="content-layer">
            <!-- Judul Belakang -->
            <div style="position: absolute; left: 0; right: 0; top: 15.0%; text-align: center; font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 900; color: #1E293B;">
              Nilai Praktek Kerja Industri No sertifikat: ${certNumber}
            </div>

            <!-- Tabel Nilai -->
            <div style="position: absolute; left: 14%; right: 14%; top: 21.0%;">
              <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #1E293B; background: #FFFFFF; font-family: 'Montserrat', sans-serif;">
                <thead>
                  <tr style="background: #F1F5F9;">
                    <th style="border: 1.5px solid #1E293B; padding: 7px 8px; text-align: center; font-size: 11px; font-weight: 900; width: 40px; color: #1E293B;">No</th>
                    <th style="border: 1.5px solid #1E293B; padding: 7px 12px; text-align: left; font-size: 11px; font-weight: 900; color: #1E293B;">Komponen Penilaian</th>
                    ${monthHeadersHtml}
                    <th style="border: 1.5px solid #1E293B; padding: 7px 8px; text-align: center; font-size: 11px; font-weight: 900; width: 85px; color: #1E293B;">Skor Akhir</th>
                    <th style="border: 1.5px solid #1E293B; padding: 7px 8px; text-align: center; font-size: 11px; font-weight: 900; width: 85px; color: #1E293B;">Predikat</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                  <tr style="background: #F8FAFC;">
                    <td colspan="${2 + gradeData.months.length}" style="border: 1.5px solid #1E293B; padding: 7px 12px; font-size: 11px; font-weight: 900; color: #1E293B; text-align: right;">
                      Rata-rata Keseluruhan
                    </td>
                    <td style="border: 1.5px solid #1E293B; padding: 7px 8px; text-align: center; font-size: 12px; font-weight: 900; color: #1E293B;">
                      ${overallScore}
                    </td>
                    <td style="border: 1.5px solid #1E293B; padding: 7px 8px; text-align: center; font-size: 11px; font-weight: 900; color: #1E293B;">
                      ${overallPredikatLabel}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Footer: Catatan Pembimbing (Kiri Bawah) -->
            <div style="position: absolute; left: 14%; top: 66.0%; width: 440px;">
              <div style="border: 1.5px solid #CBD5E1; background: rgba(255, 255, 255, 0.95); padding: 10px 14px; border-radius: 8px;">
                <div style="font-family: 'Montserrat', sans-serif; font-size: 10.5px; font-weight: 900; color: #1E293B; margin-bottom: 4px;">
                  💬 CATATAN PERKEMBANGAN SISWA
                </div>
                <div style="font-size: 9.5px; color: #334155; line-height: 1.4;">
                  ${notesHtml}
                </div>
              </div>
            </div>

            <!-- Footer: Tanda Tangan Direktur (Kanan Bawah) -->
            <div style="position: absolute; right: 14%; top: 65.5%; width: 190px; text-align: center;">
              <div style="font-size: 11px; font-weight: 700; color: #1E293B; margin-bottom: 40px;">
                ${certFullDate}
              </div>
              <div style="font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 900; color: #1E293B; border-bottom: 2px solid #1E293B; padding-bottom: 3px; display: inline-block; width: 100%;">
                ${directorName}
              </div>
              <div style="font-size: 10px; color: #64748B; margin-top: 3px; font-weight: 600;">
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

      {/* ── SUB-TOOLBAR: DYNAMIC CERTIFICATE INPUTS ── */}
      <div className="bg-slate-900/95 border-b border-slate-800/90 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
        <div className="flex items-center gap-2 text-slate-300 font-bold text-[11px] uppercase tracking-wider">
          <SlidersHorizontal size={14} className="text-[#2AB0B2]" />
          <span>Pengaturan Penandatangan & Sertifikat:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tempat */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 focus-within:border-[#2AB0B2] transition-colors shadow-inner">
            <MapPin size={12} className="text-[#2AB0B2]" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Tempat:</span>
            <input
              type="text"
              value={certPlace}
              onChange={(e) => {
                setCertPlace(e.target.value);
                localStorage.setItem("cert_pref_place", e.target.value);
              }}
              placeholder="Cimahi"
              className="bg-transparent text-white font-bold text-xs focus:outline-none w-24 placeholder:text-slate-600"
            />
          </div>

          {/* Tanggal */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 focus-within:border-[#2AB0B2] transition-colors shadow-inner">
            <Calendar size={12} className="text-[#2AB0B2]" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Tanggal:</span>
            <input
              type="text"
              value={certDate}
              onChange={(e) => {
                setCertDate(e.target.value);
                localStorage.setItem("cert_pref_date", e.target.value);
              }}
              placeholder="September 2026"
              className="bg-transparent text-white font-bold text-xs focus:outline-none w-28 placeholder:text-slate-600"
            />
          </div>

          {/* Nama Penandatangan */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 focus-within:border-[#2AB0B2] transition-colors shadow-inner">
            <User size={12} className="text-[#2AB0B2]" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Nama:</span>
            <input
              type="text"
              value={directorName}
              onChange={(e) => {
                setDirectorName(e.target.value);
                localStorage.setItem("cert_pref_director", e.target.value);
              }}
              placeholder="M. FIRAS FAISAL"
              className="bg-transparent text-white font-bold text-xs focus:outline-none w-36 placeholder:text-slate-600"
            />
          </div>

          {/* Jabatan */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 focus-within:border-[#2AB0B2] transition-colors shadow-inner">
            <Award size={12} className="text-[#2AB0B2]" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Jabatan:</span>
            <input
              type="text"
              value={directorTitle}
              onChange={(e) => {
                setDirectorTitle(e.target.value);
                localStorage.setItem("cert_pref_title", e.target.value);
              }}
              placeholder="Direktur Utama"
              className="bg-transparent text-white font-bold text-xs focus:outline-none w-28 placeholder:text-slate-600"
            />
          </div>

          {/* Nomor Sertifikat */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 focus-within:border-[#2AB0B2] transition-colors shadow-inner">
            <FileText size={12} className="text-[#2AB0B2]" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">No. Sertifikat:</span>
            <input
              type="text"
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              placeholder="CTF-SKT/06/2026-0054"
              className="bg-transparent text-white font-bold text-xs focus:outline-none w-44 placeholder:text-slate-600"
            />
          </div>
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
                backgroundImage: "url('/cert_template_front_clean.png')",
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
              }}
            >
              {/* Title SERTIFIKAT */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "22.0%",
                  textAlign: "center",
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: "34px",
                  fontWeight: 900,
                  color: "#1A3842",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                }}
              >
                SERTIFIKAT
              </div>

              {/* Text PRAKTEK KERJA INDUSTRI di dalam pita asli */}
              <div
                style={{
                  position: "absolute",
                  left: "30.47%",
                  width: "39.16%",
                  top: "29.62%",
                  height: "4.37%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#FFFFFF",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                }}
              >
                PRAKTEK KERJA INDUSTRI
              </div>

              {/* Subtitle INDUSTRIAL PRACTICE CERTIFICATE */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "35.26%",
                  textAlign: "center",
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#9CB3B8",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                }}
              >
                INDUSTRIAL PRACTICE CERTIFICATE
              </div>

              {/* No Sertifikat */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "38.36%",
                  textAlign: "center",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  color: "#334155",
                }}
              >
                No: <span style={{ fontWeight: 800, color: "#1E293B", marginLeft: "4px" }}>{certNumber}</span>
              </div>

              {/* Sertifikat ini menyatakan bahwa */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "43.16%",
                  textAlign: "center",
                  fontSize: "11px",
                  color: "#64748B",
                }}
              >
                Sertifikat ini menyatakan bahwa:
              </div>

              {/* Nama Siswa */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "46.83%",
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: "22px",
                    fontWeight: 900,
                    color: "#0F172A",
                    letterSpacing: "0.02em",
                    borderBottom: "2px solid #0F172A",
                    paddingBottom: "2px",
                    display: "inline-block",
                  }}
                >
                  {student.student_name}
                </span>
              </div>

              {/* Asal Sekolah */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "54.44%",
                  textAlign: "center",
                  fontSize: "11px",
                  color: "#475569",
                }}
              >
                Asal Sekolah : <strong style={{ color: "#0F172A", fontWeight: 800, marginLeft: "4px" }}>{student.school_name || "Politeknik Negeri Bandung"}</strong>
              </div>

              {/* Keterangan Selesai */}
              <div
                style={{
                  position: "absolute",
                  left: "16%",
                  right: "16%",
                  top: "58.67%",
                  textAlign: "center",
                  fontSize: "10px",
                  color: "#64748B",
                  lineHeight: 1.55,
                }}
              >
                Dinyatakan selesai melaksanakan Praktek Kerja Industri di Perusahaan kami<br />
                dan dengan nilai yang tercantum dibalik sertifikat ini.
              </div>

              {/* Footer Kiri: Logo + Alamat (Di dalam area putih bersih) */}
              <div
                style={{
                  position: "absolute",
                  left: "21.5%",
                  top: "70.5%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <img src="/logo.png" style={{ height: "38px", objectFit: "contain" }} alt="Sampulkreativ Logo" />
                <div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", fontWeight: 900, color: "#1E293B", letterSpacing: "0.04em" }}>
                    SAMPULKREATIV
                  </div>
                  <div style={{ fontSize: "8px", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    TECHNOLOGY
                  </div>
                  <div style={{ fontSize: "7.5px", color: "#94A3B8", lineHeight: 1.3, marginTop: "2px" }}>
                    Gedung BITC Lantai 3<br />
                    Jl. HMS Mintaredja Baros Kota Cimahi
                  </div>
                </div>
              </div>

              {/* Footer Kanan: Tanggal & Tanda Tangan (Di dalam area putih bersih) */}
              <div
                style={{
                  position: "absolute",
                  right: "20.5%",
                  top: "69.5%",
                  width: "160px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#1E293B", marginBottom: "34px" }}>
                  {certFullDate}
                </div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", fontWeight: 900, color: "#1E293B", borderBottom: "2px solid #1E293B", paddingBottom: "2px", display: "inline-block", width: "100%" }}>
                  {directorName}
                </div>
                <div style={{ fontSize: "9px", color: "#64748B", marginTop: "2px", fontWeight: 600 }}>
                  {directorTitle}
                </div>
              </div>
            </div>
          </div>
        )}

        {(activeTab === "all" || activeTab === "back") && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Halaman 2 — Sisi Belakang (Transkrip Nilai)
            </span>
            <div
              className="relative w-[920px] h-[637px] bg-white rounded-xl shadow-2xl overflow-hidden select-none"
              style={{
                backgroundImage: "url('/cert_template_back_clean.png')",
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
              }}
            >
              {/* Judul Belakang */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "15.0%",
                  textAlign: "center",
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: "13.5px",
                  fontWeight: 900,
                  color: "#1E293B",
                }}
              >
                Nilai Praktek Kerja Industri No sertifikat: {certNumber}
              </div>

              {/* Tabel Nilai */}
              <div
                style={{
                  position: "absolute",
                  left: "14%",
                  right: "14%",
                  top: "21.0%",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    border: "1.5px solid #1E293B",
                    background: "#FFFFFF",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#F1F5F9" }}>
                      <th style={{ border: "1.5px solid #1E293B", padding: "6px 8px", textAlign: "center", fontSize: "10px", fontWeight: 900, width: "36px", color: "#1E293B" }}>
                        No
                      </th>
                      <th style={{ border: "1.5px solid #1E293B", padding: "6px 10px", textAlign: "left", fontSize: "10px", fontWeight: 900, color: "#1E293B" }}>
                        Komponen Penilaian
                      </th>
                      {gradeData.months.map(m => (
                        <th
                          key={m.month_number}
                          style={{ border: "1.5px solid #1E293B", padding: "6px 6px", textAlign: "center", fontSize: "10px", fontWeight: 900, width: "70px", color: "#1E293B", background: "#F1F5F9" }}
                        >
                          {m.month_label}
                        </th>
                      ))}
                      <th style={{ border: "1.5px solid #1E293B", padding: "6px 6px", textAlign: "center", fontSize: "10px", fontWeight: 900, width: "75px", color: "#1E293B" }}>
                        Skor Akhir
                      </th>
                      <th style={{ border: "1.5px solid #1E293B", padding: "6px 6px", textAlign: "center", fontSize: "10px", fontWeight: 900, width: "75px", color: "#1E293B" }}>
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
                        {row.monthScores.map((sc, mIdx) => (
                          <td
                            key={mIdx}
                            style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "10px", fontWeight: "bold", color: "#1E293B" }}
                          >
                            {sc !== null ? sc : "—"}
                          </td>
                        ))}
                        <td style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "10.5px", fontWeight: 900, color: "#1E293B" }}>
                          {row.finalScore}
                        </td>
                        <td style={{ border: "1.5px solid #1E293B", padding: "5px 6px", textAlign: "center", fontSize: "10.5px", fontWeight: 900, color: "#1E293B" }}>
                          {row.predikat}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: "#F8FAFC" }}>
                      <td
                        colSpan={2 + gradeData.months.length}
                        style={{ border: "1.5px solid #1E293B", padding: "6px 10px", fontSize: "10px", fontWeight: 900, color: "#1E293B", textAlign: "right" }}
                      >
                        Rata-rata Keseluruhan
                      </td>
                      <td style={{ border: "1.5px solid #1E293B", padding: "6px 6px", textAlign: "center", fontSize: "11px", fontWeight: 900, color: "#1E293B" }}>
                        {overallScore}
                      </td>
                      <td style={{ border: "1.5px solid #1E293B", padding: "6px 6px", textAlign: "center", fontSize: "10px", fontWeight: 900, color: "#1E293B" }}>
                        {overallPredikatLabel}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Footer: Catatan Pembimbing (Kiri Bawah) */}
              <div
                style={{
                  position: "absolute",
                  left: "14%",
                  top: "66.0%",
                  width: "380px",
                }}
              >
                <div
                  style={{
                    border: "1.5px solid #CBD5E1",
                    background: "rgba(255, 255, 255, 0.95)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "9.5px",
                      fontWeight: 900,
                      color: "#1E293B",
                      marginBottom: "4px",
                    }}
                  >
                    💬 CATATAN PERKEMBANGAN SISWA
                  </div>
                  <div style={{ fontSize: "8.5px", color: "#334155", lineHeight: 1.35 }}>
                    {gradeData.months.some(m => m.notes) ? (
                      gradeData.months.filter(m => m.notes).map(m => (
                        <div key={m.month_number} style={{ marginBottom: "2px" }}>
                          <strong>{m.month_label}:</strong> {m.notes}
                        </div>
                      ))
                    ) : (
                      <span style={{ color: "#94A3B8", fontStyle: "italic" }}>
                        Siswa menunjukkan perkembangan yang sangat baik selama masa PKL dan menyelesaikan seluruh tugas dengan tanggung jawab.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer: Tanda Tangan Direktur (Kanan Bawah) */}
              <div
                style={{
                  position: "absolute",
                  right: "14%",
                  top: "65.5%",
                  width: "170px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#1E293B", marginBottom: "34px" }}>
                  {certFullDate}
                </div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: "11px",
                    fontWeight: 900,
                    color: "#1E293B",
                    borderBottom: "2px solid #1E293B",
                    paddingBottom: "2px",
                    display: "inline-block",
                    width: "100%",
                  }}
                >
                  {directorName}
                </div>
                <div style={{ fontSize: "9px", color: "#64748B", marginTop: "2px", fontWeight: 600 }}>
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