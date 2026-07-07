"use client";

import React, { useState, useEffect } from "react";
import { UserCheck, Save, CheckCircle } from "lucide-react";

interface ApproverConfigCardProps {
  onApproverUpdated: (name: string, role: string) => void;
}

export default function ApproverConfigCard({
  onApproverUpdated,
}: ApproverConfigCardProps) {
  const [approverName, setApproverName] = useState("");
  const [approverRole, setApproverRole] = useState("");
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
          const name = data.payroll_approver_name || "M. Firas Faisal";
          const role = data.payroll_approver_role || "Direktur Utama";
          setApproverName(name);
          setApproverRole(role);
          onApproverUpdated(name, role);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [onApproverUpdated]);

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
          payroll_approver_name: approverName,
          payroll_approver_role: approverRole,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        onApproverUpdated(approverName, approverRole);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setErrorMsg(data.error || "Gagal menyimpan tanda tangan");
      }
    } catch (err) {
      setErrorMsg("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs">
      <div className="flex items-center gap-2 mb-5 border-b border-gray-50 pb-3">
        <UserCheck size={18} className="text-[#2AB0B2]" />
        <h3 className="font-bold text-[#1C3D3F] text-base">Tanda Tangan Penyetuju</h3>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 py-4 font-semibold">Memuat data penyetuju...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nama Penyetuju */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
                Nama Penyetuju
              </label>
              <input
                type="text"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="Contoh: M. Firas Faisal"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-xs text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all"
                required
              />
            </div>

            {/* Jabatan Penyetuju */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
                Jabatan Penyetuju
              </label>
              <input
                type="text"
                value={approverRole}
                onChange={(e) => setApproverRole(e.target.value)}
                placeholder="Contoh: Direktur Utama"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-xs text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          {/* Feedback messages */}
          {success && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 p-3 rounded-xl animate-fadeIn">
              <CheckCircle size={14} />
              <span>Pengaturan tanda tangan berhasil disimpan!</span>
            </div>
          )}

          {errorMsg && (
            <div className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-150 p-3 rounded-xl">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50 active:scale-97"
            >
              <Save size={14} />
              {saving ? "Menyimpan..." : "Simpan Tanda Tangan"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
