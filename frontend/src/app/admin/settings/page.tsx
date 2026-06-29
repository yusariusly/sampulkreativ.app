"use client";

import React, { useEffect, useState } from "react";
import { Settings, Clock, CheckCircle2, Save, MapPin, Send, Mail, Trophy } from "lucide-react";

export default function AdminSettingsPage() {
  const [deadlineTime, setDeadlineTime] = useState("08:30");
  const [checkoutTime, setCheckoutTime] = useState("17:00");
  const [officeLatitude, setOfficeLatitude] = useState("");
  const [officeLongitude, setOfficeLongitude] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramChatIdKaryawan, setTelegramChatIdKaryawan] = useState("");
  const [showPklScoreboard, setShowPklScoreboard] = useState(true);

  // SMTP state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpTo, setSmtpTo] = useState("");
  const [smtpSender, setSmtpSender] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.deadline_time) {
          setDeadlineTime(data.deadline_time);
        }
        if (data.checkout_time) {
          setCheckoutTime(data.checkout_time);
        }
        if (data.office_latitude !== undefined) {
          setOfficeLatitude(data.office_latitude);
        }
        if (data.office_longitude !== undefined) {
          setOfficeLongitude(data.office_longitude);
        }
        if (data.telegram_bot_token !== undefined) {
          setTelegramBotToken(data.telegram_bot_token);
        }
        if (data.telegram_chat_id !== undefined) {
          setTelegramChatId(data.telegram_chat_id);
        }
        if (data.telegram_chat_id_karyawan !== undefined) {
          setTelegramChatIdKaryawan(data.telegram_chat_id_karyawan);
        }
        if (data.smtp_host !== undefined) {
          setSmtpHost(data.smtp_host);
        }
        if (data.smtp_port !== undefined) {
          setSmtpPort(data.smtp_port);
        }
        if (data.smtp_user !== undefined) {
          setSmtpUser(data.smtp_user);
        }
        if (data.smtp_pass !== undefined) {
          setSmtpPass(data.smtp_pass);
        }
        if (data.smtp_to !== undefined) {
          setSmtpTo(data.smtp_to);
        }
        if (data.smtp_sender !== undefined) {
          setSmtpSender(data.smtp_sender);
        }
        if (data.show_pkl_scoreboard !== undefined) {
          setShowPklScoreboard(data.show_pkl_scoreboard === '1');
        }
      }
    } catch (err) {
      console.error("Gagal mengambil pengaturan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

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

  return (
    <div className="flex-1 bg-[#F0F2F5] p-4 md:p-8 select-none relative">
      {/* Toast Alert Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-[#1C3D3F] text-white rounded-xl shadow-lg border border-[#2AB0B2]/30 flex items-center gap-2 font-medium text-sm transition-all animate-bounce">
          <CheckCircle2 size={16} className="text-[#2AB0B2]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1C3D3F]">Pengaturan Sistem</h1>
          <p className="text-gray-400 text-sm mt-1">Konfigurasi lokasi koordinat kantor dan integrasi notifikasi Telegram / Email</p>
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
                Kosongkan koordinat di atas untuk menonaktifkan batasan jarak absensi. Jika koordinat diisi, karyawan wajib berada dalam jangkauan <strong className="text-[#2AB0B2]">30 meter</strong> dari koordinat tersebut untuk dapat melakukan absensi masuk.
              </p>

              {/* Telegram Integration Section */}
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4 pt-4">
                <Send size={22} className="text-[#2AB0B2]" />
                <h3 className="font-bold text-gray-800 text-lg">Integrasi Notifikasi Telegram</h3>
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
                    placeholder="Contoh: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Telegram Chat ID untuk PKL / Magang
                  </label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="Contoh: -100123456789 atau 987654321"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Telegram Chat ID untuk Karyawan
                  </label>
                  <input
                    type="text"
                    value={telegramChatIdKaryawan}
                    onChange={(e) => setTelegramChatIdKaryawan(e.target.value)}
                    placeholder="Contoh: -100123456789 atau 987654321"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                  />
                </div>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">
                Kosongkan token dan chat ID di atas untuk menonaktifkan notifikasi Telegram. Jika diisi, setiap kali karyawan/PKL absen masuk, detail nama, status, waktu, lokasi GPS, beserta <strong>foto selfie</strong> mereka akan langsung dikirimkan ke Telegram group/channel masing-masing secara otomatis.
              </p>

              {/* SMTP / Email Integration Section */}
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4 pt-4">
                <Mail size={22} className="text-[#2AB0B2]" />
                <h3 className="font-bold text-gray-800 text-lg">Integrasi Notifikasi Email (SMTP)</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      SMTP Host (Layanan Email)
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
                      SMTP Port
                    </label>
                    <input
                      type="text"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="Contoh: 587"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      SMTP Username / Login
                    </label>
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="Contoh: af4a45001@smtp-brevo.com"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      SMTP Password / App Password
                    </label>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="Masukkan Password Aplikasi"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Pengirim Default (Dari Brevo)
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
              <p className="text-gray-400 text-xs leading-relaxed">
                Konfigurasi di atas digunakan untuk mengirim email pemberitahuan izin dan sakit. Nama pengirim email akan disesuaikan otomatis dengan nama karyawan yang mengajukan izin/sakit.
              </p>

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
            • <strong>Notifikasi Email Izin & Sakit</strong>: Jika konfigurasi SMTP diisi, semua permohonan izin/sakit akan otomatis dikirimkan ke email tujuan beserta lampiran dokumennya.
          </p>
        </div>
      </div>
    </div>
  );
}
