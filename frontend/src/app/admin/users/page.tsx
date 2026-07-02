"use client";

import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, CheckCircle2, X, User, Smartphone, Check, ShieldCheck, Users, AlertTriangle, Info } from "lucide-react";

const ROLE_STYLE: Record<string, string> = {
  pengguna: "bg-gray-100 text-gray-600",
  permanent: "bg-blue-50 text-blue-600",
  user: "bg-gray-100 text-gray-600",
  employee: "bg-blue-50 text-blue-600",
  student: "bg-purple-50 text-purple-600",
  mentor: "bg-amber-50 text-[#F59E0B]",
  admin: "bg-teal-50 text-teal-600",
};

interface UserAccount {
  id: string;
  username: string;
  nama_lengkap: string;
  role: string;
  is_active: boolean;
  foto_profile?: string;
  device_id?: string;
  device_info?: string;
  jabatan?: string;
  email?: string;
  no_telp?: string;
  no_karyawan?: string;
  school_name?: string;
  mentor_id?: string;
  program_template_id?: string;
  start_date?: string;
  end_date?: string;
  kie_submissions_count?: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Form states
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserRole, setEditingUserRole] = useState<string>("employee");
  const [fullname, setFullname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("employee");
  const [jabatan, setJabatan] = useState<string>("");
  const [noKaryawan, setNoKaryawan] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

  // Student PKL fields
  const [schoolName, setSchoolName] = useState("");
  const [programTemplateId, setProgramTemplateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pklTemplates, setPklTemplates] = useState<{ id: string; title: string }[]>([]);

  // Override states
  const [overrideUser, setOverrideUser] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("Hadir");

  // Notifications
  const [notification, setNotification] = useState("");

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification("");
    }, 3500);
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers((prevUsers) => {
          if (prevUsers.length > 0) {
            const currentPending = prevUsers.filter(u => !u.is_active).map(u => u.username);
            const newPending = data.filter((u: any) => !u.is_active);
            newPending.forEach((u: any) => {
              if (!currentPending.includes(u.username)) {
                showToast(`🔔 Pendaftaran Baru: "${u.nama_lengkap}" menunggu persetujuan.`);
              }
            });
          }
          return data;
        });
      }
    } catch (err) {
      console.error("Gagal mengambil daftar pengguna:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/pkl-templates");
      if (res.ok) {
        const data = await res.json();
        setPklTemplates(data);
      }
    } catch (err) {
      console.error("Gagal mengambil program template:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTemplates();
    const interval = setInterval(fetchUsers, 4000);
    return () => clearInterval(interval);
  }, []);

  const resetForm = () => {
    setEditingUserId(null);
    setEditingUserRole("employee");
    setFullname("");
    setUsername("");
    setPassword("");
    setRole("employee");
    setJabatan("");
    setNoKaryawan("");
    setIsActive(true);
    setSchoolName("");
    setProgramTemplateId("");
    setStartDate("");
    setEndDate("");
  };

  const handleEditTrigger = (u: any) => {
    setEditingUserId(u.id);
    setEditingUserRole(u.role);
    setFullname(u.nama_lengkap);
    setUsername(u.username);
    setIsActive(u.is_active);
    setJabatan(u.jabatan || "");
    setNoKaryawan(u.no_karyawan || "");
    setPassword("");
    setSchoolName(u.school_name || "");
    setProgramTemplateId(u.program_template_id || "");
    setStartDate(u.start_date || "");
    setEndDate(u.end_date || "");
    showToast(`✏️ Mode edit untuk "${u.nama_lengkap}" aktif`);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullname.trim()) {
      showToast("⚠️ Nama lengkap wajib diisi");
      return;
    }
    if (!username.trim()) {
      showToast("⚠️ Username wajib diisi");
      return;
    }

    const currentFormRole = editingUserId ? editingUserRole : role;

    if (currentFormRole === "student") {
      if (!schoolName.trim()) {
        showToast("⚠️ Nama sekolah wajib diisi untuk Siswa PKL");
        return;
      }
      if (!programTemplateId) {
        showToast("⚠️ Program template wajib dipilih untuk Siswa PKL");
        return;
      }
      if (!startDate) {
        showToast("⚠️ Tanggal mulai wajib diisi untuk Siswa PKL");
        return;
      }
      if (startDate > todayStr) {
        showToast("Tanggal mulai magang tidak boleh di masa depan");
        return;
      }
      if (!endDate) {
        showToast("⚠️ Tanggal selesai wajib diisi untuk Siswa PKL");
        return;
      }
    }

    if (!editingUserId && !password.trim()) {
      showToast("⚠️ Password wajib diisi untuk akun baru");
      return;
    }

    try {
      if (editingUserId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bodyPayload: any = {
          id: editingUserId,
          nama_lengkap: fullname.trim(),
          username: username.trim().toLowerCase(),
          is_active: isActive,
          role: editingUserRole,
          jabatan: jabatan.trim(),
          no_karyawan: editingUserRole === "employee" ? noKaryawan.trim() : undefined,
          school_name: editingUserRole === "student" ? schoolName.trim() : undefined,
          mentor_id: editingUserRole === "student" ? "usr-admin" : undefined,
          program_template_id: editingUserRole === "student" ? programTemplateId : undefined,
          start_date: editingUserRole === "student" ? startDate : undefined,
          end_date: editingUserRole === "student" ? endDate : undefined
        };
        if (password.trim() !== "") {
          bodyPayload.password = password.trim();
        }

        const res = await fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`✅ Akun "${fullname}" berhasil diperbarui!`);
          fetchUsers();
          resetForm();
        } else {
          showToast(`⚠️ ${data.error || "Gagal menyimpan pengguna"}`);
        }
      } else {
        const bodyPayload = {
          nama_lengkap: fullname.trim(),
          username: username.trim().toLowerCase(),
          password: password.trim(),
          role: role,
          jabatan: jabatan.trim(),
          no_karyawan: role === "employee" ? noKaryawan.trim() : undefined,
          school_name: role === "student" ? schoolName.trim() : undefined,
          mentor_id: role === "student" ? "usr-admin" : undefined,
          program_template_id: role === "student" ? programTemplateId : undefined,
          start_date: role === "student" ? startDate : undefined,
          end_date: role === "student" ? endDate : undefined
        };

        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`✅ Akun "${data.user.nama_lengkap}" berhasil dibuat!`);
          fetchUsers();
          resetForm();
        } else {
          showToast(`⚠️ ${data.error || "Gagal membuat akun"}`);
        }
      }
    } catch (err) {
      showToast("⚠️ Terjadi kesalahan koneksi server");
    }
  };

  const handleOverrideStatus = async () => {
    if (!overrideUser) {
      showToast("⚠️ Silakan pilih karyawan terlebih dahulu");
      return;
    }
    try {
      const res = await fetch("/api/attendance/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: overrideUser, status: overrideStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        const employee = users.find((u) => u.username === overrideUser);
        showToast(`✅ Status absensi "${employee?.nama_lengkap || overrideUser}" berhasil diubah menjadi "${overrideStatus}"`);
        setOverrideUser("");
      } else {
        showToast(`⚠️ ${data.error || "Gagal menerapkan override"}`);
      }
    } catch (err) {
      showToast("⚠️ Gagal menghubungi server");
    }
  };

  const handleDeleteUser = async (usr: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus permanen akun pengguna @${usr}? (Catatan: Data absensi lama tidak akan terhapus dan tetap tersimpan di riwayat).`)) {
      try {
        const res = await fetch("/api/users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: usr }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`🗑️ Akun "${usr}" berhasil dihapus secara permanen`);
          fetchUsers();
        } else {
          showToast(`⚠️ ${data.error || "Gagal menghapus pengguna"}`);
        }
      } catch (err) {
        showToast("⚠️ Terjadi kesalahan koneksi");
      }
    }
  };

  const handleResetDevice = async (usr: string) => {
    if (confirm(`Apakah Anda yakin ingin melepas (reset) ikatan HP untuk @${usr}? Karyawan tersebut akan dapat mendaftarkan HP baru setelah ini.`)) {
      try {
        const res = await fetch("/api/users/reset-device", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: usr }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`🔓 Berhasil mereset perangkat terikat untuk @${usr}`);
          fetchUsers();
        } else {
          showToast(`⚠️ ${data.error || "Gagal mereset perangkat"}`);
        }
      } catch (err) {
        showToast("⚠️ Terjadi kesalahan koneksi");
      }
    }
  };

  const handleApproveUser = async (usr: string) => {
    if (confirm(`Apakah Anda yakin ingin menyetujui pendaftaran akun untuk @${usr}?`)) {
      try {
        const res = await fetch("/api/users/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: usr }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`✅ Akun @${usr} berhasil disetujui`);
          fetchUsers();
        } else {
          showToast(`⚠️ ${data.error || "Gagal menyetujui akun"}`);
        }
      } catch (err) {
        showToast("⚠️ Terjadi kesalahan koneksi");
      }
    }
  };

  // Mengambil nama sekolah unik dari data siswa magang yang terdaftar
  const uniqueSchools = Array.from(
    new Set(
      users
        .filter((u) => u.role.toLowerCase() === "student" && u.school_name)
        .map((u) => u.school_name || "")
    )
  );

  // Determine the effective role for the current form context
  const effectiveRole = editingUserId ? editingUserRole : role.toLowerCase();
  const isAdminForm = effectiveRole === "admin";

  return (
    <div className="flex-1 bg-[#F0F2F5] p-4 md:p-8 select-none relative">
      <datalist id="school-datalist">
        {uniqueSchools.map((sch) => (
          <option key={sch} value={sch} />
        ))}
      </datalist>

      {/* Toast Alert Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-[#1C3D3F] text-white rounded-xl shadow-lg border border-[#2AB0B2]/30 flex items-center gap-2 font-medium text-sm transition-all animate-bounce">
          <CheckCircle2 size={16} className="text-[#2AB0B2]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-[#1C3D3F]">Manajemen Pengguna</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* User Account List Table Grid */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-xs overflow-hidden border border-gray-100/50">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[550px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Username", "Nama Lengkap", "Role", "Perangkat Terikat", "Aksi"].map((h) => (
                    <th key={h} className="text-left px-5 py-4 text-sm font-semibold text-gray-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-sm text-gray-400 font-medium">
                      Memuat daftar karyawan...
                    </td>
                  </tr>
                ) : users.length > 0 ? (
                  users.map((u, i) => (
                    <tr key={i} className="border-b border-gray-55 last:border-0 hover:bg-gray-50/30 transition-colors">
                      <td className="px-5 py-4 text-sm font-mono text-[#1C3D3F] font-semibold">
                        @{u.username}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 font-medium">
                        <div className="font-bold text-[#1C3D3F]">{u.nama_lengkap}</div>
                        {u.no_karyawan && (
                          <div className="text-[10px] text-[#2AB0B2] font-mono font-bold mt-0.5">{u.no_karyawan}</div>
                        )}
                        {u.jabatan && (
                          <div className="text-xs text-gray-400 font-normal mt-0.5">{u.jabatan}</div>
                        )}
                        {u.kie_submissions_count !== undefined && u.kie_submissions_count > 0 && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-600 border border-teal-100">
                              🔑 KIE API: {u.kie_submissions_count}x Setor
                            </span>
                          </div>
                        )}
                        {!u.is_active && (
                          <span className="mt-1 inline-block px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded animate-pulse">
                            Menunggu Persetujuan
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded text-xs font-semibold capitalize ${ROLE_STYLE[u.role.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm max-w-[160px] truncate">
                        {u.device_info ? (
                          <span className="font-semibold px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs" title={u.device_info}>
                            📱 {u.device_info}
                          </span>
                        ) : (
                          <span className="font-semibold px-2 py-1 bg-gray-50 text-gray-400 rounded text-xs">
                            Belum Terikat
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleEditTrigger(u)}
                            className="text-gray-300 hover:text-[#2AB0B2] transition-colors cursor-pointer"
                            title="Edit Akun"
                          >
                            <Edit2 size={16} />
                          </button>
                          {!u.is_active && (
                            <button
                              onClick={() => handleApproveUser(u.username)}
                              className="text-gray-300 hover:text-emerald-500 transition-colors cursor-pointer"
                              title="Setujui Akun"
                            >
                              <Check size={16} />
                            </button>
                          )}
                          {u.device_id && (
                            <button
                              onClick={() => handleResetDevice(u.username)}
                              className="text-gray-300 hover:text-amber-500 transition-colors cursor-pointer"
                              title="Reset Perangkat HP"
                            >
                              <Smartphone size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(u.username)}
                            className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                            title="Hapus Akun Permanen"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-sm text-gray-400 font-medium">
                      Tidak ada data pengguna ditemukan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Panel Sidebars */}
        <div className="space-y-6">
          {/* Add/Edit User Panel */}
          <div className="bg-white rounded-2xl shadow-xs p-5 border border-gray-100/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-sm">
                {editingUserId ? `Edit Akun ${editingUserRole === "admin" ? "Admin" : "Karyawan"}` : "Tambah Akun Baru"}
              </h3>
              {editingUserId && (
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 cursor-pointer" title="Batalkan Edit">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Role Selector */}
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Role / Status Kerja</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (editingUserId) {
                      setEditingUserRole("employee");
                    } else {
                      setRole("employee");
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                    effectiveRole === "employee"
                      ? "bg-[#2AB0B2] text-white border-[#2AB0B2]"
                      : "bg-white text-gray-500 border-gray-200 hover:border-[#2AB0B2] hover:text-[#2AB0B2]"
                  }`}
                >
                  <Users size={13} />
                  Karyawan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editingUserId) {
                      setEditingUserRole("student");
                    } else {
                      setRole("student");
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                    effectiveRole === "student"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white text-gray-500 border-gray-200 hover:border-purple-600 hover:text-purple-600"
                  }`}
                >
                  <User size={13} />
                  Siswa PKL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editingUserId) {
                      setEditingUserRole("admin");
                    } else {
                      setRole("admin");
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                    effectiveRole === "admin"
                      ? "bg-[#1C3D3F] text-white border-[#1C3D3F]"
                      : "bg-white text-gray-500 border-gray-200 hover:border-[#1C3D3F] hover:text-[#1C3D3F]"
                  }`}
                >
                  <ShieldCheck size={13} />
                  Admin
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3">
              {/* Nama Lengkap */}
              <div>
                <input
                  type="text"
                  placeholder="Nama Lengkap"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none transition-colors"
                  required
                />
              </div>

              {/* Jabatan / Keterangan Status - Hide for Admin */}
              {!isAdminForm && (
                <div>
                  <input
                    type="text"
                    placeholder="Jabatan (contoh: Frontend Developer)"
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none transition-colors"
                  />
                </div>
              )}

              {/* Nomor Karyawan - Show only when effectiveRole is employee */}
              {effectiveRole === "employee" && (
                <div>
                  {editingUserId ? (
                    <input
                      type="text"
                      placeholder="Nomor Karyawan"
                      value={noKaryawan}
                      readOnly
                      disabled
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-55 text-gray-500 font-mono cursor-not-allowed outline-none"
                    />
                  ) : (
                    <div className="px-3 py-2.5 text-xs text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-xl font-medium">
                      Nomor Karyawan akan digenerate otomatis oleh sistem.
                    </div>
                  )}
                </div>
              )}

              {/* Student PKL Fields - Show only when effectiveRole is student */}
              {effectiveRole === "student" && (
                <>
                  <div>
                    <input
                      type="text"
                      placeholder="Nama Sekolah / Instansi (wajib)"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      list="school-datalist"
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <select
                      value={programTemplateId}
                      onChange={(e) => setProgramTemplateId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none bg-white text-gray-600 transition-colors cursor-pointer"
                      required
                    >
                      <option value="">Pilih Program Kurikulum (wajib)</option>
                      {pklTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Mulai Magang</label>
                      <input
                        type="date"
                        value={startDate}
                        max={todayStr}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none transition-colors text-gray-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Selesai Magang</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none transition-colors text-gray-600"
                        required
                      />
                    </div>
                  </div>

                  {/* Notice Tanggal Mulai Magang */}
                  <div className={`p-3 rounded-xl border text-[10px] leading-relaxed font-semibold flex items-start gap-1.5 ${
                    editingUserId
                      ? "bg-amber-50 border-amber-100 text-amber-700"
                      : "bg-[#2AB0B2]/5 border-[#2AB0B2]/10 text-slate-650"
                  }`}>
                    {editingUserId ? (
                      <>
                        <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                        <div>
                          <strong>Peringatan:</strong> Mengubah tanggal mulai magang dapat menggeser perhitungan nomor minggu siswa dan berpotensi membuat riwayat nilai harian sebelumnya tampak tidak sinkron.
                        </div>
                      </>
                    ) : (
                      <>
                        <Info size={12} className="flex-shrink-0 mt-0.5 text-[#2AB0B2]" />
                        <div>
                          <strong>Tips:</strong> Disarankan memilih hari <strong>Senin</strong> pada minggu pertama siswa mulai PKL agar pembagian minggu aktivitas (Minggu 1, 2, dst.) terhitung rapi.
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* Username Input (Admin or Employee) */}
              <div>
                <input
                  type="text"
                  placeholder={isAdminForm ? "Username Admin" : "Username Karyawan"}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none transition-colors font-mono"
                  required
                />
              </div>

              {/* Password Input */}
              <div>
                <input
                  type="password"
                  placeholder={editingUserId ? "Password Baru (Kosongkan jika tidak diubah)" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none transition-colors"
                  required={!editingUserId}
                />
              </div>

              {/* Active toggle - only when editing */}
              {editingUserId && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50">
                  <span className="text-sm text-gray-600 font-medium">Status Akun</span>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`relative w-10 h-5 rounded-full transition-all cursor-pointer ${isActive ? "bg-[#2AB0B2]" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isActive ? "left-5.5" : "left-0.5"}`} />
                  </button>
                  <span className={`text-xs font-semibold ${isActive ? "text-[#2AB0B2]" : "text-gray-400"}`}>
                    {isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {editingUserId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-2 w-full py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-colors cursor-pointer bg-[#2AB0B2]"
                >
                  {editingUserId ? "Simpan Perubahan" : `Buat Akun ${role}`}
                </button>
              </div>
            </form>
          </div>

          {/* Override Attendance Status Panel */}
          <div className="bg-white rounded-2xl shadow-xs p-5 border border-gray-100/50">
            <h3 className="font-bold text-gray-800 mb-1 text-sm">Override Status</h3>
            <p className="text-gray-400 text-xs mb-4">Ubah status absensi secara manual</p>
            <div className="space-y-3">
              <select
                value={overrideUser}
                onChange={(e) => setOverrideUser(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none bg-white text-gray-600 transition-colors cursor-pointer"
              >
                <option value="">Pilih Karyawan</option>
                {users
                  .filter((u) => u.role !== "admin")
                  .map((u) => (
                    <option key={u.username} value={u.username}>
                      {u.nama_lengkap}
                    </option>
                  ))}
              </select>
              <select
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none bg-white text-gray-600 transition-colors cursor-pointer"
              >
                <option>Hadir</option>
                <option>Izin</option>
                <option>Sakit</option>
                <option>Alpa</option>
              </select>
              <button
                onClick={handleOverrideStatus}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border-2 transition-all hover:bg-[#F6C13B]/10 cursor-pointer text-[#F6C13B] border-[#F6C13B]"
              >
                Terapkan Override
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
