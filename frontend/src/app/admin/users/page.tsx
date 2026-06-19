"use client";

import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, CheckCircle2, X, User, Smartphone, Check } from "lucide-react";

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
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [fullname, setFullname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("User");
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

    // Poll for new registrations/device bindings every 4 seconds
    const interval = setInterval(fetchUsers, 4000);

    return () => clearInterval(interval);
  }, []);


  const resetForm = () => {
    setEditingUserId(null);
    setFullname("");
    setUsername("");
    setPassword("");
    setRole("User");
    setIsActive(true);
  };

  const handleEditTrigger = (u: UserAccount) => {
    setEditingUserId(u.id);
    setFullname(u.nama_lengkap);
    setUsername(u.username);
    setRole(u.role === "admin" ? "Admin" : "User");
    setIsActive(u.is_active);
    setPassword(""); // Leave password empty unless updating it
    showToast(`✏️ Mode edit untuk "${u.nama_lengkap}" aktif`);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullname.trim() || !username.trim()) {
      showToast(role.toLowerCase() === "admin" ? "⚠️ Nama lengkap dan username wajib diisi" : "⚠️ Nama lengkap dan nomor telepon wajib diisi");
      return;
    }

    const isUserRole = role.toLowerCase() === "user";

    if (!isUserRole && !editingUserId && !password.trim()) {
      showToast("⚠️ Password wajib diisi untuk akun baru");
      return;
    }

    try {
      const method = editingUserId ? "PUT" : "POST";
      const bodyPayload = editingUserId
        ? {
            id: editingUserId,
            nama_lengkap: fullname.trim(),
            username: username.trim().toLowerCase(),
            role: role,
            is_active: isActive,
            password: isUserRole ? "no_password" : (password.trim() !== "" ? password : undefined),
          }
        : {
            nama_lengkap: fullname.trim(),
            username: username.trim().toLowerCase(),
            password: isUserRole ? "no_password" : password.trim(),
            role: role,
          };

      const res = await fetch("/api/users", {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();

      if (res.ok) {
        if (editingUserId) {
          showToast(`✅ Akun "${fullname}" berhasil diperbarui!`);
        } else {
          showToast(`✅ Akun "${data.user.nama_lengkap}" berhasil dibuat!`);
        }
        fetchUsers();
        resetForm();
      } else {
        showToast(`⚠️ ${data.error || "Gagal menyimpan pengguna"}`);
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
        body: JSON.stringify({
          username: overrideUser,
          status: overrideStatus,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const employee = users.find((u) => u.username === overrideUser);
        showToast(
          `✅ Status absensi "${employee?.nama_lengkap || overrideUser}" berhasil diubah menjadi "${overrideStatus}"`
        );
        setOverrideUser("");
      } else {
        showToast(`⚠️ ${data.error || "Gagal menerapkan override"}`);
      }
    } catch (err) {
      showToast("⚠️ Gagal menghubungi server");
    }
  };

  const handleDeleteUser = async (usr: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus permanen pengguna @${usr} beserta seluruh data absensinya? Tindakan ini tidak dapat dibatalkan!`)) {
      try {
        const res = await fetch("/api/users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: usr }),
        });

        const data = await res.json();

        if (res.ok) {
          showToast(`🗑️ Akun "${usr}" berhasil dihapus secara permanen`);
          fetchUsers(); // Refresh list
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
          fetchUsers(); // Refresh list
        } else {
          showToast(`⚠️ ${data.error || "Gagal mereset perangkat"}`);
        }
      } catch (err) {
        showToast("⚠️ Terjadi kesalahan koneksi");
      }
    }
  };

  const handleApproveUser = async (usr: string) => {
    if (confirm(`Apakah Anda yakin ingin menyetujui pendaftaran akun untuk @${usr}? Karyawan tersebut akan dapat langsung masuk dan melakukan absensi.`)) {
      try {
        const res = await fetch("/api/users/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: usr }),
        });

        const data = await res.json();

        if (res.ok) {
          showToast(`✅ Akun @${usr} berhasil disetujui`);
          fetchUsers(); // Refresh list
        } else {
          showToast(`⚠️ ${data.error || "Gagal menyetujui akun"}`);
        }
      } catch (err) {
        showToast("⚠️ Terjadi kesalahan koneksi");
      }
    }
  };

  return (
    <div className="flex-1 bg-[#F0F2F5] p-6 md:p-10 select-none relative">
      {/* Toast Alert Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-[#1C3D3F] text-white rounded-xl shadow-lg border border-[#2AB0B2]/30 flex items-center gap-2 font-medium text-sm transition-all animate-bounce">
          <CheckCircle2 size={16} className="text-[#2AB0B2]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-[#1C3D3F]">Manajemen Pengguna</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* User Account List Table Grid */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-xs overflow-hidden border border-gray-100/50">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[550px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Username / HP", "Nama Lengkap", "Role", "Perangkat Terikat", "Status", "Aksi"].map((h) => (
                    <th key={h} className="text-left px-5 py-4 text-sm font-semibold text-gray-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-sm text-gray-400 font-medium">
                      Memuat daftar karyawan...
                    </td>
                  </tr>
                ) : users.length > 0 ? (
                  users.map((u, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-55 last:border-0 hover:bg-gray-50/30 transition-colors"
                    >
                      <td className="px-5 py-4 text-sm font-mono text-[#1C3D3F] font-semibold">{u.username.match(/^\d+$/) ? u.username : `@${u.username}`}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 font-medium">{u.nama_lengkap}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-1 rounded text-xs font-semibold capitalize ${
                            ROLE_STYLE[u.role.toLowerCase()] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
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
                      <td className="px-5 py-4 text-sm">
                        <span
                          className={`font-bold px-2.5 py-1 rounded text-xs select-none ${
                            u.is_active
                              ? "text-emerald-600 bg-emerald-50"
                              : "text-amber-600 bg-amber-50"
                          }`}
                        >
                          {u.is_active ? "Aktif" : "Menunggu Persetujuan"}
                        </span>
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
                    <td colSpan={6} className="text-center py-8 text-sm text-gray-400 font-medium">
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
                {editingUserId ? "Edit Akun Karyawan" : "Tambah Akun Baru"}
              </h3>
              {editingUserId && (
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Batalkan Edit"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            <form onSubmit={handleSaveUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                  Role Akses
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-600 bg-white transition-colors cursor-pointer"
                >
                  <option>User</option>
                  <option>Admin</option>
                </select>
              </div>

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

              {role.toLowerCase() === "admin" ? (
                <>
                  <div>
                    <input
                      type="text"
                      placeholder="Username Admin"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none transition-colors font-mono"
                      required
                    />
                  </div>
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
                </>
              ) : (
                <>
                  <div>
                    <input
                      type="text"
                      placeholder="Nomor Telepon (HP)"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none transition-colors font-mono"
                      required
                    />
                  </div>
                </>
              )}

              {/* Status Aktif Toggle (Only displayed when editing) */}
              {editingUserId && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                    Status Keaktifan
                  </label>
                  <select
                    value={isActive ? "Aktif" : "Nonaktif"}
                    onChange={(e) => setIsActive(e.target.value === "Aktif")}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-600 bg-white transition-colors cursor-pointer"
                  >
                    <option>Aktif</option>
                    <option>Nonaktif</option>
                  </select>
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
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
                  className="flex-2 py-2.5 rounded-xl text-white text-sm font-semibold hover:bg-[#209092] transition-colors cursor-pointer bg-[#2AB0B2]"
                >
                  {editingUserId ? "Simpan" : "Simpan Akun"}
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
