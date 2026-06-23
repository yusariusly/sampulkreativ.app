"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Camera, Printer, X, CreditCard } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [fullname, setFullname] = useState("Karyawan");
  const [username, setUsername] = useState("username");
  const [profilePhoto, setProfilePhoto] = useState("/uploads/placeholder.jpg");
  
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [gender, setGender] = useState("");
  const [alamat, setAlamat] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  const [showCardModal, setShowCardModal] = useState(false);
  const [jabatan, setJabatan] = useState("Karyawan");
  const [userRole, setUserRole] = useState("Karyawan");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("v2_user");
      if (storedUser) {
        const userObj = JSON.parse(storedUser);
        setUserId(userObj.id);
        setFullname(userObj.nama_lengkap);
        setUsername(userObj.username);
        setProfilePhoto(userObj.foto_profile || "/uploads/placeholder.jpg");
        setTanggalLahir(userObj.tanggal_lahir || "");
        setGender(userObj.gender || "");
        setAlamat(userObj.alamat || "");
        setUserRole(userObj.role || "Karyawan");

        // Fetch payroll config to get jabatan
        fetch("/api/payroll/config")
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) {
              const cfg = data.find((c: any) => c.user_id === userObj.id);
              if (cfg && cfg.jabatan) {
                setJabatan(cfg.jabatan);
              }
            }
          })
          .catch((err) => console.error("Gagal memuat konfigurasi payroll:", err));
      }
    }
  }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert file to base64 and downscale it
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        // Target size of 200x200 for clean preview and low database storage overhead
        const maxDim = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL("image/jpeg", 0.75);

        setLoading(true);
        setError("");
        setSuccessMsg("");
        
        try {
          const res = await fetch("/api/users/update-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, foto_base64: base64 }),
          });
          
          const data = await res.json();
          if (res.ok && data.success) {
            setProfilePhoto(data.foto_profile);
            
            // Update local storage
            const storedUser = localStorage.getItem("v2_user");
            if (storedUser) {
              const userObj = JSON.parse(storedUser);
              userObj.foto_profile = data.foto_profile;
              localStorage.setItem("v2_user", JSON.stringify(userObj));
            }
          } else {
            setError(data.error || "Gagal mengubah foto profil");
          }
        } catch (err) {
          setError("Kesalahan koneksi ke server");
        } finally {
          setLoading(false);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitted(false);
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/users/update-bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          tanggal_lahir: tanggalLahir,
          gender: gender,
          alamat: alamat
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg("Biodata berhasil diperbarui!");
        setSubmitted(true);
        
        // Update local storage
        const storedUser = localStorage.getItem("v2_user");
        if (storedUser) {
          const userObj = JSON.parse(storedUser);
          userObj.tanggal_lahir = data.user.tanggal_lahir;
          userObj.gender = data.user.gender;
          userObj.alamat = data.user.alamat;
          localStorage.setItem("v2_user", JSON.stringify(userObj));
        }
      } else {
        setError(data.error || "Gagal memperbarui biodata");
      }
    } catch (err) {
      setError("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F2F5] px-5 py-8 overflow-y-auto select-none">
      {/* Space at top of profile */}
      <div className="mt-2" />

      {/* Upper Profile Info */}
      <div>
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative group cursor-pointer">
            <div
              onClick={() => document.getElementById("profile-upload")?.click()}
              className="w-24 h-24 rounded-full flex items-center justify-center shadow-md overflow-hidden relative bg-white"
              style={{
                border: "4px solid #2AB0B2",
                outline: "3px solid white",
                outlineOffset: "2px",
              }}
            >
              {profilePhoto && profilePhoto !== "/uploads/placeholder.jpg" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profilePhoto} alt="Foto profil" className="w-full h-full object-cover" />
              ) : (
                <User size={44} className="text-gray-300" />
              )}
              
              {/* Overlay edit hover effect */}
              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                <Camera size={18} className="text-white mb-0.5" />
                <span className="text-white text-[9px] font-bold uppercase tracking-wider">Ubah</span>
              </div>
            </div>
          </div>
          
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
            id="profile-upload"
            disabled={loading}
          />
          
          <h2 className="text-xl font-bold text-[#1C3D3F] mt-4">{fullname}</h2>
          <p className="text-gray-400 text-sm mt-0.5">@{username}</p>
          
          <button
            type="button"
            onClick={() => setShowCardModal(true)}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-[#2AB0B2] to-[#209092] hover:from-[#209092] hover:to-[#1C3D3F] text-white font-bold text-xs rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Printer size={13} />
            Cetak Kartu Karyawan
          </button>
        </div>

        {/* Biodata Card */}
        <div className="bg-white rounded-2xl shadow-xs p-5 mb-4 border border-gray-100/50">
          <h3 className="font-bold text-gray-800 mb-5 text-base">Bio Data</h3>
          
          {submitted && successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-xs font-semibold text-center animate-pulse">
              {successMsg}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5">
                Tanggal Lahir
              </label>
              <input
                type="date"
                value={tanggalLahir}
                onChange={(e) => setTanggalLahir(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors bg-gray-50/50"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5">
                Jenis Kelamin
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors bg-white cursor-pointer"
              >
                <option value="">Pilih Jenis Kelamin</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5">
                Alamat
              </label>
              <textarea
                rows={3}
                placeholder="Masukkan alamat lengkap"
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors bg-gray-50/50 resize-none"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-bold cursor-pointer hover:bg-[#209092] transition-colors bg-[#2AB0B2] disabled:opacity-50 mt-2"
            >
              {loading ? "Menyimpan..." : "Simpan Biodata"}
            </button>
          </form>
        </div>
      </div>

      {/* Employee ID Card Preview Modal */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl w-full max-w-[360px] overflow-hidden shadow-2xl border border-gray-100 flex flex-col items-center p-6 relative">
            
            {/* Close Button */}
            <button
              onClick={() => setShowCardModal(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Header info */}
            <div className="text-center mb-5">
              <h4 className="font-bold text-[#1C3D3F] text-base">Pratinjau Kartu Karyawan</h4>
              <p className="text-xs text-gray-400">Siap untuk dicetak sebagai kartu fisik</p>
            </div>

            {/* The Actual ID Card Element (CR80 Portrait Mockup) */}
            <div
              id="printable-id-card"
              className="w-[240px] h-[380px] bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col justify-between relative"
              style={{
                fontFamily: "Arial, sans-serif",
              }}
            >
              {/* Card Header Background Block */}
              <div 
                className="bg-[#1C3D3F] pt-4 pb-10 px-3 text-center flex flex-col items-center relative overflow-hidden"
                style={{
                  borderBottomLeftRadius: "15% 30%",
                  borderBottomRightRadius: "15% 30%",
                }}
              >
                {/* Curved Design Overlay */}
                <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/5 rounded-full filter blur-xl" />
                <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-[#2AB0B2]/10 rounded-full filter blur-xl" />
                
                {/* App Name/Logo */}
                <span className="text-[10px] font-extrabold text-white tracking-widest uppercase">SAMPUL KREATIV</span>
                <span className="text-[7px] text-[#F6C13B] tracking-wider uppercase font-semibold mt-0.5">KARTU KARYAWAN</span>
              </div>

              {/* Photo Frame (half hanging over the curved header) */}
              <div className="relative -mt-8 flex justify-center z-10">
                <div 
                  className="w-[76px] h-[76px] rounded-full overflow-hidden bg-white shadow-md flex items-center justify-center"
                  style={{
                    border: "3px solid #2AB0B2",
                    outline: "2px solid white",
                  }}
                >
                  {profilePhoto && profilePhoto !== "/uploads/placeholder.jpg" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profilePhoto} alt="Foto profil" className="w-full h-full object-cover" />
                  ) : (
                    <User size={36} className="text-gray-300" />
                  )}
                </div>
              </div>

              {/* Employee Information */}
              <div className="flex-1 flex flex-col justify-between items-center px-4 py-2 mt-1">
                {/* Name & Title */}
                <div className="text-center w-full">
                  <h5 className="font-extrabold text-[#1C3D3F] text-xs tracking-wide leading-tight truncate max-w-full">
                    {fullname}
                  </h5>
                  <span className="bg-teal-50/70 text-[#209092] px-2 py-0.5 rounded-full text-[8px] font-bold mt-1 tracking-wider uppercase border border-teal-100/50 inline-block">
                    {jabatan}
                  </span>
                </div>

                {/* Grid Details (No Karyawan, Status) */}
                <div className="w-full text-[8px] text-[#1C3D3F] space-y-1 bg-gray-50/70 p-1.5 rounded-xl border border-gray-200/50 mt-2">
                  <div className="flex justify-between border-b border-gray-200/40 pb-0.5">
                    <span className="text-gray-400 font-semibold">No. Karyawan</span>
                    <span className="font-bold font-mono">{username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-semibold">Status Kerja</span>
                    <span className="font-bold capitalize">{userRole === "user" ? "Karyawan" : userRole}</span>
                  </div>
                </div>

                {/* QR Code for scanning */}
                <div className="mt-2 flex flex-col items-center">
                  <div className="border border-gray-150 p-1 rounded-lg bg-white shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&color=1c3d3f&data=${encodeURIComponent(username)}`}
                      alt="QR Code Karyawan"
                      className="w-12 h-12"
                    />
                  </div>
                  <span className="text-[6px] font-mono font-bold text-gray-400 mt-0.5 select-all">
                    SCAN UNTUK ABSEN
                  </span>
                </div>
              </div>

              {/* Bottom Footer Band */}
              <div>
                {/* Gold Stripe */}
                <div className="h-[3px] bg-[#F6C13B] w-full" />
                {/* Deep Teal Band */}
                <div className="bg-[#1C3D3F] py-1 text-center">
                  <span className="text-white text-[7px] tracking-widest uppercase font-bold">
                    ABSENSI SK · SAMPULKREATIV
                  </span>
                </div>
              </div>
            </div>

            {/* Print Controls */}
            <div className="w-full mt-5 flex flex-col">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCardModal(false)}
                  className="flex-1 py-3 text-xs font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all cursor-pointer border border-gray-200"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.print();
                    }
                  }}
                  className="flex-2 py-3 text-xs font-bold text-white bg-[#2AB0B2] hover:bg-[#209092] rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                >
                  <Printer size={13} />
                  Cetak / Simpan PDF
                </button>
              </div>
              
              {/* Help/Tip under print button */}
              <p className="text-[9px] text-gray-400 text-center mt-3 leading-normal">
                💡 <b>Tips PDF:</b> Pada dialog cetak browser, pilih tujuan <b>"Simpan sebagai PDF"</b> (Save as PDF) untuk mengunduh kartu karyawan dalam format dokumen PDF.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CSS style overrides for page printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide all other elements */
          body * {
            visibility: hidden;
          }
          /* Show only print ID card */
          #printable-id-card, #printable-id-card * {
            visibility: visible;
          }
          #printable-id-card {
            position: fixed;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 54mm !important;
            height: 86mm !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 12px !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            z-index: 99999;
          }
          @page {
            size: portrait;
            margin: 0;
          }
        }
      `}} />

      {/* Copyright */}
      <p className="text-[10px] text-gray-400 text-center py-4 select-none">
        © 2026 sampulkreativ · Absensi SK · All rights reserved
      </p>
    </div>
  );
}














