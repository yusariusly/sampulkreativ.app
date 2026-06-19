"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Camera } from "lucide-react";

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

      {/* Copyright */}
      <p className="text-[10px] text-gray-400 text-center py-4 select-none">
        © 2026 sampulkreativ · Absensi SK · All rights reserved
      </p>
    </div>
  );
}














