"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BookOpen, Search, Plus, Check, Pencil } from "lucide-react";

interface StudentSavings {
  student_id: string;
  student_name: string;
  school_name: string;
  saved_amount: number;
  target_amount: number;
  updated_at: string | null;
}

const DEFAULT_TARGET_AMOUNT = 70000;

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default function AdminSavingsPage() {
  const [students, setStudents] = useState<StudentSavings[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalTarget, setGlobalTarget] = useState(DEFAULT_TARGET_AMOUNT);
  const [editingGlobalTarget, setEditingGlobalTarget] = useState(false);
  const [globalTargetInput, setGlobalTargetInput] = useState("");

  // State untuk tracking input deposit per siswa
  const [depositInputs, setDepositInputs] = useState<Record<string, string>>({});
  const [savingStates, setSavingStates] = useState<Record<string, "idle" | "saving" | "saved">>({});

  // State untuk edit langsung total tabungan
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [editAmountInput, setEditAmountInput] = useState("");

  const fetchSavings = useCallback(async () => {
    try {
      const deviceId = localStorage.getItem("v2_device_id") || "";
      const userObj = JSON.parse(localStorage.getItem("v2_user") || "{}");
      const res = await fetch("/api/v1/pkl/savings", {
        headers: {
          "x-user-id": userObj.id || "",
          "x-device-id": deviceId,
        },
      });
      const data = await res.json();
      if (data.status === "success" && data.data) {
        setStudents(data.data);
        // Deteksi target global dari data pertama yang ada
        if (data.data.length > 0) {
          setGlobalTarget(data.data[0].target_amount || DEFAULT_TARGET_AMOUNT);
        }
      }
    } catch (err) {
      console.error("Gagal mengambil data tabungan:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavings();
  }, [fetchSavings]);

  const handleAddDeposit = async (student: StudentSavings) => {
    const depositStr = depositInputs[student.student_id];
    const depositAmount = parseInt(depositStr || "0");
    if (!depositAmount || depositAmount <= 0) return;

    const newTotal = student.saved_amount + depositAmount;

    setSavingStates(prev => ({ ...prev, [student.student_id]: "saving" }));

    try {
      const deviceId = localStorage.getItem("v2_device_id") || "";
      const userObj = JSON.parse(localStorage.getItem("v2_user") || "{}");
      const res = await fetch(`/api/v1/pkl/savings/${student.student_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userObj.id || "",
          "x-device-id": deviceId,
        },
        body: JSON.stringify({
          saved_amount: newTotal,
          target_amount: student.target_amount,
        }),
      });

      if (res.ok) {
        // Update state lokal tanpa refetch — pseudo-realtime
        setStudents(prev =>
          prev.map(s =>
            s.student_id === student.student_id
              ? { ...s, saved_amount: newTotal }
              : s
          )
        );
        setDepositInputs(prev => ({ ...prev, [student.student_id]: "" }));
        setSavingStates(prev => ({ ...prev, [student.student_id]: "saved" }));
        setTimeout(() => {
          setSavingStates(prev => ({ ...prev, [student.student_id]: "idle" }));
        }, 1500);
      }
    } catch (err) {
      console.error("Gagal menyimpan deposit:", err);
      setSavingStates(prev => ({ ...prev, [student.student_id]: "idle" }));
    }
  };

  const handleEditTotal = async (student: StudentSavings) => {
    const newTotal = parseInt(editAmountInput || "0");
    if (newTotal < 0) return;

    setSavingStates(prev => ({ ...prev, [student.student_id]: "saving" }));

    try {
      const deviceId = localStorage.getItem("v2_device_id") || "";
      const userObj = JSON.parse(localStorage.getItem("v2_user") || "{}");
      const res = await fetch(`/api/v1/pkl/savings/${student.student_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userObj.id || "",
          "x-device-id": deviceId,
        },
        body: JSON.stringify({
          saved_amount: newTotal,
          target_amount: student.target_amount,
        }),
      });

      if (res.ok) {
        setStudents(prev =>
          prev.map(s =>
            s.student_id === student.student_id
              ? { ...s, saved_amount: newTotal }
              : s
          )
        );
        setEditingStudent(null);
        setEditAmountInput("");
        setSavingStates(prev => ({ ...prev, [student.student_id]: "saved" }));
        setTimeout(() => {
          setSavingStates(prev => ({ ...prev, [student.student_id]: "idle" }));
        }, 1500);
      }
    } catch (err) {
      console.error("Gagal memperbarui total tabungan:", err);
      setSavingStates(prev => ({ ...prev, [student.student_id]: "idle" }));
    }
  };

  const handleUpdateGlobalTarget = async () => {
    const newTarget = parseInt(globalTargetInput || "0");
    if (newTarget <= 0) return;

    setEditingGlobalTarget(false);
    setGlobalTarget(newTarget);

    // Update target untuk semua siswa
    const deviceId = localStorage.getItem("v2_device_id") || "";
    const userObj = JSON.parse(localStorage.getItem("v2_user") || "{}");

    for (const student of students) {
      try {
        await fetch(`/api/v1/pkl/savings/${student.student_id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userObj.id || "",
            "x-device-id": deviceId,
          },
          body: JSON.stringify({
            saved_amount: student.saved_amount,
            target_amount: newTarget,
          }),
        });
      } catch (err) {
        console.error(`Gagal memperbarui target untuk ${student.student_name}:`, err);
      }
    }

    // Refetch data setelah update selesai
    fetchSavings();
  };

  const filteredStudents = students.filter(s =>
    s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.school_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCollected = students.reduce((sum, s) => sum + s.saved_amount, 0);
  const totalTarget = students.reduce((sum, s) => sum + s.target_amount, 0);
  const completedCount = students.filter(s => s.saved_amount >= s.target_amount).length;

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded-xl w-48" />
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <BookOpen size={16} className="text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Tabungan Buku</h1>
        </div>
        <p className="text-sm text-gray-400 ml-[42px]">
          Kelola progres tabungan buku siswa PKL
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Terkumpul</p>
          <p className="text-base font-bold text-gray-800">{formatRupiah(totalCollected)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">dari {formatRupiah(totalTarget)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Lunas</p>
          <p className="text-base font-bold text-emerald-600">{completedCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">dari {students.length} siswa</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Target</p>
          {editingGlobalTarget ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={globalTargetInput}
                onChange={e => setGlobalTargetInput(e.target.value)}
                className="w-full text-sm font-bold text-gray-800 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#2AB0B2]"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") handleUpdateGlobalTarget();
                  if (e.key === "Escape") setEditingGlobalTarget(false);
                }}
              />
              <button
                onClick={handleUpdateGlobalTarget}
                className="p-1 rounded-md bg-[#2AB0B2] text-white hover:bg-[#209092] transition-colors cursor-pointer flex-shrink-0"
              >
                <Check size={12} />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-1 cursor-pointer group"
              onClick={() => {
                setEditingGlobalTarget(true);
                setGlobalTargetInput(String(globalTarget));
              }}
            >
              <p className="text-base font-bold text-gray-800">{formatRupiah(globalTarget)}</p>
              <Pencil size={10} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
          )}
          <p className="text-[10px] text-gray-400 mt-0.5">per siswa</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          type="text"
          placeholder="Cari nama siswa atau sekolah..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#2AB0B2] bg-white transition-colors"
        />
      </div>

      {/* Student List */}
      <div className="space-y-2.5">
        {filteredStudents.map(student => {
          const percentage = Math.min(
            Math.round((student.saved_amount / student.target_amount) * 100),
            100
          );
          const isComplete = student.saved_amount >= student.target_amount;
          const saveState = savingStates[student.student_id] || "idle";
          const isEditing = editingStudent === student.student_id;

          return (
            <div
              key={student.student_id}
              className={`bg-white rounded-xl border p-4 transition-all ${
                isComplete
                  ? "border-emerald-200 bg-emerald-50/30"
                  : "border-gray-100"
              }`}
            >
              {/* Student Info Row */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{student.student_name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{student.school_name}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editAmountInput}
                        onChange={e => setEditAmountInput(e.target.value)}
                        className="w-24 text-xs font-bold text-gray-800 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#2AB0B2] text-right"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter") handleEditTotal(student);
                          if (e.key === "Escape") {
                            setEditingStudent(null);
                            setEditAmountInput("");
                          }
                        }}
                      />
                      <button
                        onClick={() => handleEditTotal(student)}
                        className="p-1 rounded-md bg-[#2AB0B2] text-white hover:bg-[#209092] transition-colors cursor-pointer"
                      >
                        <Check size={10} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1 cursor-pointer group"
                      onClick={() => {
                        setEditingStudent(student.student_id);
                        setEditAmountInput(String(student.saved_amount));
                      }}
                    >
                      <p className="text-sm font-bold text-gray-800">{formatRupiah(student.saved_amount)}</p>
                      <Pencil size={9} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400">
                    dari {formatRupiah(student.target_amount)}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2.5">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: isComplete ? "#0d9488" : "#2AB0B2",
                  }}
                />
              </div>

              {/* Action Row */}
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold ${isComplete ? "text-emerald-600" : "text-gray-400"}`}>
                  {isComplete ? "✅ Lunas" : `${percentage}%`}
                </span>

                {!isComplete && (
                  <div className="flex items-center gap-1.5">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 font-medium">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={depositInputs[student.student_id] || ""}
                        onChange={e =>
                          setDepositInputs(prev => ({
                            ...prev,
                            [student.student_id]: e.target.value,
                          }))
                        }
                        onKeyDown={e => {
                          if (e.key === "Enter") handleAddDeposit(student);
                        }}
                        className="w-28 pl-7 pr-2 py-1.5 text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg outline-none focus:border-[#2AB0B2] transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => handleAddDeposit(student)}
                      disabled={saveState === "saving" || !depositInputs[student.student_id]}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        saveState === "saved"
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          : saveState === "saving"
                            ? "bg-gray-100 text-gray-400 border border-gray-200"
                            : "bg-[#2AB0B2] text-white hover:bg-[#209092]"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {saveState === "saved" ? (
                        <>
                          <Check size={10} /> Tersimpan
                        </>
                      ) : saveState === "saving" ? (
                        "Menyimpan..."
                      ) : (
                        <>
                          <Plus size={10} /> Tambah
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredStudents.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">
              {searchQuery ? "Tidak ada siswa yang cocok" : "Belum ada data siswa"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
