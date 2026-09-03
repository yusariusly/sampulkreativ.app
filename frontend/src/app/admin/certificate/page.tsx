"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import CertificatePrintModal from "./CertificatePrintModal";
import {
  Award, ChevronDown, Check, BookOpen, ClipboardList, Save,
  Settings, Plus, Trash2, Edit, X, Loader2, Star, Tag, MessageSquare,
  Calendar, RotateCcw, CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react";

interface Curriculum { id: string; title: string; duration_months: number; student_count: number; }
interface Student { student_id: string; student_name: string; school_name?: string; no_karyawan?: string | null; start_date: string; end_date: string; }
interface Criterion { id: number; name: string; sort_order: number; }
interface MonthData {
  month_number: number; month_label: string; month_start: string; month_end: string;
  is_custom?: boolean;
  criteria_scores: Record<number, number>;
  activity_avg: number | null; notes: string | null;
  kie_submitted: number; kie_target: number; kie_pct: number; working_days: number;
  accumulation: number | null;
}
interface CertGradeData {
  num_months: number; start_date: string; end_date: string;
  is_custom_months?: boolean;
  settings: { activity_weight: number; kie_weight: number; aspect_label: string };
  criteria: Criterion[];
  months: MonthData[];
  criteria_averages: Record<number, number | null>;
  final_grade: number | null;
  total_kie_submitted?: number;
  total_kie_target?: number;
  kie_overall_pct?: number;
  kie_progress_override?: number | null;
}
interface AppTag { id: number; label: string; is_active: number; }

function LoadingSpinner() {
  return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#2AB0B2]" size={28} /></div>;
}
function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-12"><p className="text-sm text-slate-400 font-medium">{message}</p></div>;
}

/* ── VISUAL DATE RANGE CALENDAR PICKER (Plek Ketiplek Sesuai Desain) ── */
function DateRangeCalendarPicker({
  startDate,
  endDate,
  minDate,
  maxDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  minDate: string;
  maxDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Selection state (click 1 for start, click 2 for end)
  const [tentativeStart, setTentativeStart] = useState<string | null>(null);
  const [tentativeEnd, setTentativeEnd] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Viewing month/year in calendar
  const initialDate = startDate ? new Date(startDate) : (minDate ? new Date(minDate) : new Date());
  const [viewYear, setViewYear] = useState(initialDate.getFullYear() || 2026);
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth() || 5); // 0-indexed

  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync state when opened
  useEffect(() => {
    if (isOpen) {
      setTentativeStart(startDate || null);
      setTentativeEnd(endDate || null);
      setHoverDate(null);
      if (startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) {
          setViewYear(d.getFullYear());
          setViewMonth(d.getMonth());
        }
      }
    }
  }, [isOpen, startDate, endDate]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // Calendar matrix calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun, 1 = Mon ...

  // Min and Max navigation boundaries
  const minD = minDate ? new Date(minDate) : null;
  const maxD = maxDate ? new Date(maxDate) : null;

  const canPrevMonth = !minD || (new Date(viewYear, viewMonth, 1) > new Date(minD.getFullYear(), minD.getMonth(), 1));
  const canNextMonth = !maxD || (new Date(viewYear, viewMonth + 1, 1) <= new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0));

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canPrevMonth) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canNextMonth) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Date selection logic
  const handleDateClick = (dateStr: string) => {
    if (dateStr < minDate || dateStr > maxDate) return;

    if (!tentativeStart || (tentativeStart && tentativeEnd)) {
      // First click: select start date
      setTentativeStart(dateStr);
      setTentativeEnd(null);
    } else {
      // Second click: select end date
      if (dateStr < tentativeStart) {
        setTentativeStart(dateStr);
        setTentativeEnd(null);
      } else {
        setTentativeEnd(dateStr);
        onChange(tentativeStart, dateStr);
        setIsOpen(false);
      }
    }
  };

  const formatDisplay = (dStr: string) => {
    if (!dStr) return "";
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  // Active range range calculation (considering hover)
  const activeStart = tentativeStart || startDate;
  const activeEnd = tentativeEnd || (tentativeStart && hoverDate && hoverDate >= tentativeStart ? hoverDate : endDate);

  return (
    <div className="relative w-full" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white hover:border-[#2AB0B2] hover:bg-slate-50/70 transition-all cursor-pointer shadow-3xs"
      >
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-[#2AB0B2]" />
          <span className="text-slate-800 font-extrabold">
            {formatDisplay(startDate)}
          </span>
          <span className="text-slate-400 font-normal">s/d</span>
          <span className="text-slate-800 font-extrabold">
            {formatDisplay(endDate)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-[#2AB0B2] font-extrabold bg-[#2AB0B2]/10 px-2 py-0.5 rounded-lg">
          <span>Pilih di Kalender</span>
          <ChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* ── DROPDOWN RANGE CALENDAR ── */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-[310px] animate-in fade-in zoom-in-95 duration-150 select-none">
          {/* Header Month & Year */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={!canPrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-sm font-black text-slate-800 tracking-tight">
              {monthNames[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={!canNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* PKL Boundary Notice */}
          <div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200/80 rounded-xl p-2 mb-3 text-center leading-tight">
            {!tentativeStart || (tentativeStart && tentativeEnd) ? (
              <span>📌 <strong>Klik 1:</strong> Pilih tanggal mulai</span>
            ) : (
              <span className="text-[#2AB0B2] font-bold">🎯 <strong>Klik 2:</strong> Pilih tanggal selesai</span>
            )}
            <div className="text-[9px] text-slate-400 mt-0.5">
              Batas PKL: {formatDisplay(minDate)} – {formatDisplay(maxDate)}
            </div>
          </div>

          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-0 text-center mb-1">
            {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d, i) => (
              <span key={i} className="text-[10px] font-black text-slate-400 uppercase py-1">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Day Cells (Exact Connected Range Styling) */}
          <div className="grid grid-cols-7 gap-y-1 gap-x-0">
            {/* Empty offset cells before day 1 */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}

            {/* Days 1 to daysInMonth */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const mm = String(viewMonth + 1).padStart(2, "0");
              const dd = String(day).padStart(2, "0");
              const cellDateStr = `${viewYear}-${mm}-${dd}`;

              const isOutOfPkl = cellDateStr < minDate || cellDateStr > maxDate;
              const isStart = cellDateStr === activeStart;
              const isEnd = cellDateStr === activeEnd;
              const isInRange = activeStart && activeEnd && cellDateStr > activeStart && cellDateStr < activeEnd;
              const isRangeActive = activeStart && activeEnd && activeStart < activeEnd;

              const colIndex = (firstDayIndex + i) % 7; // 0 = Sun, 6 = Sat
              const isWeekStart = colIndex === 0 || day === 1;
              const isWeekEnd = colIndex === 6 || day === daysInMonth;

              return (
                <div
                  key={day}
                  onMouseEnter={() => tentativeStart && !tentativeEnd && setHoverDate(cellDateStr)}
                  className={`relative h-8 flex items-center justify-center ${
                    isInRange
                      ? `bg-blue-100 text-blue-900 ${isWeekStart ? 'rounded-l-lg' : ''} ${isWeekEnd ? 'rounded-r-lg' : ''}`
                      : ''
                  } ${
                    isStart && isRangeActive ? 'rounded-l-full bg-gradient-to-r from-transparent 50% to-blue-100 50%' : ''
                  } ${
                    isEnd && isRangeActive ? 'rounded-r-full bg-gradient-to-l from-transparent 50% to-blue-100 50%' : ''
                  }`}
                >
                  <button
                    type="button"
                    disabled={isOutOfPkl}
                    onClick={() => handleDateClick(cellDateStr)}
                    className={`h-8 w-8 rounded-full text-xs flex items-center justify-center z-10 transition-all ${
                      isOutOfPkl
                        ? "text-slate-300 cursor-not-allowed opacity-30 select-none"
                        : isStart || isEnd
                        ? "bg-blue-600 text-white font-black shadow-sm cursor-pointer scale-105"
                        : isInRange
                        ? "text-blue-950 font-bold cursor-pointer hover:bg-blue-200/80"
                        : "text-slate-700 hover:bg-slate-100 cursor-pointer font-semibold"
                    }`}
                  >
                    {day}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Info / Done button */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-bold">
              {startDate && endDate ? `Total: ${Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)} hari` : ''}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-extrabold text-[#2AB0B2] hover:text-[#209092] px-2.5 py-1 rounded-lg hover:bg-[#2AB0B2]/10 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CertificatePage() {
  const [activeTab, setActiveTab] = useState<"grades" | "settings">("grades");
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string | null>(null);
  const [isCurriculumOpen, setIsCurriculumOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentOpen, setIsStudentOpen] = useState(false);
  const [gradeData, setGradeData] = useState<CertGradeData | null>(null);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // pendingScores: { month_number: { criterion_id: string } }
  const [pendingScores, setPendingScores] = useState<Record<number, Record<number, string>>>({});
  const [pendingNotes, setPendingNotes] = useState<Record<number, string>>({});
  const [savingMonth, setSavingMonth] = useState<number | null>(null);

  const [allTags, setAllTags] = useState<AppTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  const [settings, setSettings] = useState({ activity_weight: 50, kie_weight: 50, aspect_label: "Kedisiplinan" });
  const [savingSettings, setSavingSettings] = useState(false);

  // KIE progress override state
  const [kieOverrideInput, setKieOverrideInput] = useState<string>("");
  const [isSavingKieOverride, setIsSavingKieOverride] = useState(false);

  // Month Range Edit Modal States
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [editingMonthsList, setEditingMonthsList] = useState<{ month_number: number; month_label: string; start_date: string; end_date: string }[]>([]);
  const [savingCustomMonths, setSavingCustomMonths] = useState(false);
  const [resettingCustomMonths, setResettingCustomMonths] = useState(false);

  const openMonthEditModal = () => {
    if (!gradeData) return;
    setEditingMonthsList(
      gradeData.months.map(m => ({
        month_number: m.month_number,
        month_label: m.month_label,
        start_date: m.month_start,
        end_date: m.month_end,
      }))
    );
    setIsMonthModalOpen(true);
  };

  const handleMonthFieldChange = (index: number, field: 'month_label' | 'start_date' | 'end_date', value: string) => {
    setEditingMonthsList(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddMonth = () => {
    setEditingMonthsList(prev => {
      const nextNum = prev.length + 1;
      let nextStart = "";
      if (prev.length > 0) {
        const lastEnd = prev[prev.length - 1].end_date;
        const d = new Date(lastEnd);
        d.setDate(d.getDate() + 1);
        nextStart = d.toISOString().split('T')[0];
      }
      return [
        ...prev,
        {
          month_number: nextNum,
          month_label: `Bulan ${nextNum}`,
          start_date: nextStart,
          end_date: nextStart,
        }
      ];
    });
  };

  const handleRemoveMonth = (index: number) => {
    if (editingMonthsList.length <= 1) {
      alert("Minimal harus ada 1 periode bulan.");
      return;
    }
    setEditingMonthsList(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((m, idx) => ({
        ...m,
        month_number: idx + 1,
        month_label: m.month_label.startsWith("Bulan ") ? `Bulan ${idx + 1}` : m.month_label,
      }));
    });
  };

  const handleSaveCustomMonths = async () => {
    if (!selectedStudentId || !selectedCurriculumId) return;
    for (const m of editingMonthsList) {
      if (!m.start_date || !m.end_date) {
        alert("Semua tanggal mulai dan selesai wajib diisi.");
        return;
      }
      if (m.start_date > m.end_date) {
        alert(`Tanggal mulai ${m.month_label} tidak boleh lebih besar dari tanggal selesai.`);
        return;
      }
    }

    setSavingCustomMonths(true);
    try {
      const res = await fetch("/api/cert-student-months", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: selectedStudentId,
          curriculum_id: selectedCurriculumId,
          months: editingMonthsList,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan periode bulan");
      showSuccess("Periode bulan berhasil diperbarui!");
      setIsMonthModalOpen(false);
      fetchGrades(selectedStudentId, selectedCurriculumId);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan periode");
    } finally {
      setSavingCustomMonths(false);
    }
  };

  const handleResetCustomMonths = async () => {
    if (!selectedStudentId || !selectedCurriculumId) return;
    if (!confirm("Apakah Anda yakin ingin mereset periode bulan ke hitungan otomatis sistem?")) return;
    setResettingCustomMonths(true);
    try {
      const res = await fetch(`/api/cert-student-months/reset?student_id=${selectedStudentId}&curriculum_id=${selectedCurriculumId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal mereset periode");
      showSuccess("Periode bulan berhasil direset ke otomatis!");
      setIsMonthModalOpen(false);
      fetchGrades(selectedStudentId, selectedCurriculumId);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mereset");
    } finally {
      setResettingCustomMonths(false);
    }
  };

  // Criteria master data management
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [newCriterionName, setNewCriterionName] = useState("");
  const [addingCriterion, setAddingCriterion] = useState(false);
  const [editingCriterionId, setEditingCriterionId] = useState<number | null>(null);
  const [editingCriterionName, setEditingCriterionName] = useState("");

  // Tag management
  const [newTagLabel, setNewTagLabel] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagLabel, setEditingTagLabel] = useState("");

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const showSuccess = (m: string) => { setSuccessMsg(m); setTimeout(() => setSuccessMsg(""), 3000); };

  const fetchCurricula = useCallback(async () => {
    try {
      const r = await fetch("/api/pkl-templates");
      if (!r.ok) throw new Error();
      const d = await r.json();
      setCurricula(d);
      if (d.length > 0) setSelectedCurriculumId(p => p || d[0].id);
    } catch { setErrorMsg("Gagal memuat kurikulum"); }
  }, []);

  const fetchStudents = useCallback(async (cid: string) => {
    try {
      const r = await fetch("/api/pkl-templates/" + cid + "/students");
      if (!r.ok) throw new Error();
      const d = await r.json();
      const mapped = d.map((s: any) => ({
        student_id: s.student_id,
        student_name: s.nama_lengkap,
        school_name: s.school_name || 'Politeknik Negeri Bandung',
        no_karyawan: s.no_karyawan || null,
        start_date: s.start_date ? new Date(s.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
        end_date: s.end_date ? new Date(s.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      }));
      setStudents(mapped);
      setSelectedStudentId(mapped.length > 0 ? mapped[0].student_id : null);
    } catch { setErrorMsg("Gagal memuat siswa"); }
  }, []);

  const fetchGrades = useCallback(async (sid: string, cid: string) => {
    setLoadingGrades(true); setPendingScores({}); setPendingNotes({});
    try {
      const r = await fetch("/api/cert-grades?student_id=" + sid + "&curriculum_id=" + cid);
      if (!r.ok) throw new Error();
      const d: CertGradeData = await r.json();
      setGradeData(d);
      setSettings({ activity_weight: d.settings.activity_weight, kie_weight: d.settings.kie_weight, aspect_label: d.settings.aspect_label });
      // Init pending from existing scores
      const initScores: Record<number, Record<number, string>> = {};
      const initNotes: Record<number, string> = {};
      d.months.forEach(m => {
        initScores[m.month_number] = {};
        Object.entries(m.criteria_scores).forEach(([cid, val]) => {
          initScores[m.month_number][parseInt(cid)] = String(val);
        });
        if (m.notes) initNotes[m.month_number] = m.notes;
      });
      setPendingScores(initScores);
      setPendingNotes(initNotes);
      setKieOverrideInput(d.kie_progress_override !== null ? String(d.kie_progress_override) : "");
    } catch { setErrorMsg("Gagal memuat nilai"); }
    finally { setLoadingGrades(false); }
  }, []);

  const fetchCriteria = useCallback(async () => {
    try { const r = await fetch("/api/cert-criteria"); if (!r.ok) throw new Error(); setCriteria(await r.json()); }
    catch { setErrorMsg("Gagal memuat kriteria"); }
  }, []);

  const fetchTags = useCallback(async () => {
    try { const r = await fetch("/api/cert-tags"); if (!r.ok) throw new Error(); setAllTags(await r.json()); }
    catch {}
  }, []);

  const fetchStudentTags = useCallback(async (sid: string, cid: string) => {
    try { const r = await fetch("/api/cert-student-tags?student_id=" + sid + "&curriculum_id=" + cid); if (!r.ok) throw new Error(); const d = await r.json(); setSelectedTagIds(d.map((t: { tag_id: number }) => t.tag_id)); }
    catch {}
  }, []);

  useEffect(() => { fetchCurricula(); fetchTags(); fetchCriteria(); }, [fetchCurricula, fetchTags, fetchCriteria]);
  useEffect(() => { if (selectedCurriculumId) fetchStudents(selectedCurriculumId); }, [selectedCurriculumId, fetchStudents]);
  useEffect(() => {
    if (selectedStudentId && selectedCurriculumId) {
      fetchGrades(selectedStudentId, selectedCurriculumId);
      fetchStudentTags(selectedStudentId, selectedCurriculumId);
    } else { setGradeData(null); }
  }, [selectedStudentId, selectedCurriculumId, fetchGrades, fetchStudentTags]);

  // Save scores for a single month
  const saveMonthScores = async (monthNumber: number) => {
    if (!selectedStudentId || !selectedCurriculumId) return;
    const monthScores = pendingScores[monthNumber] || {};
    const scores: Record<number, number> = {};
    for (const [cid, val] of Object.entries(monthScores)) {
      const n = parseFloat(val);
      if (!isNaN(n) && n >= 0 && n <= 10) scores[parseInt(cid)] = n;
    }
    if (!Object.keys(scores).length) return;
    setSavingMonth(monthNumber);
    try {
      const r = await fetch("/api/cert-criterion-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: selectedStudentId, curriculum_id: selectedCurriculumId, month_number: monthNumber, notes: pendingNotes[monthNumber] || null, scores }),
      });
      if (!r.ok) throw new Error();
      showSuccess("Nilai Bulan " + monthNumber + " tersimpan!");
      fetchGrades(selectedStudentId, selectedCurriculumId);
    } catch { setErrorMsg("Gagal menyimpan"); }
    finally { setSavingMonth(null); }
  };

  // Save all months
  const saveAll = async () => {
    if (!selectedStudentId || !selectedCurriculumId || !gradeData) return;
    setSavingMonth(-1);
    try {
      for (const month of gradeData.months) {
        const monthScores = pendingScores[month.month_number] || {};
        const scores: Record<number, number> = {};
        for (const [cid, val] of Object.entries(monthScores)) {
          const n = parseFloat(val);
          if (!isNaN(n) && n >= 0 && n <= 10) scores[parseInt(cid)] = n;
        }
        if (Object.keys(scores).length) {
          await fetch("/api/cert-criterion-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_id: selectedStudentId, curriculum_id: selectedCurriculumId, month_number: month.month_number, notes: pendingNotes[month.month_number] || null, scores }) });
        }
      }
      showSuccess("Semua nilai tersimpan!");
      fetchGrades(selectedStudentId, selectedCurriculumId);
    } catch { setErrorMsg("Gagal menyimpan"); }
    finally { setSavingMonth(null); }
  };

  const saveTags = async () => {
    if (!selectedStudentId || !selectedCurriculumId) return;
    setSavingTags(true);
    try { await fetch("/api/cert-student-tags", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_id: selectedStudentId, curriculum_id: selectedCurriculumId, tag_ids: selectedTagIds }) }); showSuccess("Tag tersimpan!"); }
    catch { setErrorMsg("Gagal menyimpan tag"); }
    finally { setSavingTags(false); }
  };

  const saveSettings = async () => {
    if (!selectedCurriculumId) return;
    if (settings.activity_weight + settings.kie_weight !== 100) { setErrorMsg("Total bobot harus 100%"); return; }
    setSavingSettings(true);
    try { await fetch("/api/cert-settings/" + selectedCurriculumId, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }); showSuccess("Pengaturan tersimpan!"); if (selectedStudentId) fetchGrades(selectedStudentId, selectedCurriculumId); }
    catch { setErrorMsg("Gagal menyimpan pengaturan"); }
    finally { setSavingSettings(false); }
  };

  const addCriterion = async () => {
    if (!newCriterionName.trim()) return;
    setAddingCriterion(true);
    try { await fetch("/api/cert-criteria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCriterionName.trim() }) }); setNewCriterionName(""); fetchCriteria(); if (selectedStudentId && selectedCurriculumId) fetchGrades(selectedStudentId, selectedCurriculumId); }
    catch { setErrorMsg("Gagal menambah kriteria"); }
    finally { setAddingCriterion(false); }
  };

  const updateCriterion = async (id: number) => {
    if (!editingCriterionName.trim()) return;
    try { await fetch("/api/cert-criteria/" + id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editingCriterionName.trim() }) }); setEditingCriterionId(null); fetchCriteria(); if (selectedStudentId && selectedCurriculumId) fetchGrades(selectedStudentId, selectedCurriculumId); }
    catch { setErrorMsg("Gagal memperbarui kriteria"); }
  };

  const deleteCriterion = async (id: number) => {
    if (!window.confirm("Hapus kriteria ini? Semua nilai terkait akan ikut terhapus.")) return;
    try { await fetch("/api/cert-criteria/" + id, { method: "DELETE" }); fetchCriteria(); if (selectedStudentId && selectedCurriculumId) fetchGrades(selectedStudentId, selectedCurriculumId); }
    catch { setErrorMsg("Gagal menghapus kriteria"); }
  };

  const addTag = async () => {
    if (!newTagLabel.trim()) return;
    setAddingTag(true);
    try { await fetch("/api/cert-tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: newTagLabel.trim() }) }); setNewTagLabel(""); fetchTags(); }
    catch { setErrorMsg("Gagal menambah tag"); }
    finally { setAddingTag(false); }
  };

  const updateTag = async (id: number) => {
    if (!editingTagLabel.trim()) return;
    try { await fetch("/api/cert-tags/" + id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: editingTagLabel.trim() }) }); setEditingTagId(null); fetchTags(); }
    catch { setErrorMsg("Gagal memperbarui tag"); }
  };

  const deleteTag = async (id: number) => {
    if (!window.confirm("Hapus tag ini?")) return;
    try { await fetch("/api/cert-tags/" + id, { method: "DELETE" }); fetchTags(); }
    catch { setErrorMsg("Gagal menghapus tag"); }
  };

  const saveKieOverride = async (val: string) => {
    if (!selectedStudentId) return;
    setIsSavingKieOverride(true);
    try {
      const r = await fetch("/api/cert-grades/kie-override", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: selectedStudentId,
          progress_override: val.trim() === "" ? null : parseInt(val, 10),
        }),
      });
      if (!r.ok) throw new Error();
      showSuccess("Progres belajar berhasil diperbarui!");
      if (selectedStudentId && selectedCurriculumId) {
        fetchGrades(selectedStudentId, selectedCurriculumId);
      }
    } catch {
      setErrorMsg("Gagal memperbarui progres override KIE");
    } finally {
      setIsSavingKieOverride(false);
    }
  };

  const currentCurriculum = curricula.find(c => c.id === selectedCurriculumId);
  const currentStudent = students.find(s => s.student_id === selectedStudentId);
  const gradeColor = (g: number | null) => {
    if (!g && g !== 0) return "text-slate-400";
    const val = g <= 10 ? g * 10 : g;
    return val >= 85 ? "text-emerald-600" : val >= 75 ? "text-amber-600" : "text-rose-600";
  };

  const getPredicate = (score: number | null) => {
    if (score === null || score === undefined) return null;
    const val = score <= 10 ? score * 10 : score;
    if (val >= 85) return { letter: "A", label: "Sangat Baik", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    if (val >= 75) return { letter: "B", label: "Baik", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    return { letter: "C", label: "Cukup", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" };
  };

  // Helper: compute live activity_avg from pending scores for a month
  const getLiveActivityAvg = (monthNumber: number, activeCriteria: Criterion[]) => {
    if (!activeCriteria.length) return null;
    const monthScores = pendingScores[monthNumber] || {};
    const vals = activeCriteria.map(c => monthScores[c.id]).filter(v => v !== undefined && v !== "").map(v => parseFloat(v)).filter(v => !isNaN(v) && v >= 0);
    return vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : null;
  };

  // Active criteria (from gradeData if available, otherwise from criteria state)
  const activeCriteria = gradeData?.criteria ?? criteria.filter(c => (c as any).is_active !== 0);

  return (
    <div className="flex-1 bg-[#F0F2F5] p-4 md:p-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-[#2AB0B2]/10 rounded-xl text-[#2AB0B2]"><Award size={22} /></span>
            Nilai Sertifikat PKL
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 ml-[42px]">Input dan kelola nilai sertifikat akhir PKL per siswa.</p>
        </div>
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-xs">
          {(["grades", "settings"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === tab ? "bg-[#2AB0B2] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>
              {tab === "grades" ? <ClipboardList size={14} /> : <Settings size={14} />}
              <span>{tab === "grades" ? "Input Nilai" : "Pengaturan"}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Banners */}
      {errorMsg && <div className="mb-5 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2"><span>⚠️ {errorMsg}</span><button onClick={() => setErrorMsg("")} className="ml-auto text-rose-400 hover:text-rose-600 cursor-pointer">Tutup</button></div>}
      {successMsg && <div className="mb-5 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-2"><span>✅ {successMsg}</span><button onClick={() => setSuccessMsg("")} className="ml-auto text-emerald-400 hover:text-emerald-600 cursor-pointer">Tutup</button></div>}

      {/* ── TAB: INPUT NILAI ── */}
      {activeTab === "grades" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Selectors */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex flex-wrap items-center gap-3">
              {/* Curriculum */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Kurikulum</span>
                <div className="relative">
                  <button type="button" onClick={() => setIsCurriculumOpen(!isCurriculumOpen)} className="flex items-center gap-2 bg-slate-50 px-3.5 py-1.5 border border-slate-200 rounded-xl h-[36px] cursor-pointer hover:border-slate-300 transition-colors">
                    <BookOpen size={13} className="text-[#2AB0B2] flex-shrink-0" />
                    <span className="text-xs font-bold text-slate-700">{currentCurriculum?.title ?? "Pilih Kurikulum"}</span>
                    <ChevronDown size={12} className={`text-slate-400 transition-transform ${isCurriculumOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isCurriculumOpen && (<><div className="fixed inset-0 z-40" onClick={() => setIsCurriculumOpen(false)} /><div className="absolute top-[40px] left-0 min-w-[240px] bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[280px] overflow-y-auto">{curricula.map(c => (<button key={c.id} type="button" onClick={() => { setSelectedCurriculumId(c.id); setIsCurriculumOpen(false); }} className={`w-full text-left px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center justify-between transition-colors cursor-pointer ${c.id === selectedCurriculumId ? "bg-[#2AB0B2] text-white" : "text-slate-700 hover:bg-slate-50"}`}><span>{c.title}</span>{c.id === selectedCurriculumId && <Check size={12} />}</button>))}</div></>)}
                </div>
              </div>

              <div className="h-6 w-px bg-slate-200 hidden sm:block" />

              {/* Student */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Siswa</span>
                <div className="relative">
                  <button type="button" onClick={() => setIsStudentOpen(!isStudentOpen)} disabled={!students.length} className="flex items-center gap-2 bg-slate-50 px-3.5 py-1.5 border border-slate-200 rounded-xl h-[36px] cursor-pointer hover:border-slate-300 transition-colors disabled:opacity-60">
                    <span className="text-xs font-bold text-slate-700">{currentStudent?.student_name ?? "—"}</span>
                    <ChevronDown size={12} className={`text-slate-400 transition-transform ${isStudentOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isStudentOpen && students.length > 0 && (<><div className="fixed inset-0 z-40" onClick={() => setIsStudentOpen(false)} /><div className="absolute top-[40px] left-0 min-w-[260px] bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[280px] overflow-y-auto">{students.map(s => (<button key={s.student_id} type="button" onClick={() => { setSelectedStudentId(s.student_id); setIsStudentOpen(false); }} className={`w-full text-left px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center justify-between transition-colors cursor-pointer ${s.student_id === selectedStudentId ? "bg-[#2AB0B2] text-white" : "text-slate-700 hover:bg-slate-50"}`}><div className="flex flex-col min-w-0"><span className="truncate">{s.student_name}</span><span className={`text-[9px] font-semibold mt-0.5 ${s.student_id === selectedStudentId ? "text-white/70" : "text-slate-400"}`}>{s.start_date} – {s.end_date}</span></div>{s.student_id === selectedStudentId && <Check size={12} className="ml-2 flex-shrink-0" />}</button>))}</div></>)}
                </div>
              </div>

              <button onClick={saveAll} disabled={savingMonth === -1 || !gradeData} className="ml-auto flex items-center gap-1.5 bg-[#2AB0B2] hover:bg-[#209092] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-60 shadow-sm">
                {savingMonth === -1 ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Simpan Semua</span>
              </button>
            </div>
          </div>

          {!selectedStudentId || !selectedCurriculumId ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-10 text-center"><p className="text-slate-400 text-sm font-medium">Pilih kurikulum dan siswa untuk mulai menginput nilai.</p></div>
          ) : loadingGrades ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8"><LoadingSpinner /></div>
          ) : gradeData ? (
            <>
              {/* Multi-Criteria Grade Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-slate-100 gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <ClipboardList size={16} className="text-[#2AB0B2]" />
                      Nilai Bulanan — {currentStudent?.student_name}
                    </h2>
                    <button
                      type="button"
                      onClick={openMonthEditModal}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-[#2AB0B2] bg-[#2AB0B2]/10 hover:bg-[#2AB0B2]/20 px-2.5 py-1 rounded-xl transition-colors cursor-pointer border border-[#2AB0B2]/20 shadow-3xs active:scale-95"
                      title="Atur rentang tanggal periode bulanan"
                    >
                      <Calendar size={12} />
                      <span>Atur Periode Bulan</span>
                    </button>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Bobot: Aktivitas {gradeData.settings.activity_weight}% · KIE {gradeData.settings.kie_weight}%
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100">
                        <th className="text-left px-5 py-3 font-black text-slate-400 uppercase tracking-wider text-[9px] whitespace-nowrap">Periode</th>
                        {activeCriteria.map(c => (
                          <th key={c.id} className="text-center px-3 py-3 font-black text-slate-400 uppercase tracking-wider text-[9px] whitespace-nowrap min-w-[90px]">{c.name}</th>
                        ))}
                        <th className="text-center px-3 py-3 font-black text-slate-400 uppercase tracking-wider text-[9px] whitespace-nowrap bg-slate-100/60">Rata-rata Nilai</th>
                        <th className="text-center px-3 py-3 font-black text-slate-400 uppercase tracking-wider text-[9px] whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradeData.months.map(month => {
                        const liveAvg = getLiveActivityAvg(month.month_number, activeCriteria);
                        return (
                          <tr key={month.month_number} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-700">{month.month_label}</span>
                                <button
                                  type="button"
                                  onClick={openMonthEditModal}
                                  className="p-1 rounded-md text-slate-400 hover:text-[#2AB0B2] hover:bg-[#2AB0B2]/10 transition-colors cursor-pointer"
                                  title="Atur Periode Bulan"
                                >
                                  <Edit size={12} />
                                </button>
                              </div>
                              <div className="text-[9px] text-slate-400 mt-0.5">{month.month_start} s/d {month.month_end}</div>
                            </td>
                            {activeCriteria.map(c => (
                              <td key={c.id} className="px-3 py-3.5 text-center">
                                <span className="inline-block w-[64px] text-center text-xs font-black py-1.5 px-2 bg-slate-50 border border-slate-200/90 rounded-lg text-slate-800 shadow-3xs">
                                  {month.criteria_scores[c.id] !== undefined ? month.criteria_scores[c.id] : "—"}
                                </span>
                              </td>
                            ))}
                            <td className="px-3 py-3.5 text-center bg-slate-50/50">
                              {month.activity_avg !== null ? (
                                <span className={`font-black text-sm ${gradeColor(month.activity_avg)}`}>
                                  {month.activity_avg}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3.5 text-center">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-1 rounded-md">
                                <Check size={11} className="text-emerald-600" />
                                <span>Sinkron</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Per-Criterion Average Summary Row */}
                      {gradeData.months.some(m => Object.keys(m.criteria_scores).length > 0) && (
                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                          <td className="px-5 py-3 font-black text-slate-500 text-[10px] uppercase tracking-wider whitespace-nowrap">Rata-rata Keseluruhan</td>
                          {activeCriteria.map(c => (
                            <td key={c.id} className="px-3 py-3 text-center">
                              {gradeData.criteria_averages[c.id] !== null && gradeData.criteria_averages[c.id] !== undefined
                                ? <span className={`font-black text-sm ${gradeColor(gradeData.criteria_averages[c.id])}`}>{gradeData.criteria_averages[c.id]}</span>
                                : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center bg-slate-100/60">
                            {gradeData.final_grade !== null ? (
                              <span className={`font-black text-sm ${gradeColor(gradeData.final_grade)}`}>
                                {gradeData.final_grade}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center" />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Keterangan Predikat Legend Bar */}
                <div className="flex flex-wrap items-center justify-between px-5 py-2.5 bg-slate-50 border-t border-slate-200/80 text-[11px] gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Keterangan Status:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[10px] shadow-3xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        A (Sangat Baik): 85 – 100
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-extrabold text-[10px] shadow-3xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        B (Baik): 75 – 84
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-[10px] shadow-3xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        C (Cukup): &lt; 75
                      </span>
                    </div>
                  </div>
                </div>

                {/* Final Grade Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Star size={15} className="text-amber-500" />
                    <span className="text-xs font-bold text-slate-700">Nilai Sertifikat Rata-rata</span>
                    <span className="text-[10px] text-slate-400">(rata-rata nilai bulanan)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* KIE Progress Pill next to grade */}
                    {gradeData.kie_overall_pct !== undefined && (
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold ${
                        gradeData.kie_overall_pct >= 100
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                          : "bg-rose-50 text-rose-600 border-rose-200"
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>KIE: {gradeData.kie_overall_pct.toFixed(0)}%</span>
                        {gradeData.kie_overall_pct >= 100 ? (
                          <span className="text-[9px] font-bold opacity-80">(Lunas)</span>
                        ) : (
                          <span className="text-[9px] font-bold opacity-80">(Ada Hutang)</span>
                        )}
                      </div>
                    )}
                    {gradeData.final_grade !== null ? (
                      <span className={`text-2xl font-black ${gradeColor(gradeData.final_grade)}`}>
                        {gradeData.final_grade}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-sm font-bold">Belum ada nilai</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes per Month + Tags + KIE Print Eligibility */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Per-month notes */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <MessageSquare size={15} className="text-[#2AB0B2]" />
                    Catatan per Bulan
                  </h3>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {gradeData.months.map(month => (
                      <div key={month.month_number}>
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">{month.month_label}</label>
                        <textarea
                          value={pendingNotes[month.month_number] ?? (month.notes || "")}
                          onChange={e => setPendingNotes(p => ({ ...p, [month.month_number]: e.target.value }))}
                          placeholder={`Catatan Bulan ${month.month_number}...`}
                          rows={2}
                          className="w-full mt-1 text-xs text-slate-700 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2AB0B2]/20 focus:border-[#2AB0B2] resize-none transition-all placeholder:text-slate-300"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Tag size={15} className="text-[#2AB0B2]" />Tag Apresiasi</h3>
                    <button onClick={saveTags} disabled={savingTags} className="flex items-center gap-1 bg-[#2AB0B2] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer active:scale-95 disabled:opacity-60">
                      {savingTags ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}<span>Simpan</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto">
                    {allTags.filter(t => t.is_active).map(tag => {
                      const on = selectedTagIds.includes(tag.id);
                      return (
                        <button key={tag.id} type="button" onClick={() => setSelectedTagIds(p => on ? p.filter(i => i !== tag.id) : [...p, tag.id])}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${on ? "bg-[#2AB0B2] text-white border-[#2AB0B2]" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#2AB0B2]/40"}`}>
                          {tag.label}
                        </button>
                      );
                    })}
                    {!allTags.filter(t => t.is_active).length && <p className="text-xs text-slate-400">Tambahkan tag di Pengaturan.</p>}
                  </div>
                </div>

                {/* KIE & Cetak Sertifikat */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between md:col-span-1">
                  <div className="space-y-4">
                    {/* Widget: Progres Belajar Siswa */}
                    <div className="bg-slate-50/55 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Progres Belajar Siswa</span>
                          <span className="text-xs font-black text-slate-800">Minggu Relatif (KIE)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {gradeData.kie_progress_override !== null && (
                            <span className="text-[7px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded uppercase tracking-wide">Manual</span>
                          )}
                          <span className="text-sm font-black text-[#2AB0B2]">
                            {gradeData.kie_overall_pct !== undefined ? `${gradeData.kie_overall_pct.toFixed(0)}%` : "0%"}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar Visual */}
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                        <div
                          className="bg-[#2AB0B2] h-full rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.min(100, gradeData.kie_overall_pct ?? 0)}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-slate-400 font-medium">
                        * Dihitung otomatis berdasarkan hari kerja yang telah dilalui.
                      </div>
                    </div>

                    {/* Widget: Atur Progres */}
                    <div className="bg-slate-50/55 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Atur Progres (%)</span>
                        <p className="text-[9px] text-slate-400 mt-1 max-w-[130px]">
                          * Kosongkan untuk kembali ke hitungan otomatis.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={kieOverrideInput}
                          placeholder="Auto"
                          onChange={e => setKieOverrideInput(e.target.value)}
                          onBlur={e => saveKieOverride(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              saveKieOverride(kieOverrideInput);
                            }
                          }}
                          className="w-[84px] text-center text-xs font-bold border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2AB0B2]/20 focus:border-[#2AB0B2] bg-white transition-all text-slate-700 placeholder:text-slate-400"
                        />
                        {isSavingKieOverride && <Loader2 size={13} className="animate-spin text-[#2AB0B2]" />}
                      </div>
                    </div>

                    {/* Status Checkbox/Indicator */}
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl border bg-slate-50/50">
                      {((gradeData.kie_overall_pct ?? 0) >= 100) ? (
                        <>
                          <div className="p-1 bg-emerald-100 rounded-full text-emerald-600 flex-shrink-0 mt-0.5"><Check size={12} className="stroke-[3]" /></div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-emerald-700">Syarat Terpenuhi</span>
                            <span className="text-[10px] text-emerald-600/80">KIE sudah mencapai 100%. Sertifikat siap dicetak.</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-1 bg-rose-100 rounded-full text-rose-600 flex-shrink-0 mt-0.5"><X size={12} className="stroke-[3]" /></div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-rose-700">Belum Memenuhi Syarat</span>
                            <span className="text-[10px] text-rose-600/80">Progres KIE harus mencapai 100% untuk mengaktifkan cetak sertifikat.</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Print Button */}
                  <button
                    onClick={() => setIsPrintModalOpen(true)}
                    disabled={(gradeData.kie_overall_pct ?? 0) < 100}
                    className="w-full mt-5 bg-[#2AB0B2] text-white hover:bg-[#209092] disabled:bg-slate-200 disabled:text-slate-400 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
                  >
                    <Award size={14} />
                    <span>Cetak Sertifikat</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── TAB: PENGATURAN ── */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-in fade-in duration-200">

          {/* Kriteria Penilaian */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-5">
              <ClipboardList size={16} className="text-[#2AB0B2]" />
              Kriteria Penilaian
              <span className="ml-auto text-[10px] font-medium text-slate-400">Nama bisa diubah kapan saja tanpa mempengaruhi nilai</span>
            </h2>
            <div className="flex gap-2 mb-4">
              <input type="text" value={newCriterionName} onChange={e => setNewCriterionName(e.target.value)} placeholder="Nama kriteria baru, cth: Kerapihan" onKeyDown={e => { if (e.key === "Enter") addCriterion(); }}
                className="flex-1 text-sm font-medium px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#2AB0B2]/5 focus:border-[#2AB0B2] transition-all" />
              <button onClick={addCriterion} disabled={addingCriterion || !newCriterionName.trim()} className="flex items-center gap-1.5 bg-[#2AB0B2] hover:bg-[#209092] text-white px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer active:scale-95 disabled:opacity-50 shrink-0">
                {addingCriterion ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}<span>Tambah</span>
              </button>
            </div>
            <div className="space-y-2">
              {criteria.map(cr => (
                <div key={cr.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-colors">
                  {editingCriterionId === cr.id ? (
                    <input type="text" value={editingCriterionName} onChange={e => setEditingCriterionName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === "Enter") updateCriterion(cr.id); if (e.key === "Escape") setEditingCriterionId(null); }}
                      className="flex-1 text-xs font-semibold border border-[#2AB0B2] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2AB0B2]/20 bg-white mr-2" />
                  ) : (
                    <div className="flex items-center gap-2.5 flex-1">
                      <span className="w-5 h-5 rounded-full bg-[#2AB0B2]/10 text-[#2AB0B2] text-[9px] font-black flex items-center justify-center flex-shrink-0">{cr.sort_order}</span>
                      <span className="text-xs font-semibold text-slate-700">{cr.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    {editingCriterionId === cr.id ? (
                      <><button onClick={() => updateCriterion(cr.id)} className="p-1.5 text-emerald-500 hover:text-emerald-700 cursor-pointer rounded-lg hover:bg-emerald-50"><Check size={13} /></button><button onClick={() => setEditingCriterionId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg hover:bg-slate-100"><X size={13} /></button></>
                    ) : (
                      <><button onClick={() => { setEditingCriterionId(cr.id); setEditingCriterionName(cr.name); }} className="p-1.5 text-slate-400 hover:text-[#2AB0B2] cursor-pointer rounded-lg hover:bg-slate-100" title="Ubah Nama"><Edit size={13} /></button><button onClick={() => deleteCriterion(cr.id)} className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer rounded-lg hover:bg-rose-50" title="Hapus"><Trash2 size={13} /></button></>
                    )}
                  </div>
                </div>
              ))}
              {!criteria.length && <EmptyState message="Belum ada kriteria penilaian." />}
            </div>
          </div>

          {/* Bobot */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Settings size={16} className="text-[#2AB0B2]" />Konfigurasi Bobot Penilaian</h2>
              <span className="text-[10px] text-slate-400">Kurikulum: {currentCurriculum?.title ?? "—"}</span>
            </div>
            {!selectedCurriculumId ? <EmptyState message="Pilih kurikulum dari tab Input Nilai." /> : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Label Aspek di Sertifikat</label>
                    <input type="text" value={settings.aspect_label} onChange={e => setSettings(p => ({ ...p, aspect_label: e.target.value }))} placeholder="cth: Kedisiplinan"
                      className="w-full text-sm font-medium px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#2AB0B2]/5 focus:border-[#2AB0B2] transition-all" />
                    <p className="text-[9px] text-slate-400 mt-1">Teks label di sertifikat, tidak mempengaruhi hitungan.</p>
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Bobot Aktivitas (%)</label>
                    <input type="number" min="0" max="100" value={settings.activity_weight} onChange={e => setSettings(p => ({ ...p, activity_weight: parseInt(e.target.value) || 0 }))}
                      className="w-full text-sm font-medium px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#2AB0B2]/5 focus:border-[#2AB0B2] transition-all" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Bobot KIE (%)</label>
                    <input type="number" min="0" max="100" value={settings.kie_weight} onChange={e => setSettings(p => ({ ...p, kie_weight: parseInt(e.target.value) || 0 }))}
                      className="w-full text-sm font-medium px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#2AB0B2]/5 focus:border-[#2AB0B2] transition-all" />
                    <p className={`text-[9px] mt-1 font-semibold ${settings.activity_weight + settings.kie_weight === 100 ? "text-emerald-500" : "text-rose-500"}`}>
                      Total: {settings.activity_weight + settings.kie_weight}% {settings.activity_weight + settings.kie_weight === 100 ? "✓" : "(harus 100%)"}
                    </p>
                  </div>
                </div>
                <div className="pt-2 flex justify-end">
                  <button onClick={saveSettings} disabled={savingSettings || settings.activity_weight + settings.kie_weight !== 100}
                    className="flex items-center gap-2 bg-[#2AB0B2] hover:bg-[#209092] text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer active:scale-95 disabled:opacity-50 shadow-sm">
                    {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}<span>Simpan Pengaturan</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tag Master Data */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-5"><Tag size={16} className="text-[#2AB0B2]" />Pengaturan Tag Apresiasi</h2>
            <div className="flex gap-2 mb-5">
              <input type="text" value={newTagLabel} onChange={e => setNewTagLabel(e.target.value)} placeholder="Label tag baru" onKeyDown={e => { if (e.key === "Enter") addTag(); }}
                className="flex-1 text-sm font-medium px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#2AB0B2]/5 focus:border-[#2AB0B2] transition-all" />
              <button onClick={addTag} disabled={addingTag || !newTagLabel.trim()} className="flex items-center gap-1.5 bg-[#2AB0B2] hover:bg-[#209092] text-white px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer active:scale-95 disabled:opacity-50 shrink-0">
                {addingTag ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}<span>Tambah</span>
              </button>
            </div>
            <div className="space-y-2">
              {allTags.map(tag => (
                <div key={tag.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-colors">
                  {editingTagId === tag.id ? (
                    <input type="text" value={editingTagLabel} onChange={e => setEditingTagLabel(e.target.value)} autoFocus onKeyDown={e => { if (e.key === "Enter") updateTag(tag.id); if (e.key === "Escape") setEditingTagId(null); }}
                      className="flex-1 text-xs font-semibold border border-[#2AB0B2] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2AB0B2]/20 bg-white mr-2" />
                  ) : (
                    <div className="flex items-center gap-2.5 flex-1"><span className={`w-2 h-2 rounded-full flex-shrink-0 ${tag.is_active ? "bg-emerald-400" : "bg-slate-300"}`} /><span className="text-xs font-semibold text-slate-700">{tag.label}</span></div>
                  )}
                  <div className="flex items-center gap-1">
                    {editingTagId === tag.id ? (<><button onClick={() => updateTag(tag.id)} className="p-1.5 text-emerald-500 hover:text-emerald-700 cursor-pointer rounded-lg hover:bg-emerald-50"><Check size={13} /></button><button onClick={() => setEditingTagId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg hover:bg-slate-100"><X size={13} /></button></>) : (<><button onClick={() => { setEditingTagId(tag.id); setEditingTagLabel(tag.label); }} className="p-1.5 text-slate-400 hover:text-[#2AB0B2] cursor-pointer rounded-lg hover:bg-slate-100"><Edit size={13} /></button><button onClick={() => deleteTag(tag.id)} className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer rounded-lg hover:bg-rose-50"><Trash2 size={13} /></button></>)}
                  </div>
                </div>
              ))}
              {!allTags.length && <EmptyState message="Belum ada tag apresiasi." />}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CETAK SERTIFIKAT ── */}
      <CertificatePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        student={currentStudent ?? null}
        curriculumTitle={currentCurriculum?.title || "PKL Angkatan 13"}
        gradeData={gradeData}
        criteria={activeCriteria}
        notes={pendingNotes}
      />

      {/* ── MODAL: ATUR PERIODE TANGGAL BULAN ── */}
      {isMonthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#2AB0B2]/10 rounded-2xl text-[#2AB0B2]">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Atur Periode Bulan Penilaian
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Siswa: <span className="font-bold text-slate-700">{currentStudent?.student_name}</span> ({currentStudent?.start_date} – {currentStudent?.end_date})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMonthModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-2xl text-blue-900 text-xs leading-relaxed flex items-start gap-2.5">
                <span className="text-blue-500 text-sm mt-0.5">💡</span>
                <p>
                  Atur rentang tanggal untuk setiap bulan penilaian sertifikat. Anda dapat menghapus baris bulan yang tidak diperlukan (misalnya siswa hanya magang 2 bulan) atau menyesuaikan tanggal mulai & selesai sesuai kebutuhan sekolah/kantor.
                </p>
              </div>

              {/* Month rows */}
              <div className="space-y-3">
                {editingMonthsList.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/30 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    {/* Month Label */}
                    <div className="w-full sm:w-36">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Nama Periode
                      </label>
                      <input
                        type="text"
                        value={m.month_label}
                        onChange={e => handleMonthFieldChange(idx, 'month_label', e.target.value)}
                        placeholder="cth: Bulan 1"
                        className="w-full text-xs font-bold text-slate-800 border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#2AB0B2]/20 focus:border-[#2AB0B2]"
                      />
                    </div>

                    {/* Unified Date Range Calendar Picker */}
                    <div className="flex-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Rentang Periode Bulan (Kalender)
                      </label>
                      <DateRangeCalendarPicker
                        startDate={m.start_date}
                        endDate={m.end_date}
                        minDate={gradeData?.start_date || "2026-06-29"}
                        maxDate={gradeData?.end_date || "2026-09-04"}
                        onChange={(start, end) => {
                          handleMonthFieldChange(idx, 'start_date', start);
                          handleMonthFieldChange(idx, 'end_date', end);
                        }}
                      />
                    </div>

                    {/* Delete Month Button */}
                    <div className="pt-2 sm:pt-4 flex sm:block justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveMonth(idx)}
                        disabled={editingMonthsList.length <= 1}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Hapus bulan ini"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Month Button */}
              <button
                type="button"
                onClick={handleAddMonth}
                className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-[#2AB0B2] text-slate-600 hover:text-[#2AB0B2] rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer bg-slate-50/40 hover:bg-[#2AB0B2]/5"
              >
                <Plus size={14} />
                <span>Tambah Periode Bulan</span>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetCustomMonths}
                disabled={resettingCustomMonths || savingCustomMonths}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-xs font-bold px-3 py-2 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
              >
                {resettingCustomMonths ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                <span>Reset ke Otomatis</span>
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsMonthModalOpen(false)}
                  disabled={savingCustomMonths || resettingCustomMonths}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomMonths}
                  disabled={savingCustomMonths || resettingCustomMonths}
                  className="flex items-center gap-1.5 bg-[#2AB0B2] hover:bg-[#209092] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {savingCustomMonths ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>Simpan Periode</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
