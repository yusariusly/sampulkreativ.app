"use client";

import React, { useEffect, useState } from "react";
import { 
  Settings, Clock, CheckCircle2, Save, MapPin, Send, Mail, 
  Trophy, AlertTriangle, Calendar, CalendarDays, Trash2, 
  ChevronLeft, ChevronRight, Plus, Palmtree 
} from "lucide-react";

export default function AdminSettingsPage() {
  const [deadlineTime, setDeadlineTime] = useState("08:30");
  const [checkoutTime, setCheckoutTime] = useState("17:00");
  const [officeLatitude, setOfficeLatitude] = useState("");
  const [officeLongitude, setOfficeLongitude] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramChatIdKaryawan, setTelegramChatIdKaryawan] = useState("");
  const [telegramChatIdKie, setTelegramChatIdKie] = useState("");
  const [showPklScoreboard, setShowPklScoreboard] = useState(true);

  // SMTP state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpTo, setSmtpTo] = useState("");
  const [smtpSender, setSmtpSender] = useState("");

  // Holiday Calendar state
  const [holidays, setHolidays] = useState<{ id: string; tanggal: string; keterangan: string }[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [currentCalDate, setCurrentCalDate] = useState(new Date());
  const [selectedHolidayDate, setSelectedHolidayDate] = useState("");
  const [holidayDesc, setHolidayDesc] = useState("");
  const [savingHoliday, setSavingHoliday] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.deadline_time) setDeadlineTime(data.deadline_time);
        if (data.checkout_time) setCheckoutTime(data.checkout_time);
        if (data.office_latitude !== undefined) setOfficeLatitude(data.office_latitude);
        if (data.office_longitude !== undefined) setOfficeLongitude(data.office_longitude);
        if (data.telegram_bot_token !== undefined) setTelegramBotToken(data.telegram_bot_token);
        if (data.telegram_chat_id !== undefined) setTelegramChatId(data.telegram_chat_id);
        if (data.telegram_chat_id_karyawan !== undefined) setTelegramChatIdKaryawan(data.telegram_chat_id_karyawan);
        if (data.telegram_chat_id_kie !== undefined) setTelegramChatIdKie(data.telegram_chat_id_kie);
        if (data.smtp_host !== undefined) setSmtpHost(data.smtp_host);
        if (data.smtp_port !== undefined) setSmtpPort(data.smtp_port);
        if (data.smtp_user !== undefined) setSmtpUser(data.smtp_user);
        if (data.smtp_pass !== undefined) setSmtpPass(data.smtp_pass);
        if (data.smtp_to !== undefined) setSmtpTo(data.smtp_to);
        if (data.smtp_sender !== undefined) setSmtpSender(data.smtp_sender);
        if (data.show_pkl_scoreboard !== undefined) setShowPklScoreboard(data.show_pkl_scoreboard === '1');
      }
    } catch (err) {
      console.error("Gagal mengambil pengaturan:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHolidays = async () => {
    try {
      setLoadingHolidays(true);
      const res = await fetch("/api/holidays");
      if (res.ok) {
        const data = await res.json();
        setHolidays(data);
      }
    } catch (err) {
      console.error("Gagal mengambil daftar hari libur:", err);
    } finally {
      setLoadingHolidays(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchHolidays();
  }, []);

  const getNotificationDetails = (msg: string) => {
    let icon = <CheckCircle2 size={16} className="text-[#2AB0B2]" />;
    let cleaned = msg;

    if (msg.startsWith("⚠️")) {
      icon = <AlertTriangle size={16} className="text-amber-500" />;
      cleaned = msg.replace(/^⚠️\s*/, "");
    } else if (msg.startsWith("✅")) {
      icon = <CheckCircle2 size={16} className="text-emerald-500" />;
      cleaned = msg.replace(/^✅\s*/, "");
    }

    return { icon, cleaned };
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification("");
    }, 3500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const normalizedLatitude = officeLatitude ? officeLatitude.toString().replace(",", ".").trim() : "";
    const normalizedLongitude = officeLongitude ? officeLongitude.toString().replace(",", ".").trim() : "";

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          deadline_time: deadlineTime,
          checkout_time: checkoutTime,
          office_latitude: normalizedLatitude,
          office_longitude: normalizedLongitude,
          telegram_bot_token: telegramBotToken,
          telegram_chat_id: telegramChatId,
          telegram_chat_id_karyawan: telegramChatIdKaryawan,
          telegram_chat_id_kie: telegramChatIdKie,
          smtp_host: smtpHost,
          smtp_port: smtpPort,
          smtp_user: smtpUser,
          smtp_pass: smtpPass,
          smtp_to: smtpTo,
          smtp_sender: smtpSender,
          show_pkl_scoreboard: showPklScoreboard ? "1" : "0"
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast("✅ Pengaturan berhasil diperbarui!");
        setOfficeLatitude(normalizedLatitude);
        setOfficeLongitude(normalizedLongitude);
      } else {
        showToast(`⚠️ ${data.error || "Gagal menyimpan pengaturan"}`);
      }
    } catch (err) {
      showToast("⚠️ Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHolidayDate) {
      showToast("⚠️ Pilih tanggal terlebih dahulu di kalender");
      return;
    }
    if (!holidayDesc.trim()) {
      showToast("⚠️ Masukkan keterangan tanggal merah");
      return;
    }

    try {
      setSavingHoliday(true);
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tanggal: selectedHolidayDate,
          keterangan: holidayDesc.trim()
        })
      });

      if (res.ok) {
        showToast("✅ Tanggal merah berhasil disimpan!");
        setHolidayDesc("");
        fetchHolidays();
      } else {
        const errData = await res.json();
        showToast(`⚠️ ${errData.error || "Gagal menyimpan tanggal merah"}`);
      }
    } catch (err) {
      showToast("⚠️ Terjadi kesalahan saat menyimpan");
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (idOrDate: string) => {
    try {
      const res = await fetch(`/api/holidays/${idOrDate}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("✅ Tanggal merah berhasil dihapus");
        if (selectedHolidayDate === idOrDate) {
          setHolidayDesc("");
        }
        fetchHolidays();
      } else {
        showToast("⚠️ Gagal menghapus tanggal merah");
      }
    } catch (err) {
      showToast("⚠️ Terjadi kesalahan saat menghapus");
    }
  };

  // Calendar calculations
  const calYear = currentCalDate.getFullYear();
  const calMonth = currentCalDate.getMonth();
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
  const totalDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const mm = String(calMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = `${calYear}-${mm}-${dd}`;
    calendarCells.push({ dayNum: d, dateStr });
  }

  const holidayMap = new Map<string, string>();
  holidays.forEach(h => {
    holidayMap.set(h.tanggal, h.keterangan);
  });

  const todayStr = (() => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  })();

  const formatIndoDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    const monthIdx = parseInt(m, 10) - 1;
    return `${parseInt(d, 10)} ${monthNames[monthIdx] || m} ${y}`;
  };

  return (
    <div className="flex-1 bg-[#F0F2F5] p-4 md:p-8 select-none relative space-y-8">
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

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1C3D3F]">Pengaturan Sistem</h1>
          <p className="text-gray-400 text-sm mt-1">Konfigurasi lokasi kantor, integrasi notifikasi, dan kalender tanggal merah</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Setting details */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-xs p-8 border border-gray-100/50">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400 font-medium">
              Memuat pengaturan...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {/* Office Coordinates Section */}
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4 pt-4">
                <MapPin size={22} className="text-[#2AB0B2]" />
                <h3 className="font-bold text-gray-800 text-lg">Koordinat Lokasi Kantor</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Latitude Kantor
                  </label>
                  <input
                    type="text"
                    value={officeLatitude}
                    onChange={(e) => setOfficeLatitude(e.target.value)}
                    placeholder="Contoh: -6.2088"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Longitude Kantor
                  </label>
                  <input
                    type="text"
                    value={officeLongitude}
                    onChange={(e) => setOfficeLongitude(e.target.value)}
                    placeholder="Contoh: 106.8456"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                  />
                </div>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">
                Digunakan untuk memvalidasi absensi karyawan. Jarak maksimal toleransi adalah 30 meter dari titik ini. Biarkan kosong jika tidak ingin menggunakan pembatasan lokasi GPS.
              </p>

              {/* Attendance Schedule Section */}
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4 pt-4">
                <Clock size={22} className="text-[#2AB0B2]" />
                <h3 className="font-bold text-gray-800 text-lg">Jadwal Jam Masuk & Pulang</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Batas Jam Masuk (Deadline)
                  </label>
                  <input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Jam Mulai Pulang
                  </label>
                  <input
                    type="time"
                    value={checkoutTime}
                    onChange={(e) => setCheckoutTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                  />
                </div>
              </div>

              {/* Telegram Notification Section */}
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4 pt-4">
                <Send size={22} className="text-[#2AB0B2]" />
                <h3 className="font-bold text-gray-800 text-lg">Notifikasi Telegram</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Telegram Bot Token
                  </label>
                  <input
                    type="text"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="Contoh: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Group ID (Umum)
                    </label>
                    <input
                      type="text"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="Contoh: -100123456789"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Group ID (Karyawan)
                    </label>
                    <input
                      type="text"
                      value={telegramChatIdKaryawan}
                      onChange={(e) => setTelegramChatIdKaryawan(e.target.value)}
                      placeholder="Contoh: -100987654321"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Group ID (Setoran KIE)
                    </label>
                    <input
                      type="text"
                      value={telegramChatIdKie}
                      onChange={(e) => setTelegramChatIdKie(e.target.value)}
                      placeholder="Contoh: -100112233445"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* SMTP Settings */}
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4 pt-4">
                <Mail size={22} className="text-[#2AB0B2]" />
                <h3 className="font-bold text-gray-800 text-lg">Konfigurasi Email SMTP</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Host SMTP
                    </label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="Contoh: smtp.gmail.com"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Port SMTP
                    </label>
                    <input
                      type="text"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="Contoh: 587 atau 465"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Username / Email SMTP
                    </label>
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="Contoh: absensi.sampulkreativ@gmail.com"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Password / App Password SMTP
                    </label>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Pengirim (Sender Email)
                    </label>
                    <input
                      type="text"
                      value={smtpSender}
                      onChange={(e) => setSmtpSender(e.target.value)}
                      placeholder="Contoh: absensi.sampulkreativ@gmail.com"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Penerima Laporan (Admin / HRD)
                    </label>
                    <input
                      type="text"
                      value={smtpTo}
                      onChange={(e) => setSmtpTo(e.target.value)}
                      placeholder="Contoh: admin@perusahaan.com"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Scoreboard Visibility Section */}
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4 pt-4">
                <Trophy size={22} className="text-[#2AB0B2]" />
                <h3 className="font-bold text-gray-800 text-lg">Visibilitas Scoreboard Siswa</h3>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <h4 className="font-bold text-gray-800 text-sm">Tampilkan Scoreboard ke Siswa</h4>
                  <p className="text-gray-400 text-xs mt-1">Mengizinkan siswa PKL melihat halaman klasemen dan pemeringkatan mingguan.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPklScoreboard}
                    onChange={(e) => setShowPklScoreboard(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2AB0B2]"></div>
                </label>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-[#2AB0B2] hover:bg-[#209092] text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
                >
                  <Save size={18} />
                  {saving ? "Menyimpan..." : "Simpan Pengaturan"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Info Sidebar */}
        <div className="lg:col-span-5 bg-[#2AB0B2]/5 rounded-2xl p-6 border border-[#2AB0B2]/10 text-sm text-gray-600 space-y-4">
          <h4 className="font-bold text-[#1C3D3F] flex items-center gap-2 text-base">
            <Settings size={18} /> Catatan Aturan:
          </h4>
          <p className="leading-relaxed">
            • <strong>Sinkronisasi Dashboard</strong>: Begitu pengaturan disimpan, perubahan akan langsung diterapkan di perangkat karyawan pada render berikutnya.
          </p>
          <p className="leading-relaxed">
            • <strong>Radius Jarak GPS (30m)</strong>: Jika koordinat diatur, server akan secara otomatis memverifikasi GPS karyawan dan menolak absensi jika jarak melebihi 30 meter dari kantor.
          </p>
          <p className="leading-relaxed">
            • <strong>Generator Otomatis Status Alpa</strong>: Setiap kali pengguna memuat beranda mereka pada hari baru, sistem akan mendeteksi hari-hari yang terlewat dan secara otomatis mengisi status kehadiran mereka sebagai <strong>Alpa</strong>.
          </p>
          <p className="leading-relaxed">
            • <strong>Tanggal Merah & Libur Kantor</strong>: Hari-hari yang ditandai pada Kalender Tanggal Merah di bawah akan otomatis dikecualikan dari sistem Auto-Alpa dan beban target setoran KIE siswa PKL.
          </p>
          <p className="leading-relaxed">
            • <strong>Notifikasi Email Izin & Sakit</strong>: Jika konfigurasi SMTP diisi, semua permohonan izin/sakit akan otomatis dikirimkan ke email tujuan beserta lampiran dokumennya.
          </p>
        </div>
      </div>

      {/* ── SECTION: KALENDER & PENGATURAN TANGGAL MERAH ── */}
      <div className="bg-white rounded-2xl shadow-xs p-6 md:p-8 border border-gray-100/50 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-xs">
              <Palmtree size={24} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                Kalender & Pengaturan Tanggal Merah
              </h3>
              <p className="text-gray-400 text-xs md:text-sm mt-0.5">
                Pilih dan tandai hari libur nasional atau cuti bersama kantor untuk mengecualikannya dari target KIE dan Auto-Alpa.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="px-3 py-1.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              {holidays.length} Tanggal Merah Terdaftar
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Calendar Visual Grid (7 cols) */}
          <div className="lg:col-span-7 bg-gray-50/70 p-6 rounded-2xl border border-gray-200/60 space-y-5">
            {/* Month & Year Navigation Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarDays size={20} className="text-[#2AB0B2]" />
                <h4 className="font-bold text-gray-800 text-lg">
                  {monthNames[calMonth]} {calYear}
                </h4>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentCalDate(new Date(calYear, calMonth - 1, 1))}
                  className="p-2 rounded-xl bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors cursor-pointer shadow-2xs"
                  title="Bulan Sebelumnya"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentCalDate(new Date())}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-xs font-bold text-gray-700 border border-gray-200 transition-colors cursor-pointer shadow-2xs"
                >
                  Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentCalDate(new Date(calYear, calMonth + 1, 1))}
                  className="p-2 rounded-xl bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors cursor-pointer shadow-2xs"
                  title="Bulan Berikutnya"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Weekdays Header */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold">
              {dayNames.map((day, idx) => (
                <div 
                  key={day} 
                  className={`py-2 rounded-lg ${idx === 0 || idx === 6 ? 'text-rose-500 bg-rose-50/50' : 'text-gray-500 bg-white/70'}`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days Matrix */}
            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="h-16 rounded-xl bg-transparent opacity-0"></div>;
                }

                const isHoliday = holidayMap.has(cell.dateStr);
                const holidayNote = holidayMap.get(cell.dateStr) || "";
                const isSelected = selectedHolidayDate === cell.dateStr;
                const isToday = cell.dateStr === todayStr;
                const dayOfWeek = (firstDayIndex + cell.dayNum - 1) % 7;
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => {
                      setSelectedHolidayDate(cell.dateStr);
                      setHolidayDesc(holidayNote || "");
                    }}
                    className={`h-16 p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer relative group ${
                      isSelected
                        ? "ring-2 ring-[#2AB0B2] border-[#2AB0B2] bg-teal-50/60 shadow-xs"
                        : isHoliday
                        ? "bg-rose-50/80 border-rose-200 hover:bg-rose-100/70"
                        : isWeekend
                        ? "bg-gray-100/60 border-gray-200/50 hover:bg-white"
                        : "bg-white border-gray-200/80 hover:border-[#2AB0B2]/50 hover:shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span 
                        className={`text-xs font-bold rounded-md w-5 h-5 flex items-center justify-center ${
                          isToday 
                            ? "bg-[#1C3D3F] text-white" 
                            : isHoliday 
                            ? "text-rose-600 font-extrabold" 
                            : isWeekend 
                            ? "text-rose-400" 
                            : "text-gray-700"
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                      {isHoliday && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                      )}
                    </div>

                    {isHoliday ? (
                      <div 
                        className="text-[10px] leading-tight font-bold text-rose-700 truncate px-1 py-0.5 bg-rose-100/90 rounded"
                        title={holidayNote}
                      >
                        {holidayNote}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-300 group-hover:text-gray-400">
                        {isWeekend ? "Akhir pekan" : "Kerja"}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500 pt-2 border-t border-gray-200/70">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-rose-500"></span>
                <span>Tanggal Merah / Libur</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-white border border-gray-300"></span>
                <span>Hari Kerja Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-[#1C3D3F]"></span>
                <span>Hari Ini</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md border-2 border-[#2AB0B2] bg-teal-50"></span>
                <span>Dipilih</span>
              </div>
            </div>
          </div>

          {/* Form & Active Holidays List (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Quick Holiday Add / Edit Card */}
            <div className="bg-gray-50/70 p-6 rounded-2xl border border-gray-200/60 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  <Calendar size={18} className="text-[#2AB0B2]" />
                  {selectedHolidayDate && holidayMap.has(selectedHolidayDate)
                    ? "Kelola Tanggal Merah"
                    : "Tambah Tanggal Merah"}
                </h4>
                {selectedHolidayDate && (
                  <span className="text-xs font-bold text-[#2AB0B2] bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                    {formatIndoDate(selectedHolidayDate)}
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveHoliday} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Pilih Tanggal:
                  </label>
                  <input
                    type="date"
                    value={selectedHolidayDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedHolidayDate(val);
                      setHolidayDesc(holidayMap.get(val) || "");
                      if (val) {
                        const [y, m] = val.split("-");
                        setCurrentCalDate(new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1));
                      }
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-[#2AB0B2] outline-none text-sm font-semibold text-gray-700 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Keterangan Hari Libur:
                  </label>
                  <input
                    type="text"
                    value={holidayDesc}
                    onChange={(e) => setHolidayDesc(e.target.value)}
                    placeholder="Contoh: Hari Kemerdekaan RI / Cuti Bersama"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-[#2AB0B2] outline-none text-sm font-semibold text-gray-700 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={savingHoliday || !selectedHolidayDate}
                    className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-40"
                  >
                    <Plus size={16} />
                    {savingHoliday 
                      ? "Menyimpan..." 
                      : selectedHolidayDate && holidayMap.has(selectedHolidayDate)
                      ? "Perbarui Libur"
                      : "Jadikan Tanggal Merah"}
                  </button>

                  {selectedHolidayDate && holidayMap.has(selectedHolidayDate) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteHoliday(selectedHolidayDate)}
                      className="px-3.5 py-2.5 bg-gray-200 hover:bg-rose-100 text-gray-700 hover:text-rose-700 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                      title="Hapus status libur dari tanggal ini"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* List of Active Holidays */}
            <div className="bg-gray-50/70 p-6 rounded-2xl border border-gray-200/60 space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-gray-800 text-sm">
                  Daftar Tanggal Merah Aktif ({holidays.length})
                </h4>
                {loadingHolidays && (
                  <span className="text-xs text-gray-400">Memuat...</span>
                )}
              </div>

              {holidays.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400 font-medium bg-white/70 rounded-xl border border-dashed border-gray-200">
                  Belum ada tanggal merah yang terdaftar.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {holidays.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200/70 hover:border-rose-200 transition-all text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-rose-600 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          {formatIndoDate(h.tanggal)}
                        </div>
                        <div className="text-gray-600 font-medium">
                          {h.keterangan}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(h.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus tanggal merah"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
