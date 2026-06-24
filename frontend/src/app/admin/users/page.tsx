"use client";

import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, CheckCircle2, X, User, Smartphone, Check, ShieldCheck, Users } from "lucide-react";

const ROLE_STYLE: Record<string, string> = {
  pengguna: "bg-gray-100 text-gray-600",
  permanent: "bg-blue-50 text-blue-600",
  user: "bg-gray-100 text-gray-600",
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
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserRole, setEditingUserRole] = useState<string>("user");
  const [fullname, setFullname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("user");
  const [jabatan, setJabatan] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

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

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 4000);
    return () => clearInterval(interval);
  }, []);

  const resetForm = () => {
    setEditingUserId(null);
    setEditingUserRole("user");
    setFullname("");
    setUsername("");
    setPassword("");
    setRole("user");
    setJabatan("");
    setIsActive(true);
  };

  const handleEditTrigger = (u: UserAccount) => {
    setEditingUserId(u.id);
    setEditingUserRole(u.role);
    setFullname(u.nama_lengkap);
    setUsername(u.username);
    setIsActive(u.is_active);
    setJabatan(u.jabatan || "");
    setPassword("");
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

    const isAdminRole = (editingUserId ? editingUserRole : role) === "admin";

    if (isAdminRole && !editingUserId && !password.trim()) {
      showToast("⚠️ Password wajib diisi untuk akun admin baru");
      return;
    }

    try {
      if (editingUserId) {
        const bodyPayload: any = {
          id: editingUserId,
          nama_lengkap: fullname.trim(),
          username: username.trim().toLowerCase(),
          is_active: isActive,
          role: editingUserRole,
          jabatan: jabatan.trim()
        };
        if (isAdminRole && password.trim() !== "") {
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
          password: isAdminRole ? password.trim() : "no_password",
          role: role,
          jabatan: jabatan.trim()
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

  // Determine the effective role for the current form context
  const effectiveRole = editingUserId ? editingUserRole : role.toLowerCase();
  const isAdminForm = effectiveRole === "admin";

  return (
    <div className="flex-1 bg-[#F0F2F5] p-4 md:p-8 select-none relative">
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
                        {u.jabatan && (
                          <div className="text-xs text-gray-400 font-normal mt-0.5">{u.jabatan}</div>
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (editingUserId) {
                      setEditingUserRole("user");
                    } else {
                      setRole("user");
                      setUsername("");
                      setPassword("");
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                    (editingUserId ? editingUserRole : role) === "user"
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
                      setEditingUserRole("admin");
                    } else {
                      setRole("admin");
                      setUsername("");
                      setPassword("");
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                    (editingUserId ? editingUserRole : role) === "admin"
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

              {/* Password Input (Admin Only) */}
              {isAdminForm && (
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
              )}

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
