"use client";

import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, CheckCircle2, X, User, Smartphone, Check, ShieldCheck, Users, AlertTriangle, Info, Bell, Unlock, Key, CreditCard, Download, Globe, Mail, Phone, UserPlus, LogIn } from "lucide-react";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

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
  telegram_chat_id?: string;
  telegram_chat_name?: string;
  card_token?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Card print modal state
  const [cardModalUser, setCardModalUser] = useState<UserAccount | null>(null);
  const [cardDownloading, setCardDownloading] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const downloadCardAsPDF = async (targetUser: UserAccount) => {
    setCardDownloading(true);
    try {
      const frontEl = document.getElementById("admin-card-front");
      const backEl = document.getElementById("admin-card-back");
      if (!frontEl || !backEl) { alert("Elemen kartu tidak ditemukan."); return; }

      const canvasFront = await html2canvas(frontEl, { scale: 4, useCORS: true, allowTaint: true, backgroundColor: null, logging: false });
      const imgFront = canvasFront.toDataURL("image/png");
      const canvasBack = await html2canvas(backEl, { scale: 4, useCORS: true, allowTaint: true, backgroundColor: null, logging: false });
      const imgBack = canvasBack.toDataURL("image/png");

      const cardWidthMm = 86;
      const cardHeightMm = Math.round((canvasFront.height / canvasFront.width) * cardWidthMm);
      const pageWidth = 210; const pageHeight = 297;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const gap = 10;
      const totalW = cardWidthMm * 2 + gap;
      const xStart = (pageWidth - totalW) / 2;
      const yCenter = (pageHeight - cardHeightMm) / 2;
      pdf.addImage(imgFront, "PNG", xStart, yCenter, cardWidthMm, cardHeightMm);
      pdf.addImage(imgBack, "PNG", xStart + cardWidthMm + gap, yCenter, cardWidthMm, cardHeightMm);
      pdf.setFontSize(6); pdf.setTextColor(150, 150, 150);
      pdf.text("DEPAN", xStart + cardWidthMm / 2, yCenter + cardHeightMm + 3, { align: "center" });
      pdf.text("BELAKANG", xStart + cardWidthMm + gap + cardWidthMm / 2, yCenter + cardHeightMm + 3, { align: "center" });
      pdf.save(`Kartu_${targetUser.nama_lengkap.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("Gagal mengunduh PDF kartu:", err);
      alert("Gagal mengunduh PDF kartu.");
    } finally {
      setCardDownloading(false);
    }
  };

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
  const [telegramChatId, setTelegramChatId] = useState("");

  // Student PKL fields
  const [schoolName, setSchoolName] = useState("");
  const [programTemplateId, setProgramTemplateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pklTemplates, setPklTemplates] = useState<{ id: string; title: string }[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);



  // Notifications
  const [notification, setNotification] = useState("");

  const getNotificationDetails = (msg: string) => {
    let icon = <CheckCircle2 size={16} className="text-[#2AB0B2]" />;
    let cleaned = msg;

    if (msg.startsWith("⚠️")) {
      icon = <AlertTriangle size={16} className="text-amber-500" />;
      cleaned = msg.replace(/^⚠️\s*/, "");
    } else if (msg.startsWith("✅")) {
      icon = <CheckCircle2 size={16} className="text-emerald-500" />;
      cleaned = msg.replace(/^✅\s*/, "");
    } else if (msg.startsWith("🗑️")) {
      icon = <Trash2 size={16} className="text-rose-500" />;
      cleaned = msg.replace(/^🗑️\s*/, "");
    } else if (msg.startsWith("🔓")) {
      icon = <Unlock size={16} className="text-blue-500" />;
      cleaned = msg.replace(/^🔓\s*/, "");
    } else if (msg.startsWith("✏️")) {
      icon = <Edit2 size={16} className="text-[#2AB0B2]" />;
      cleaned = msg.replace(/^✏️\s*/, "");
    } else if (msg.startsWith("🔔")) {
      icon = <Bell size={16} className="text-[#2AB0B2]" />;
      cleaned = msg.replace(/^🔔\s*/, "");
    }

    return { icon, cleaned };
  };

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
    setTelegramChatId("");
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
    setTelegramChatId(u.telegram_chat_id || "");
    setIsUserModalOpen(true);
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
          end_date: editingUserRole === "student" ? endDate : undefined,
          telegram_chat_id: telegramChatId.trim()
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
          setIsUserModalOpen(false);
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
          end_date: role === "student" ? endDate : undefined,
          telegram_chat_id: telegramChatId.trim()
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
          setIsUserModalOpen(false);
        } else {
          showToast(`⚠️ ${data.error || "Gagal membuat akun"}`);
        }
      }
    } catch (err) {
      showToast("⚠️ Terjadi kesalahan koneksi server");
    }
  };



    const handleLoginAsUser = (targetUser: UserAccount) => {
    if (typeof window !== "undefined") {
      const currentAdmin = localStorage.getItem("v2_user");
      const currentDeviceId = localStorage.getItem("v2_device_id");
      if (currentAdmin) {
        localStorage.setItem("v2_admin_backup", currentAdmin);
      }
      if (currentDeviceId) {
        localStorage.setItem("v2_admin_device_backup", currentDeviceId);
      }
      localStorage.setItem("v2_is_impersonating", "true");
      localStorage.setItem("v2_user", JSON.stringify(targetUser));
      localStorage.setItem("v2_device_id", targetUser.device_id || "admin-impersonation-device");
      window.location.href = "/user";
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
    <>
    <div className="flex-1 bg-[#F0F2F5] p-4 md:p-8 select-none relative">
      <datalist id="school-datalist">
        {uniqueSchools.map((sch) => (
          <option key={sch} value={sch} />
        ))}
      </datalist>

      {/* Toast Alert Notification */}
      {notification && (() => {
        const { icon, cleaned } = getNotificationDetails(notification);
        return (
          <div className="fixed top-4 right-4 z-50 p-4 bg-[#1C3D3F] text-white rounded-xl shadow-lg border border-[#2AB0B2]/30 flex items-center gap-2 font-medium text-sm transition-all animate-bounce">
            {icon}
            <span>{cleaned}</span>
          </div>
        );
      })()}

      {/* Header section */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-[#1C3D3F]">Manajemen Pengguna</h1>
        <button
          onClick={() => {
            resetForm();
            setIsUserModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <UserPlus size={16} />
          <span>Buat Akun Baru</span>
        </button>
      </div>

      {/* User Account List Table */}
      <div className="bg-white rounded-2xl shadow-xs overflow-hidden border border-gray-100/50">
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
                        {u.telegram_chat_id && (
                          <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                            <span className="font-extrabold text-[#2AB0B2]">Telegram Chat:</span> {u.telegram_chat_name || "Belum ada pesan"} <span className="text-gray-300">|</span> <span className="font-bold text-gray-400">ID:</span> {u.telegram_chat_id}
                          </div>
                        )}
                        {u.kie_submissions_count !== undefined && u.kie_submissions_count > 0 && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-600 border border-teal-100">
                              <Key size={10} className="mr-1 text-teal-600" /> KIE API: {u.kie_submissions_count}x Setor
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
                          <span className="font-semibold px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs inline-flex items-center gap-1" title={u.device_info}>
                            <Smartphone size={10} className="text-slate-500" /> {u.device_info}
                          </span>
                        ) : (
                          <span className="font-semibold px-2 py-1 bg-gray-50 text-gray-400 rounded text-xs">
                            Belum Terikat
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          {u.role !== "admin" && (
                            <button
                              onClick={() => handleLoginAsUser(u)}
                              className="text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95 shadow-3xs"
                              title={`Masuk langsung ke dashboard @${u.username} tanpa QR`}
                            >
                              <LogIn size={13} />
                              <span className="text-[10.5px]">Masuk</span>
                            </button>
                          )}
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
                          {u.role !== "admin" && (
                            <button
                              onClick={() => setCardModalUser(u)}
                              className="text-gray-300 hover:text-[#2AB0B2] transition-colors cursor-pointer"
                              title="Cetak Kartu Karyawan"
                            >
                              <CreditCard size={16} />
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

        {/* Create / Edit User Modal Overlay */}
        {isUserModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in" onClick={() => { resetForm(); setIsUserModalOpen(false); }}>
            <div className="bg-white rounded-3xl overflow-hidden max-w-md w-full shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <h3 className="font-bold text-gray-800 text-base">
                  {editingUserId ? `Edit Akun ${editingUserRole === "admin" ? "Admin" : editingUserRole === "student" ? "Siswa PKL" : "Karyawan"}` : "Tambah Akun Baru"}
                </h3>
                <button onClick={() => { resetForm(); setIsUserModalOpen(false); }} className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer text-gray-400 hover:text-gray-650" title="Tutup">
                  <X size={16} />
                </button>
              </div>

              {/* Role Selector */}
              <div className="flex flex-col gap-1.5 mb-4">
                <label className="text-[10px] font-bold text-gray-405 uppercase tracking-wider">Role / Status Kerja</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRole("employee");
                      setEditingUserRole("employee");
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
                      setRole("student");
                      setEditingUserRole("student");
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
                      setRole("admin");
                      setEditingUserRole("admin");
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

              <form onSubmit={handleSaveUser} className="space-y-3 overflow-y-auto pr-1 flex-1">
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

              {/* Telegram Chat ID Input */}
              <div>
                <input
                  type="text"
                  placeholder="Telegram Group/Chat ID (opsional)"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none transition-colors font-mono"
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
        </div>
      )}
    </div>

      {/* Admin Card Print Modal */}
      {cardModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) setCardModalUser(null); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-800">Pratinjau Kartu Karyawan</h3>
                <p className="text-xs text-gray-400 mt-0.5">{cardModalUser.nama_lengkap}</p>
              </div>
              <button onClick={() => setCardModalUser(null)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"><X size={16} /></button>
            </div>

            {/* Cards Preview */}
            <div className="flex flex-wrap gap-6 justify-center mb-6">

              {/* FRONT CARD — identical to user profile */}
              <div
                id="admin-card-front"
                className="w-[240px] h-[380px] rounded-2xl shadow-xl overflow-hidden flex flex-col relative bg-gradient-to-b from-[#FFFFFF] to-[#F5F7F8] border border-gray-200 flex-shrink-0"
                style={{ fontFamily: "Arial, sans-serif" }}
              >
                {/* Circular patterns white section */}
                <div className="absolute top-[-40px] left-[-40px] w-48 h-48 rounded-full border border-[#2AB0B2]/10 bg-transparent pointer-events-none z-0" />
                <div className="absolute top-[-20px] left-[-20px] w-64 h-64 rounded-full border border-[#2AB0B2]/5 bg-transparent pointer-events-none z-0" />
                <div className="absolute top-[140px] right-[-50px] w-52 h-52 rounded-full border border-[#2AB0B2]/10 bg-transparent pointer-events-none z-0" />

                {/* Top Header */}
                <div className="relative z-10 flex flex-col items-center pt-3.5 pb-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.svg" alt="Logo" className="w-8 h-8 object-contain" />
                  <div className="leading-none text-center mt-1">
                    <div className="text-[8.5px] font-black text-[#1C3D3F] tracking-widest">SAMPULKREATIV</div>
                    <div className="text-[5.5px] text-[#2AB0B2] tracking-widest font-black mt-0.5">TECHNOLOGY</div>
                  </div>
                </div>

                {/* Profile Photo — 140px like user card */}
                <div className="relative z-10 flex flex-col items-center mt-1 px-4">
                  <div
                    className="w-[140px] h-[140px] rounded-full overflow-hidden flex items-center justify-center shadow-lg"
                    style={{ border: "3px solid white", background: "#E5E7EB" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cardModalUser.foto_profile || "/uploads/placeholder.jpg"}
                      alt="Foto"
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  </div>
                </div>

                {/* Bottom diagonal green section */}
                <div
                  className="w-full bg-[#1C3D3F] text-center pt-8 pb-5 px-3 mt-auto relative z-10 flex flex-col items-center justify-center min-h-[145px]"
                  style={{ clipPath: "polygon(0 18px, 100% 0, 100% 100%, 0 100%)" }}
                >
                  <div className="absolute bottom-[-30px] left-[-30px] w-36 h-36 rounded-full border border-white/5 bg-transparent pointer-events-none" />
                  <div className="absolute bottom-[-10px] left-[-10px] w-48 h-48 rounded-full border border-white/5 bg-transparent pointer-events-none" />
                  <div className="absolute top-[-20px] right-[-20px] w-40 h-40 rounded-full border border-white/5 bg-transparent pointer-events-none" />

                  <h5 className="font-extrabold text-[#F6C13B] text-[11px] tracking-wide uppercase leading-tight w-full max-w-[220px] mt-0.5">
                    {cardModalUser.nama_lengkap}
                  </h5>
                  <div className="h-[1px] bg-[#F6C13B]/70 w-32 mx-auto my-1" />
                  <span className="text-white text-[8px] font-bold tracking-widest uppercase block leading-none mb-1">
                    {cardModalUser.jabatan || (cardModalUser.role === 'student' ? 'SISWA PKL' : 'Karyawan')}
                  </span>
                  {cardModalUser.role === "student" ? (
                    cardModalUser.school_name && (
                      <span className="text-[#F6C13B] text-[7.5px] font-bold tracking-wider block leading-none mb-1 uppercase truncate max-w-[200px]">
                        {cardModalUser.school_name}
                      </span>
                    )
                  ) : (
                    cardModalUser.no_karyawan && (
                      <span className="text-[#F6C13B] text-[7.5px] font-mono tracking-wider block leading-none mb-1">
                        {cardModalUser.no_karyawan}
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* BACK CARD — identical to user profile */}
              <div
                id="admin-card-back"
                className="w-[240px] h-[380px] bg-[#1C3D3F] rounded-2xl shadow-lg border border-gray-900 overflow-hidden flex flex-col justify-between relative flex-shrink-0"
                style={{ fontFamily: "Arial, sans-serif" }}
              >
                <div className="absolute top-[-50px] left-[-50px] w-48 h-48 rounded-full border border-white/5 bg-white/2" />
                <div className="absolute top-[-20px] left-[-20px] w-64 h-64 rounded-full border border-white/5 bg-transparent" />
                <div className="absolute bottom-[-100px] right-[-100px] w-72 h-72 rounded-full border border-white/5 bg-[#2AB0B2]/5" />

                {/* QR Code */}
                <div className="flex-1 flex flex-col items-center justify-center z-10 px-4 mt-2">
                  <div className="relative w-40 h-40 bg-white p-2 rounded-xl flex items-center justify-center shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=1c3d3f&ecc=H&data=${encodeURIComponent(
                        cardModalUser.card_token && baseUrl
                          ? `${baseUrl}/station?token=${encodeURIComponent(cardModalUser.card_token)}`
                          : cardModalUser.username
                      )}`}
                      alt="QR Login & Absen"
                      className="w-full h-full object-contain"
                      crossOrigin="anonymous"
                    />
                    <div className="absolute w-7 h-7 bg-white rounded-md flex items-center justify-center p-0.5 shadow-sm border border-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo.svg" alt="SK Logo" className="w-full h-full object-contain" />
                    </div>
                  </div>
                  <div className="flex flex-col items-center leading-none mt-4">
                    <span className="text-[7px] text-[#F6C13B] tracking-wider font-bold mt-1 flex items-center gap-1">
                      <Globe size={8} className="text-[#F6C13B] flex-shrink-0" />
                      <span>sampulkreativ.id</span>
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="w-full text-center text-white px-3 pb-5 pt-2 bg-gradient-to-t from-black/40 to-transparent z-10">
                  <p className="text-[7px] font-bold tracking-wider text-gray-200 uppercase">SAMPULKREATIV TECHNOLOGY</p>
                  <div className="flex justify-center items-center gap-1.5 mt-2.5 text-[5.5px] font-mono text-gray-200 font-bold border-t border-white/10 pt-2">
                    <span className="flex items-center gap-1 truncate max-w-[100px] leading-none">
                      <Mail size={7} className="text-[#F6C13B] flex-shrink-0" strokeWidth={2.5} />
                      <span>{cardModalUser.email || "-"}</span>
                    </span>
                    <span className="text-white/20">|</span>
                    <span className="flex items-center gap-1 leading-none">
                      <Phone size={7} className="text-[#F6C13B] flex-shrink-0" strokeWidth={2.5} />
                      <span>{cardModalUser.no_telp || "-"}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Download Button */}
            <div className="flex gap-3">
              <button onClick={() => setCardModalUser(null)} className="flex-1 py-3 text-xs font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all cursor-pointer border border-gray-200">Tutup</button>
              <button
                onClick={() => downloadCardAsPDF(cardModalUser)}
                disabled={cardDownloading}
                className="flex-2 py-3 text-xs font-bold text-white bg-[#2AB0B2] hover:bg-[#209092] rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Download size={13} />
                {cardDownloading ? "Menyiapkan PDF..." : "Unduh PDF (Gambar)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
