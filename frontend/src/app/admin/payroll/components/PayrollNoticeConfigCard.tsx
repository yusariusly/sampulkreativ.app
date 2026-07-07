"use client";

import React, { useState, useEffect } from "react";
import { Megaphone, Save, CheckCircle, Calendar } from "lucide-react";

const TEMPLATES = [
  { id: "1", text: "Gajian bulan ini akan ditransfer pada tanggal [Tanggal]." },
  { id: "2", text: "Slip gaji dan pembayaran akan diproses pada tanggal [Tanggal]." },
  { id: "3", text: "Estimasi transfer gajian: [Tanggal]. Mohon ditunggu." }
];

export default function PayrollNoticeConfigCard() {
  const [noticeDate, setNoticeDate] = useState("");
  const [templateId, setTemplateId] = useState("1");
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setNoticeDate(data.payroll_notice_date || "");
          setTemplateId(data.payroll_notice_template_id || "1");
          setIsActive(data.payroll_notice_active === "1");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const formatDateIndonesian = (dateStr: string) => {
    if (!dateStr) return "[Tanggal]";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "[Tanggal]";
    
    const days = date.getDate();
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${days} ${monthName} ${year}`;
  };

  const getPreviewText = () => {
    const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
    const formattedDate = formatDateIndonesian(noticeDate);
    return template.text.replace("[Tanggal]", formattedDate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccess(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payroll_notice_date: noticeDate,
          payroll_notice_template_id: templateId,
          payroll_notice_active: isActive ? "1" : "0",
          // We can also save the processed text to backend so any simple client can read it directly
          payroll_notice_text: getPreviewText()
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setErrorMsg(data.error || "Gagal menyimpan pengumuman");
      }
    } catch (err) {
      setErrorMsg("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-5 border-b border-gray-50 pb-3">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-[#2AB0B2]" />
            <h3 className="font-bold text-[#1C3D3F] text-base">Notice Tanggal Gajian</h3>
          </div>
          {!loading && (
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2AB0B2]"></div>
              <span className="text-[10px] font-bold text-gray-400 ml-2 uppercase">
                {isActive ? "Aktif" : "Nonaktif"}
              </span>
            </label>
          )}
        </div>

        {loading ? (
          <div className="text-xs text-gray-400 py-4 font-semibold">Memuat data pengumuman...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Input */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
                  Tanggal Gajian
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={noticeDate}
                    onChange={(e) => setNoticeDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-xs text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all cursor-pointer"
                    required={isActive}
                  />
                </div>
              </div>

              {/* Template Select */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
                  Template Kalimat
                </label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-xs text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all cursor-pointer"
                >
                  {TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      Template {t.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Preview Block */}
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">
                Live Preview Notice (Tampilan Karyawan):
              </label>
              <div className="text-xs font-semibold text-gray-700 leading-relaxed italic">
                "{getPreviewText()}"
              </div>
            </div>

            {/* Feedback messages */}
            {success && (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 p-3 rounded-xl animate-fadeIn">
                <CheckCircle size={14} />
                <span>Notice gajian berhasil diperbarui!</span>
              </div>
            )}

            {errorMsg && (
              <div className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-150 p-3 rounded-xl">
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50 active:scale-97"
              >
                <Save size={14} />
                {saving ? "Menyimpan..." : "Simpan Pengumuman"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
