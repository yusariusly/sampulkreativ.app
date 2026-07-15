"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Award, ChevronDown, Check, BookOpen, ClipboardList, Save,
  Settings, Plus, Trash2, Edit, X, Loader2, Star, Tag, MessageSquare,
} from "lucide-react";

interface Curriculum { id: string; title: string; duration_months: number; student_count: number; }
interface Student { student_id: string; student_name: string; start_date: string; end_date: string; }
interface MonthData {
  month_number: number; month_label: string; month_start: string; month_end: string;
  activity_score: number | null; notes: string | null;
  kie_submitted: number; kie_target: number; kie_pct: number; working_days: number;
  accumulation: number | null;
}
interface CertGradeData {
  num_months: number; start_date: string; end_date: string;
  settings: { activity_weight: number; kie_weight: number; aspect_label: string };
  months: MonthData[]; final_grade: number | null;
}
interface AppTag { id: number; label: string; is_active: number; }

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="animate-spin text-[#2AB0B2]" size={28} />
    </div>
  );
}
function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-12"><p className="text-sm text-slate-400 font-medium">{message}</p></div>;
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
  const [pendingScores, setPendingScores] = useState<Record<number, string>>({});
  const [savingMonth, setSavingMonth] = useState<number | null>(null);
  const [allTags, setAllTags] = useState<AppTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [globalNotes, setGlobalNotes] = useState("");
  const [settings, setSettings] = useState({ activity_weight: 50, kie_weight: 50, aspect_label: "Kedisiplinan" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagLabel, setEditingTagLabel] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3000); };

  const fetchCurricula = useCallback(async () => {
    try {
      const res = await fetch("/api/pkl-templates");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCurricula(data);
      if (data.length > 0) setSelectedCurriculumId(prev => prev || data[0].id);
    } catch { setErrorMsg("Gagal memuat kurikulum"); }
  }, []);

  const fetchStudents = useCallback(async (cid: string) => {
    try {
      const res = await fetch("/api/pkl-templates/" + cid + "/students");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const mapped = data.map((s: any) => ({
        student_id: s.student_id,
        student_name: s.nama_lengkap,
        start_date: s.start_date ? new Date(s.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
        end_date: s.end_date ? new Date(s.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      }));
      setStudents(mapped);
      setSelectedStudentId(mapped.length > 0 ? mapped[0].student_id : null);
    } catch { setErrorMsg("Gagal memuat siswa"); }
  }, []);

  const fetchGrades = useCallback(async (sid: string, cid: string) => {
    setLoadingGrades(true); setPendingScores({});
    try {
      const res = await fetch("/api/cert-grades?student_id=" + sid + "&curriculum_id=" + cid);
      if (!res.ok) throw new Error();
      const data: CertGradeData = await res.json();
      setGradeData(data);
      setSettings({ activity_weight: data.settings.activity_weight, kie_weight: data.settings.kie_weight, aspect_label: data.settings.aspect_label });
      const init: Record<number, string> = {};
      data.months.forEach(m => { if (m.activity_score !== null) init[m.month_number] = String(m.activity_score); });
      setPendingScores(init);
    } catch { setErrorMsg("Gagal memuat nilai"); }
    finally { setLoadingGrades(false); }
  }, []);

  const fetchTags = useCallback(async () => {
    try { const r = await fetch("/api/cert-tags"); if (!r.ok) throw new Error(); setAllTags(await r.json()); }
    catch { setErrorMsg("Gagal memuat tag"); }
  }, []);

  const fetchStudentTags = useCallback(async (sid: string, cid: string) => {
    try { const r = await fetch("/api/cert-student-tags?student_id=" + sid + "&curriculum_id=" + cid); if (!r.ok) throw new Error(); const d = await r.json(); setSelectedTagIds(d.map((t: { tag_id: number }) => t.tag_id)); }
    catch {}
  }, []);

  useEffect(() => { fetchCurricula(); fetchTags(); }, [fetchCurricula, fetchTags]);
  useEffect(() => { if (selectedCurriculumId) fetchStudents(selectedCurriculumId); }, [selectedCurriculumId, fetchStudents]);
  useEffect(() => {
    if (selectedStudentId && selectedCurriculumId) {
      fetchGrades(selectedStudentId, selectedCurriculumId);
      fetchStudentTags(selectedStudentId, selectedCurriculumId);
    } else { setGradeData(null); }
  }, [selectedStudentId, selectedCurriculumId, fetchGrades, fetchStudentTags]);

  const saveMonthGrade = async (mn: number) => {
    if (!selectedStudentId || !selectedCurriculumId) return;
    const v = pendingScores[mn];
    if (v === undefined || v === "") return;
    const score = parseFloat(v);
    if (isNaN(score) || score < 0 || score > 100) { setErrorMsg("Nilai harus 0–100"); return; }
    setSavingMonth(mn);
    try {
      const r = await fetch("/api/cert-grades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_id: selectedStudentId, curriculum_id: selectedCurriculumId, month_number: mn, activity_score: score, notes: globalNotes || null }) });
      if (!r.ok) throw new Error();
      showSuccess("Nilai Bulan " + mn + " tersimpan!");
      fetchGrades(selectedStudentId, selectedCurriculumId);
    } catch { setErrorMsg("Gagal menyimpan"); }
    finally { setSavingMonth(null); }
  };

  const saveAll = async () => {
    if (!selectedStudentId || !selectedCurriculumId) return;
    const entries = Object.entries(pendingScores).filter(([, v]) => v !== "");
    if (!entries.length) return;
    setSavingMonth(-1);
    try {
      for (const [mn, v] of entries) {
        const score = parseFloat(v);
        if (!isNaN(score) && score >= 0 && score <= 100) await fetch("/api/cert-grades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_id: selectedStudentId, curriculum_id: selectedCurriculumId, month_number: parseInt(mn), activity_score: score, notes: globalNotes || null }) });
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
    try {
      await fetch("/api/cert-settings/" + selectedCurriculumId, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      showSuccess("Pengaturan tersimpan!");
      if (selectedStudentId) fetchGrades(selectedStudentId, selectedCurriculumId);
    } catch { setErrorMsg("Gagal menyimpan pengaturan"); }
    finally { setSavingSettings(false); }
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

  const currentCurriculum = curricula.find(c => c.id === selectedCurriculumId);
  const currentStudent = students.find(s => s.student_id === selectedStudentId);
  const gradeColor = (g: number | null) => !g ? "text-slate-400" : g >= 85 ? "text-emerald-600" : g >= 70 ? "text-amber-600" : "text-rose-600";

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
      {errorMsg && <div className="mb-5 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in"><span>⚠️ {errorMsg}</span><button onClick={() => setErrorMsg("")} className="ml-auto text-rose-400 hover:text-rose-600 cursor-pointer">Tutup</button></div>}
      {successMsg && <div className="mb-5 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-2 animate-in fade-in"><span>✅ {successMsg}</span><button onClick={() => setSuccessMsg("")} className="ml-auto text-emerald-400 hover:text-emerald-600 cursor-pointer">Tutup</button></div>}

      {/* TAB: INPUT NILAI */}
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
                  {isCurriculumOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsCurriculumOpen(false)} />
                      <div className="absolute top-[40px] left-0 min-w-[240px] bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[280px] overflow-y-auto">
                        {curricula.map(c => (
                          <button key={c.id} type="button" onClick={() => { setSelectedCurriculumId(c.id); setIsCurriculumOpen(false); }} className={`w-full text-left px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center justify-between transition-colors cursor-pointer ${c.id === selectedCurriculumId ? "bg-[#2AB0B2] text-white" : "text-slate-700 hover:bg-slate-50"}`}>
                            <span>{c.title}</span>
                            {c.id === selectedCurriculumId && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
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
                  {isStudentOpen && students.length > 0 && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsStudentOpen(false)} />
                      <div className="absolute top-[40px] left-0 min-w-[260px] bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[280px] overflow-y-auto">
                        {students.map(s => (
                          <button key={s.student_id} type="button" onClick={() => { setSelectedStudentId(s.student_id); setIsStudentOpen(false); }} className={`w-full text-left px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center justify-between transition-colors cursor-pointer ${s.student_id === selectedStudentId ? "bg-[#2AB0B2] text-white" : "text-slate-700 hover:bg-slate-50"}`}>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{s.student_name}</span>
                              <span className={`text-[9px] font-semibold mt-0.5 ${s.student_id === selectedStudentId ? "text-white/70" : "text-slate-400"}`}>{s.start_date} – {s.end_date}</span>
                            </div>
                            {s.student_id === selectedStudentId && <Check size={12} className="ml-2 flex-shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {gradeData && Object.keys(pendingScores).length > 0 && (
                <button onClick={saveAll} disabled={savingMonth === -1} className="ml-auto flex items-center gap-1.5 bg-[#2AB0B2] hover:bg-[#209092] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-60 shadow-sm">
                  {savingMonth === -1 ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Simpan Semua</span>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          {!selectedStudentId || !selectedCurriculumId ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-10 text-center">
              <p className="text-slate-400 text-sm font-medium">Pilih kurikulum dan siswa untuk mulai menginput nilai.</p>
            </div>
          ) : loadingGrades ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8"><LoadingSpinner /></div>
          ) : gradeData ? (
            <>
              {/* Grade Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardList size={16} className="text-[#2AB0B2]" />
                    Nilai Bulanan — {currentStudent?.student_name}
                  </h2>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Bobot: Aktivitas {gradeData.settings.activity_weight}% · KIE {gradeData.settings.kie_weight}%
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100">
                        {["Periode", "Nilai Aktivitas", "KIE Selesai", "KIE Target", "KIE %", "Akumulasi", "Simpan"].map(h => (
                          <th key={h} className={`${h === "Periode" ? "text-left px-5" : "text-center px-4"} py-3 font-black text-slate-400 uppercase tracking-wider text-[9px]`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gradeData.months.map(month => {
                        const pv = pendingScores[month.month_number];
                        return (
                          <tr key={month.month_number} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-700">{month.month_label}</div>
                              <div className="text-[9px] text-slate-400 mt-0.5">{month.month_start} s/d {month.month_end}</div>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <input type="number" min="0" max="100" step="0.01"
                                value={pv ?? (month.activity_score !== null ? String(month.activity_score) : "")}
                                onChange={e => setPendingScores(p => ({ ...p, [month.month_number]: e.target.value }))}
                                placeholder="0–100"
                                className="w-20 text-center text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2AB0B2]/20 focus:border-[#2AB0B2] bg-white transition-all"
                              />
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold text-slate-700">{month.kie_submitted}</td>
                            <td className="px-4 py-3.5 text-center text-slate-500">{month.kie_target}</td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`font-bold px-2 py-0.5 rounded-lg text-[10px] ${month.kie_pct >= 80 ? "bg-emerald-50 text-emerald-600" : month.kie_pct >= 50 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"}`}>
                                {month.kie_pct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              {month.accumulation !== null
                                ? <span className={`font-black text-sm ${gradeColor(month.accumulation)}`}>{month.accumulation.toFixed(2)}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <button onClick={() => saveMonthGrade(month.month_number)} disabled={savingMonth === month.month_number || !pv}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-40 mx-auto ${pv ? "bg-[#2AB0B2] text-white" : "bg-slate-100 text-slate-500"}`}>
                                {savingMonth === month.month_number ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                                <span>Simpan</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Final grade */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Star size={15} className="text-amber-500" />
                    <span className="text-xs font-bold text-slate-700">Nilai Sertifikat Final</span>
                    <span className="text-[10px] text-slate-400">(rata-rata akumulasi semua bulan)</span>
                  </div>
                  {gradeData.final_grade !== null
                    ? <span className={`text-xl font-black ${gradeColor(gradeData.final_grade)}`}>{gradeData.final_grade.toFixed(2)}</span>
                    : <span className="text-slate-300 text-sm font-bold">Belum ada nilai</span>}
                </div>
              </div>

              {/* Tags + Notes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Tag size={15} className="text-[#2AB0B2]" />Tag Apresiasi Cepat</h3>
                    <button onClick={saveTags} disabled={savingTags} className="flex items-center gap-1 bg-[#2AB0B2] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer active:scale-95 disabled:opacity-60">
                      {savingTags ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}<span>Simpan</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4"><MessageSquare size={15} className="text-[#2AB0B2]" />Catatan Pembimbing</h3>
                  <textarea value={globalNotes} onChange={e => setGlobalNotes(e.target.value)} placeholder="Tulis catatan atau apresiasi untuk siswa ini..." rows={5}
                    className="w-full text-xs text-slate-700 border border-slate-200 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-[#2AB0B2]/20 focus:border-[#2AB0B2] resize-none transition-all placeholder:text-slate-300" />
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* TAB: PENGATURAN */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-in fade-in duration-200">
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

          {/* Tags Master Data */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-5"><Tag size={16} className="text-[#2AB0B2]" />Pengaturan Tag Apresiasi</h2>
            <div className="flex gap-2 mb-5">
              <input type="text" value={newTagLabel} onChange={e => setNewTagLabel(e.target.value)} placeholder="Label tag baru, cth: Tepat Waktu"
                onKeyDown={e => { if (e.key === "Enter") addTag(); }}
                className="flex-1 text-sm font-medium px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#2AB0B2]/5 focus:border-[#2AB0B2] transition-all" />
              <button onClick={addTag} disabled={addingTag || !newTagLabel.trim()} className="flex items-center gap-1.5 bg-[#2AB0B2] hover:bg-[#209092] text-white px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer active:scale-95 disabled:opacity-50 shrink-0">
                {addingTag ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}<span>Tambah</span>
              </button>
            </div>
            <div className="space-y-2">
              {allTags.map(tag => (
                <div key={tag.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-colors">
                  {editingTagId === tag.id ? (
                    <input type="text" value={editingTagLabel} onChange={e => setEditingTagLabel(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === "Enter") updateTag(tag.id); if (e.key === "Escape") setEditingTagId(null); }}
                      className="flex-1 text-xs font-semibold border border-[#2AB0B2] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2AB0B2]/20 bg-white mr-2" />
                  ) : (
                    <div className="flex items-center gap-2.5 flex-1">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tag.is_active ? "bg-emerald-400" : "bg-slate-300"}`} />
                      <span className="text-xs font-semibold text-slate-700">{tag.label}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    {editingTagId === tag.id ? (
                      <>
                        <button onClick={() => updateTag(tag.id)} className="p-1.5 text-emerald-500 hover:text-emerald-700 cursor-pointer rounded-lg hover:bg-emerald-50"><Check size={13} /></button>
                        <button onClick={() => setEditingTagId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg hover:bg-slate-100"><X size={13} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingTagId(tag.id); setEditingTagLabel(tag.label); }} className="p-1.5 text-slate-400 hover:text-[#2AB0B2] cursor-pointer rounded-lg hover:bg-slate-100" title="Edit"><Edit size={13} /></button>
                        <button onClick={() => deleteTag(tag.id)} className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer rounded-lg hover:bg-rose-50" title="Hapus"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!allTags.length && <EmptyState message="Belum ada tag apresiasi." />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
