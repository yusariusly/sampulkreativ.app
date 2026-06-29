"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  ArrowLeft,
  BookOpen,
  Calendar,
  ClipboardList,
  Users,
  Clock,
  Smile,
  CheckSquare,
  User,
  Sparkles,
  Award,
  Settings,
  Edit,
  Check,
  X,
} from "lucide-react";


// ─── Types ───────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  title: string;
  duration_months: number;
  student_count?: number;
}

interface Week {
  id: string;
  template_id: string;
  week_number: number;
  month_number: number;
  milestone_title: string;
}

interface AssignedStudent {
  id: string;
  nama_lengkap: string;
  school_name: string;
}

/** Which view is currently active in the single-panel navigation */
type ActiveView = "list" | "detail";

// ─── Constants ───────────────────────────────────────────────────────────────

const TEAL_PRIMARY = "#2AB0B2";
const TEAL_HOVER = "#1E8E90";
const MAX_DURATION_MONTHS = 6;
const DURATION_OPTIONS = Array.from({ length: MAX_DURATION_MONTHS }, (_, i) => i + 1);

// ─── Shared UI Components ────────────────────────────────────────────────────

/** Reusable text input with consistent styling */
function FormInput({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[9px] font-extrabold text-slate-450 uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm font-medium px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#2AB0B2]/5 focus:border-[#2AB0B2] transition-all bg-white"
      />
    </div>
  );
}

/** Reusable select dropdown with consistent styling */
function FormSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[9px] font-extrabold text-slate-450 uppercase tracking-wider mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm font-medium px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#2AB0B2]/5 focus:border-[#2AB0B2] transition-all bg-white cursor-pointer"
      >
        {children}
      </select>
    </div>
  );
}

/** Primary action button (teal) */
function PrimaryButton({
  children,
  type = "button",
  onClick,
}: {
  children: React.ReactNode;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="w-full bg-[#2AB0B2] hover:bg-[#1E8E90] text-white text-sm font-bold py-2.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
    >
      {children}
    </button>
  );
}

/** Centered loading spinner */
function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="animate-spin text-[#2AB0B2]" size={24} />
    </div>
  );
}

/** Empty state placeholder with icon and message */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-sm text-slate-400 font-medium">{message}</p>
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function PklManagementPage() {
  // ── Navigation State ──
  const [activeView, setActiveView] = useState<ActiveView>("list");

  // ── Data State ──
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<AssignedStudent[]>([]);

  // ── Loading State ──
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // ── Form State: Template ──
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [newTemplateDuration, setNewTemplateDuration] = useState("4");

  // ── Form State: Week ──
  const [newWeekNumber, setNewWeekNumber] = useState("");
  const [newWeekMonth, setNewWeekMonth] = useState("1");
  const [newWeekTitle, setNewWeekTitle] = useState("");

  // ── Error State ──
  const [errorMsg, setErrorMsg] = useState("");

  // ── Dress Code State ──
  const [dressCode, setDressCode] = useState<{ day_number: number; day_name: string; clothes_description: string }[]>([]);
  const [loadingDressCode, setLoadingDressCode] = useState(false);
  const [editingDressDay, setEditingDressDay] = useState<number | null>(null);
  const [editingDressDesc, setEditingDressDesc] = useState("");

  // ── Aspect Settings State ──
  const [aspectSettings, setAspectSettings] = useState<{ aspect_key: string; label: string; icon_name: string; is_active: number }[]>([]);
  const [loadingAspects, setLoadingAspects] = useState(false);
  const [editingAspectKey, setEditingAspectKey] = useState<string | null>(null);
  const [editingAspectLabel, setEditingAspectLabel] = useState("");
  const [editingAspectIcon, setEditingAspectIcon] = useState("");
  const [editingAspectActive, setEditingAspectActive] = useState(1);


  // ─── API Calls ─────────────────────────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/pkl-templates");
      if (!res.ok) throw new Error("Gagal mengambil data template");
      setTemplates(await res.json());
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengambil data template");
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const fetchWeeks = useCallback(async (templateId: string) => {
    setLoadingWeeks(true);
    try {
      const res = await fetch(`/api/pkl-templates/${templateId}/weeks`);
      if (!res.ok) throw new Error("Gagal mengambil data minggu");
      setWeeks(await res.json());
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengambil data minggu");
    } finally {
      setLoadingWeeks(false);
    }
  }, []);

  const fetchAssignedStudents = useCallback(async (templateId: string) => {
    setLoadingStudents(true);
    try {
      const res = await fetch(`/api/pkl-templates/${templateId}/students`);
      if (!res.ok) throw new Error("Gagal mengambil data siswa terdaftar");
      setAssignedStudents(await res.json());
    } catch (err: any) {
      console.error("Gagal memuat siswa terdaftar:", err);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const fetchDressCode = useCallback(async () => {
    setLoadingDressCode(true);
    try {
      const res = await fetch("/api/pkl-dress-code");
      if (!res.ok) throw new Error("Gagal mengambil data pakaian");
      setDressCode(await res.json());
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDressCode(false);
    }
  }, []);

  const fetchAspectSettings = useCallback(async () => {
    setLoadingAspects(true);
    try {
      const res = await fetch("/api/pkl-aspect-settings");
      if (!res.ok) throw new Error("Gagal mengambil data aspek");
      setAspectSettings(await res.json());
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingAspects(false);
    }
  }, []);

  // ── Initial Load ──
  useEffect(() => {
    fetchTemplates();
    fetchDressCode();
    fetchAspectSettings();
  }, [fetchTemplates, fetchDressCode, fetchAspectSettings]);

  const handleSaveDressCode = async (dayNumber: number) => {
    try {
      const res = await fetch("/api/pkl-dress-code", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day_number: dayNumber,
          clothes_description: editingDressDesc,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan pakaian");
      setEditingDressDay(null);
      fetchDressCode();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan pakaian");
    }
  };

  const handleSaveAspectSetting = async (aspectKey: string) => {
    try {
      const res = await fetch("/api/pkl-aspect-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aspect_key: aspectKey,
          label: editingAspectLabel,
          icon_name: editingAspectIcon,
          is_active: editingAspectActive,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan aspek");
      setEditingAspectKey(null);
      fetchAspectSettings();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan aspek");
    }
  };


  // ─── Navigation Handlers ──────────────────────────────────────────────────

  /** Navigate from list → detail view for a specific template */
  const openTemplateDetail = (template: Template) => {
    setSelectedTemplate(template);
    setWeeks([]);
    setAssignedStudents([]);
    setActiveView("detail");
    fetchWeeks(template.id);
    fetchAssignedStudents(template.id);
  };

  /** Navigate back from detail → list view */
  const backToList = () => {
    setActiveView("list");
    setSelectedTemplate(null);
    setWeeks([]);
    setAssignedStudents([]);
  };

  // ─── CRUD: Templates ─────────────────────────────────────────────────────

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateTitle.trim()) return;

    try {
      const res = await fetch("/api/pkl-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTemplateTitle,
          duration_months: parseInt(newTemplateDuration),
        }),
      });
      if (!res.ok) throw new Error("Gagal membuat template");
      setNewTemplateTitle("");
      fetchTemplates();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat template");
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus kurikulum ini beserta semua data di dalamnya?")) return;

    try {
      const res = await fetch(`/api/pkl-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus template");

      // If deleting the currently viewed template, go back to list
      if (selectedTemplate?.id === id) {
        backToList();
      }
      fetchTemplates();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghapus template");
    }
  };

  // ─── CRUD: Weeks ──────────────────────────────────────────────────────────

  const handleAddWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !newWeekNumber || !newWeekTitle.trim()) return;

    try {
      const res = await fetch(`/api/pkl-templates/${selectedTemplate.id}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_number: parseInt(newWeekNumber),
          month_number: parseInt(newWeekMonth),
          milestone_title: newWeekTitle,
        }),
      });
      if (!res.ok) throw new Error("Gagal membuat data minggu");
      setNewWeekNumber("");
      setNewWeekTitle("");
      fetchWeeks(selectedTemplate.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat data minggu");
    }
  };

  const handleDeleteWeek = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus minggu ini?")) return;

    try {
      const res = await fetch(`/api/pkl-weeks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus data minggu");
      if (selectedTemplate) fetchWeeks(selectedTemplate.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghapus data minggu");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 bg-[#F0F2F5] p-4 md:p-8 select-none">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <span className="p-2 bg-[#2AB0B2]/10 rounded-xl text-[#2AB0B2]">
            <ClipboardList size={22} />
          </span>
          Aktivitas PKL
        </h1>
        <p className="text-xs text-slate-500 mt-1.5 ml-[42px]">
          Kelola program kerja dan aktivitas mingguan siswa PKL.
        </p>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2">
          <span>⚠️ {errorMsg}</span>
          <button
            onClick={() => setErrorMsg("")}
            className="ml-auto text-rose-400 hover:text-rose-600 text-xs font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW 1: DAFTAR KURIKULUM
          Tampil saat activeView === "list"
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === "list" && (
        <div className="space-y-6">
          {/* Form: Tambah Kurikulum Baru */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus size={16} className="text-[#2AB0B2]" />
              Tambah Kurikulum Baru
            </h2>

            <form onSubmit={handleAddTemplate} className="space-y-4">
              <FormInput
                label="Nama Program Kerja"
                placeholder="cth: Web Developer"
                value={newTemplateTitle}
                onChange={setNewTemplateTitle}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormSelect
                  label="Durasi Program"
                  value={newTemplateDuration}
                  onChange={setNewTemplateDuration}
                >
                  {DURATION_OPTIONS.map((month) => (
                    <option key={month} value={month}>
                      {month} Bulan
                    </option>
                  ))}
                </FormSelect>

                <div className="flex items-end">
                  <PrimaryButton type="submit">
                    <Plus size={16} /> Simpan
                  </PrimaryButton>
                </div>
              </div>
            </form>
          </div>

          {/* Daftar Kurikulum */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BookOpen size={16} className="text-[#2AB0B2]" />
              Daftar Kurikulum ({templates.length})
            </h2>

            {loadingTemplates ? (
              <LoadingSpinner />
            ) : templates.length === 0 ? (
              <EmptyState message="Belum ada kurikulum. Buat kurikulum pertama Anda di atas." />
            ) : (
              <div className="space-y-3">
                {templates.map((tmpl) => {
                  const studentCount = tmpl.student_count || 0;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => openTemplateDetail(tmpl)}
                      className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/70 bg-white hover:bg-slate-50/50 hover:border-slate-300 transition-all cursor-pointer group"
                    >
                      {/* Template Info */}
                      <div className="flex-1 min-w-0 pr-3">
                        <h3 className="text-sm font-bold text-slate-800 truncate group-hover:text-[#2AB0B2] transition-colors">
                          {tmpl.title}
                        </h3>
                        <div className="flex items-center gap-2.5 mt-2">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Calendar size={11} />
                            {tmpl.duration_months} Bulan
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                            studentCount > 0
                              ? "bg-emerald-50 text-emerald-700 border-emerald-150"
                              : "bg-slate-50 text-slate-400 border-slate-150"
                          }`}>
                            <Users size={10} />
                            {studentCount} Siswa
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          className="p-2 text-slate-350 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Hapus Kurikulum"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Jadwal Pakaian Harian */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Settings size={16} className="text-[#2AB0B2]" />
              Jadwal Ketentuan Pakaian (Senin - Jumat)
            </h2>

            {loadingDressCode ? (
              <LoadingSpinner />
            ) : (
              <div className="divide-y divide-slate-100">
                {dressCode.map((item) => (
                  <div key={item.day_number} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-20 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                        {item.day_name}
                      </span>
                      {editingDressDay === item.day_number ? (
                        <input
                          type="text"
                          value={editingDressDesc}
                          onChange={(e) => setEditingDressDesc(e.target.value)}
                          className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2AB0B2] w-64 bg-slate-50"
                        />
                      ) : (
                        <span className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200/60 px-3 py-1 rounded-xl">
                          {item.clothes_description}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                      {editingDressDay === item.day_number ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveDressCode(item.day_number)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Simpan"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDressDay(null)}
                            className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                            title="Batal"
                          >
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDressDay(item.day_number);
                            setEditingDressDesc(item.clothes_description);
                          }}
                          className="p-1.5 text-slate-455 hover:text-[#2AB0B2] hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Pakaian"
                        >
                          <Edit size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pengaturan Aspek Evaluasi */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Award size={16} className="text-[#2AB0B2]" />
              Pengaturan Aspek Poin Apresiasi
            </h2>

            {loadingAspects ? (
              <LoadingSpinner />
            ) : (
              <div className="divide-y divide-slate-100">
                {aspectSettings.map((aspect) => (
                  <div key={aspect.aspect_key} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1">
                      {editingAspectKey === aspect.aspect_key ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-end">
                          <div>
                            <label className="block text-[8px] font-extrabold text-slate-400 uppercase mb-1">Label Aspek</label>
                            <input
                              type="text"
                              value={editingAspectLabel}
                              onChange={(e) => setEditingAspectLabel(e.target.value)}
                              className="text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2AB0B2] w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-extrabold text-slate-400 uppercase mb-1">Ikon</label>
                            <select
                              value={editingAspectIcon}
                              onChange={(e) => setEditingAspectIcon(e.target.value)}
                              className="text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2AB0B2] w-full bg-white"
                            >
                              <option value="Clock">Clock (Waktu)</option>
                              <option value="Smile">Smile (Sikap)</option>
                              <option value="CheckSquare">CheckSquare (Hasil)</option>
                              <option value="User">User (Kerapian)</option>
                              <option value="Sparkles">Sparkles (Inisiatif)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[8px] font-extrabold text-slate-400 uppercase mb-1">Status</label>
                            <select
                              value={editingAspectActive}
                              onChange={(e) => setEditingAspectActive(parseInt(e.target.value))}
                              className="text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2AB0B2] w-full bg-white"
                            >
                              <option value={1}>Aktif (Tampilkan)</option>
                              <option value={0}>Nonaktif (Sembunyikan)</option>
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-3 py-1 rounded-xl border flex items-center gap-1.5 ${
                            aspect.is_active ? "bg-indigo-50/60 text-indigo-700 border-indigo-100" : "bg-slate-50 text-slate-400 border-slate-200/60"
                          }`}>
                            {aspect.label}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50 border border-slate-200/50 px-2 py-0.5 rounded">
                            Ikon: {aspect.icon_name}
                          </span>
                          <span className={`text-[10px] font-extrabold ${aspect.is_active ? "text-emerald-600" : "text-rose-500"}`}>
                            {aspect.is_active ? "● Aktif" : "○ Nonaktif"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                      {editingAspectKey === aspect.aspect_key ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveAspectSetting(aspect.aspect_key)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Simpan"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAspectKey(null)}
                            className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                            title="Batal"
                          >
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAspectKey(aspect.aspect_key);
                            setEditingAspectLabel(aspect.label);
                            setEditingAspectIcon(aspect.icon_name);
                            setEditingAspectActive(aspect.is_active);
                          }}
                          className="p-1.5 text-slate-455 hover:text-[#2AB0B2] hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Aspek"
                        >
                          <Edit size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW 2: DETAIL KURIKULUM + DAFTAR MINGGU
          Tampil saat activeView === "detail" dan selectedTemplate ada
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === "detail" && selectedTemplate && (
        <div className="space-y-6">
          {/* Back Button */}
          <button
            onClick={backToList}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-[#2AB0B2] transition-colors cursor-pointer mb-6"
          >
            <ArrowLeft size={16} />
            Kembali ke Daftar Kurikulum
          </button>

          {/* Info Kurikulum Terpilih */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
            <span className="text-[9px] font-black text-[#2AB0B2] uppercase tracking-widest block mb-1">
              Kurikulum Terpilih
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 leading-snug">
              {selectedTemplate.title}
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
              Durasi: <span className="text-[#2AB0B2]">{selectedTemplate.duration_months} Bulan</span>
            </p>

            {/* Siswa Aktif */}
            <div className="border-t border-slate-100 mt-4 pt-4">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2.5 flex items-center gap-1.5">
                <Users size={12} />
                Siswa Aktif ({assignedStudents.length})
              </span>

              {loadingStudents ? (
                <div className="flex items-center gap-1.5 py-1">
                  <Loader2 className="animate-spin text-[#2AB0B2]" size={12} />
                  <span className="text-xs text-slate-400">Memuat...</span>
                </div>
              ) : assignedStudents.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">
                  Belum ada siswa aktif yang terdaftar di kurikulum ini.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignedStudents.map((st) => (
                    <span
                      key={st.id}
                      className="text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg"
                      title={st.school_name}
                    >
                      {st.nama_lengkap}
                      <span className="font-normal text-emerald-500 ml-1">({st.school_name})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Form: Tambah Aktivitas Mingguan */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus size={16} className="text-[#2AB0B2]" />
              Tambah Aktivitas Mingguan
            </h2>

            <form onSubmit={handleAddWeek} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormSelect
                  label="Bulan Ke"
                  value={newWeekMonth}
                  onChange={setNewWeekMonth}
                >
                  {Array.from({ length: selectedTemplate.duration_months }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Bulan {i + 1}
                    </option>
                  ))}
                </FormSelect>

                <FormInput
                  label="Minggu Ke"
                  placeholder="cth: 1"
                  value={newWeekNumber}
                  onChange={setNewWeekNumber}
                  type="number"
                />
              </div>

              <FormInput
                label="Target / Judul Aktivitas"
                placeholder="cth: Mengenal Dasar Javascript"
                value={newWeekTitle}
                onChange={setNewWeekTitle}
              />

              <PrimaryButton type="submit">
                <Plus size={16} /> Tambah Minggu
              </PrimaryButton>
            </form>
          </div>

          {/* Daftar Aktivitas Mingguan */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar size={16} className="text-[#2AB0B2]" />
              Aktivitas Mingguan ({weeks.length})
            </h2>

            {loadingWeeks ? (
              <LoadingSpinner />
            ) : weeks.length === 0 ? (
              <EmptyState message="Belum ada aktivitas mingguan. Tambahkan di form di atas." />
            ) : (
              <div className="space-y-3">
                {weeks.map((wk) => (
                  <div
                    key={wk.id}
                    className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/70 bg-white hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Week Info */}
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-md">
                          Minggu {wk.week_number}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Bulan {wk.month_number}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 leading-snug break-words">
                        {wk.milestone_title}
                      </h3>
                    </div>

                    {/* Delete Action */}
                    <button
                      onClick={() => handleDeleteWeek(wk.id)}
                      className="p-2 text-slate-350 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer flex-shrink-0"
                      title="Hapus Minggu"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
