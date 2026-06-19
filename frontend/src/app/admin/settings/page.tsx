"use client";

import React, { useEffect, useState } from "react";
import { Settings, Clock, CheckCircle2, Save, MapPin, Send } from "lucide-react";

export default function AdminSettingsPage() {
  const [deadlineTime, setDeadlineTime] = useState("08:30");
  const [checkoutTime, setCheckoutTime] = useState("17:00");
  const [officeLatitude, setOfficeLatitude] = useState("");
  const [officeLongitude, setOfficeLongitude] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
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

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          deadline_time: deadlineTime,
          checkout_time: checkoutTime,
          office_latitude: officeLatitude,
          office_longitude: officeLongitude,
          telegram_bot_token: telegramBotToken,
          telegram_chat_id: telegramChatId
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast("✅ Pengaturan berhasil diperbarui!");
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
    <div className="flex-1 bg-[#F0F2F5] p-6 md:p-10 select-none relative">
      {/* Toast Alert Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-[#1C3D3F] text-white rounded-xl shadow-lg border border-[#2AB0B2]/30 flex items-center gap-2 font-medium text-sm transition-all animate-bounce">
          <CheckCircle2 size={16} className="text-[#2AB0B2]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#1C3D3F]">Pengaturan Sistem</h1>
          <p className="text-gray-400 text-sm mt-1">Konfigurasi batasan waktu kehadiran dan jadwal absensi harian</p>
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
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4">
                <Clock size={22} className="text-[#2AB0B2]" />
                <h3 className="font-bold text-gray-800 text-lg">Konfigurasi Batas Absen</h3>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Jam Batas Absen Masuk (Alpa)
                </label>
                <div className="flex items-center gap-2.5 max-w-[200px]">
                  <input
                     type="time"
                     value={deadlineTime}
                     onChange={(e) => setDeadlineTime(e.target.value)}
                     className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold text-center text-lg bg-gray-50 focus:bg-white transition-all cursor-pointer"
                     required
                  />
                  <span className="text-sm font-bold text-gray-500">WIB</span>
                </div>
                <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                  Semua karyawan yang belum melakukan absen masuk melewati jam ini akan otomatis terhitung sebagai <strong className="text-red-500">Alpa</strong> pada dashboard beranda mereka.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Jam Pulang (Absen Pulang)
                </label>
                <div className="flex items-center gap-2.5 max-w-[200px]">
                  <input
                     type="time"
                     value={checkoutTime}
                     onChange={(e) => setCheckoutTime(e.target.value)}
                     className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold text-center text-lg bg-gray-50 focus:bg-white transition-all cursor-pointer"
                     required
                  />
                  <span className="text-sm font-bold text-gray-500">WIB</span>
                </div>
                <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                  Setelah melewati jam ini, karyawan akan melihat tombol <strong className="text-[#2AB0B2]">Absen Pulang</strong> pada dashboard mereka untuk mengakhiri waktu kerja hari ini.
                </p>
              </div>

              {/* Office Coordinates Section */}
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4 pt-4">
                <MapPin size={22} className="text-[#2AB0B2]" />
                <h3 className="font-bold text-gray-800 text-lg">Koordinat Lokasi Kantor</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-750 mb-2 text-gray-700">
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
                  <label className="block text-sm font-semibold text-gray-755 mb-2 text-gray-700">
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
                Kosongkan koordinat di atas untuk menonaktifkan batasan jarak absensi. Jika koordinat diisi, karyawan wajib berada dalam jangkauan <strong className="text-[#2AB0B2]">100 meter</strong> dari koordinat tersebut untuk dapat melakukan absensi masuk.
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
                    Telegram Chat ID (Grup / Channel / User ID)
                  </label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="Contoh: -100123456789 atau 987654321"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-sm"
                  />
                </div>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">
                Kosongkan token dan chat ID di atas untuk menonaktifkan notifikasi Telegram. Jika diisi, setiap kali karyawan absen masuk, detail nama, status, waktu, lokasi GPS, beserta <strong>foto selfie</strong> mereka akan langsung dikirimkan ke Telegram secara otomatis.
              </p>

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
            • <strong>Radius Jarak GPS (100m)</strong>: Jika koordinat diatur, server akan secara otomatis memverifikasi GPS karyawan dan menolak absensi jika jarak melebihi 100 meter dari kantor.
          </p>
          <p className="leading-relaxed">
            • <strong>Absensi Terlambat</strong>: Karyawan masih dapat melakukan absensi jika disetujui, namun indikator status kehadiran mereka di beranda akan tetap menampilkan label peringatan Alpa.
          </p>
          <p className="leading-relaxed">
            • <strong>Waktu Server Aman</strong>: Jam batas absensi dicocokkan dengan jam lokal server (WIB) untuk mencegah kecurangan manipulasi jam di ponsel karyawan.
          </p>
        </div>
      </div>
    </div>
  );
}
