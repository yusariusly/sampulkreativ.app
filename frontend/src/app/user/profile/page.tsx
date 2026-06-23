"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Camera, Printer, X, CreditCard, Download } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [fullname, setFullname] = useState("Karyawan");
  const [username, setUsername] = useState("username");
  const [profilePhoto, setProfilePhoto] = useState("/uploads/placeholder.jpg");
  
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [gender, setGender] = useState("");
  const [alamat, setAlamat] = useState("");
  const [email, setEmail] = useState("");
  const [noTelp, setNoTelp] = useState("");
  
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
        setJabatan(userObj.jabatan || "Karyawan");
        setEmail(userObj.email || "");
        setNoTelp(userObj.no_telp || "");

        // Fetch current user details to get real-time updates
        fetch("/api/users")
          .then((res) => res.json())
          .then((usersList) => {
            if (Array.isArray(usersList)) {
              const currentMe = usersList.find((u: any) => u.id === userObj.id);
              if (currentMe) {
                // Update local states
                setFullname(currentMe.nama_lengkap);
                setUserRole(currentMe.role || "Karyawan");
                setJabatan(currentMe.jabatan || "Karyawan");
                setEmail(currentMe.email || "");
                setNoTelp(currentMe.no_telp || "");
                
                // Keep localstorage synced
                const updatedUserObj = {
                  ...userObj,
                  nama_lengkap: currentMe.nama_lengkap,
                  role: currentMe.role,
                  jabatan: currentMe.jabatan || "Karyawan",
                  email: currentMe.email || "",
                  no_telp: currentMe.no_telp || ""
                };
                localStorage.setItem("v2_user", JSON.stringify(updatedUserObj));
              }
            }
          })
          .catch((err) => console.error("Gagal sinkronisasi data user:", err));
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
          alamat: alamat,
          jabatan: jabatan,
          email: email,
          no_telp: noTelp
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
          userObj.jabatan = data.user.jabatan;
          userObj.email = data.user.email;
          userObj.no_telp = data.user.no_telp;
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
            onClick={() => {
              if (!jabatan || jabatan.trim() === "" || jabatan.trim().toLowerCase() === "karyawan") {
                setError("⚠️ Silakan isi kolom Jabatan / Keterangan Status Anda di profil terlebih dahulu sebelum mengunduh kartu.");
                const bioCard = document.getElementById("biodata-card");
                if (bioCard) {
                  bioCard.scrollIntoView({ behavior: "smooth" });
                }
              } else if (!email || email.trim() === "") {
                setError("⚠️ Silakan isi kolom Email Anda di profil terlebih dahulu sebelum mengunduh kartu.");
                const bioCard = document.getElementById("biodata-card");
                if (bioCard) {
                  bioCard.scrollIntoView({ behavior: "smooth" });
                }
              } else if (!noTelp || noTelp.trim() === "") {
                setError("⚠️ Silakan isi kolom No. Telepon Anda di profil terlebih dahulu sebelum mengunduh kartu.");
                const bioCard = document.getElementById("biodata-card");
                if (bioCard) {
                  bioCard.scrollIntoView({ behavior: "smooth" });
                }
              } else {
                setShowCardModal(true);
              }
            }}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-[#2AB0B2] to-[#209092] hover:from-[#209092] hover:to-[#1C3D3F] text-white font-bold text-xs rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <CreditCard size={13} />
            Download Kartu Karyawan
          </button>
        </div>

        {/* Biodata Card */}
        <div id="biodata-card" className="bg-white rounded-2xl shadow-xs p-5 mb-4 border border-gray-100/50">
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
              <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5 flex justify-between items-center">
                <span>{userRole === "pkl" ? "Keterangan PKL / Magang" : "Jabatan"}</span>
                <span className="text-[10px] text-red-500 font-bold lowercase tracking-normal bg-red-50 px-1.5 py-0.5 rounded">Wajib diisi</span>
              </label>
              <input
                type="text"
                required
                placeholder={userRole === "pkl" ? "Contoh: Praktik Kerja Lapangan / Magang" : "Contoh: Frontend Developer"}
                value={jabatan === "Karyawan" ? "" : jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5 flex justify-between items-center">
                <span>Email</span>
                <span className="text-[10px] text-red-500 font-bold lowercase tracking-normal bg-red-50 px-1.5 py-0.5 rounded">Wajib diisi</span>
              </label>
              <input
                type="email"
                required
                placeholder="Contoh: nama@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5 flex justify-between items-center">
                <span>No. Telepon</span>
                <span className="text-[10px] text-red-500 font-bold lowercase tracking-normal bg-red-50 px-1.5 py-0.5 rounded">Wajib diisi</span>
              </label>
              <input
                type="tel"
                required
                placeholder="Contoh: 08123456789"
                value={noTelp}
                onChange={(e) => setNoTelp(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors bg-white font-medium"
              />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl w-full max-w-[360px] md:max-w-[600px] overflow-hidden shadow-2xl border border-gray-100 flex flex-col items-center p-6 relative my-8">
            
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
              <p className="text-xs text-gray-400">Siap untuk dicetak sebagai kartu fisik depan & belakang</p>
            </div>

            {/* The Actual ID Card Elements wrapper */}
            <div id="printable-id-card-wrapper" className="flex flex-col md:flex-row gap-6 items-center justify-center my-3 print:my-0 print:gap-0">
              
              {/* CARD FRONT */}
              <div
                id="printable-id-card-front"
                className="printable-card-side w-[240px] h-[380px] rounded-2xl shadow-xl overflow-hidden flex flex-col relative"
                style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(160deg, #0f2d2e 0%, #1C3D3F 45%, #1a4547 100%)" }}
              >
                {/* Decorative circles */}
                <div className="absolute top-[-30px] right-[-30px] w-28 h-28 rounded-full opacity-10" style={{background:"#2AB0B2"}} />
                <div className="absolute top-[60px] right-[-50px] w-40 h-40 rounded-full opacity-5" style={{background:"#F6C13B"}} />
                <div className="absolute bottom-[60px] left-[-40px] w-36 h-36 rounded-full opacity-10" style={{background:"#2AB0B2"}} />

                {/* Diagonal accent band */}
                <div className="absolute top-0 left-0 w-full overflow-hidden" style={{height:"100%", zIndex:0, pointerEvents:"none"}}>
                  <div style={{
                    position:"absolute", bottom:0, left:"-10%", width:"120%", height:"42%",
                    background:"rgba(255,255,255,0.04)",
                    transform:"skewY(-8deg)", transformOrigin:"bottom left"
                  }} />
                </div>

                {/* Top Header */}
                <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
                    <div className="leading-none">
                      <div className="text-[7px] font-black text-white tracking-widest">SAMPULKREATIV</div>
                      <div className="text-[4.5px] text-[#2AB0B2] tracking-widest font-bold mt-0.5">TECHNOLOGY</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div style={{background:"rgba(246,193,59,0.15)", border:"1px solid rgba(246,193,59,0.4)"}}
                      className="px-2 py-0.5 rounded-full">
                      <span className="text-[5.5px] font-extrabold tracking-widest uppercase" style={{color:"#F6C13B"}}>KARTU KARYAWAN</span>
                    </div>
                  </div>
                </div>

                {/* Gold divider */}
                <div className="relative z-10 mx-4 h-px" style={{background:"linear-gradient(90deg,transparent,#F6C13B55,transparent)"}} />

                {/* Photo + Name block */}
                <div className="relative z-10 flex flex-col items-center mt-5 px-4">
                  <div className="relative">
                    <div className="w-[78px] h-[78px] rounded-2xl overflow-hidden flex items-center justify-center shadow-lg"
                      style={{border:"2.5px solid #2AB0B2", background:"#0f2d2e"}}>
                      {profilePhoto && profilePhoto !== "/uploads/placeholder.jpg" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profilePhoto} alt="Foto profil" className="w-full h-full object-cover" />
                      ) : (
                        <User size={34} className="text-gray-500" />
                      )}
                    </div>
                    {/* Status dot */}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{background:"#2AB0B2", border:"2px solid #1C3D3F"}}>
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  </div>

                  <h5 className="font-extrabold text-white text-[11px] tracking-wide mt-3 text-center leading-tight">
                    {fullname}
                  </h5>
                  <div className="mt-1.5 px-3 py-0.5 rounded-full text-[7px] font-bold tracking-wider uppercase"
                    style={{background:"rgba(42,176,178,0.2)", border:"1px solid rgba(42,176,178,0.5)", color:"#7EDFE0"}}>
                    {jabatan}
                  </div>
                </div>

                {/* Info grid */}
                <div className="relative z-10 mx-4 mt-4 rounded-xl overflow-hidden"
                  style={{background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)"}}>
                  <div className="flex justify-between items-center px-3 py-2 border-b" style={{borderColor:"rgba(255,255,255,0.07)"}}>
                    <span className="text-[7px] font-semibold" style={{color:"rgba(255,255,255,0.45)"}}>No. Karyawan</span>
                    <span className="text-[7.5px] font-bold font-mono text-white">{username}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2">
                    <span className="text-[7px] font-semibold" style={{color:"rgba(255,255,255,0.45)"}}>Status</span>
                    <span className="text-[7.5px] font-bold capitalize text-white">
                      {userRole === "user" || userRole === "Karyawan" ? "Karyawan" : userRole === "pkl" ? "PKL / Magang" : userRole}
                    </span>
                  </div>
                </div>

                {/* QR Code */}
                <div className="relative z-10 flex flex-col items-center mt-4">
                  <div className="p-1.5 rounded-xl bg-white shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&color=1c3d3f&data=${encodeURIComponent(username)}`}
                      alt="QR Code" className="w-11 h-11"
                    />
                  </div>
                  <span className="text-[5.5px] font-mono font-bold mt-1" style={{color:"rgba(255,255,255,0.35)", letterSpacing:"0.15em"}}>
                    SCAN UNTUK ABSEN
                  </span>
                </div>

                {/* Bottom bar */}
                <div className="relative z-10 mt-auto">
                  <div className="h-[3px] w-full" style={{background:"linear-gradient(90deg,#F6C13B,#EAA41D)"}} />
                  <div className="py-1.5 text-center" style={{background:"rgba(0,0,0,0.3)"}}>
                    <span className="text-[6px] font-bold tracking-widest uppercase" style={{color:"rgba(255,255,255,0.7)"}}>
                      ABSENSI SK · SAMPULKREATIV
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD BACK */}
              <div
                id="printable-id-card-back"
                className="printable-card-side w-[240px] h-[380px] bg-[#1C3D3F] rounded-2xl shadow-lg border border-gray-900 overflow-hidden flex flex-col justify-between relative"
                style={{
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {/* Circular Pattern Overlays */}
                <div className="absolute top-[-50px] left-[-50px] w-48 h-48 rounded-full border border-white/5 bg-white/2" />
                <div className="absolute top-[-20px] left-[-20px] w-64 h-64 rounded-full border border-white/5 bg-transparent" />
                <div className="absolute bottom-[-100px] right-[-100px] w-72 h-72 rounded-full border border-white/5 bg-[#2AB0B2]/5" />
                <div className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-white/2" />
                
                {/* Slot punch line at the top */}
                <div className="w-12 h-2.5 bg-black/30 rounded-full mx-auto mt-3 border border-white/10 z-10" />

                {/* Center Content: Logo */}
                <div className="flex-1 flex flex-col items-center justify-center z-10 px-4 mt-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.png"
                    alt="Logo"
                    className="w-16 h-16 object-contain"
                  />
                  <div className="flex flex-col items-center leading-none mt-3">
                    <span className="text-[12px] font-black text-white tracking-wider">SAMPULKREATIV</span>
                    <span className="text-[8px] text-[#F6C13B] tracking-widest font-bold mt-1">TECHNOLOGY</span>
                  </div>
                </div>

                {/* Bottom Footer Band */}
                <div className="w-full text-center text-white px-3 pb-5 pt-2 bg-gradient-to-t from-black/40 to-transparent z-10">
                  <p className="text-[7px] font-bold tracking-wider text-gray-200 uppercase">SAMPULKREATIV TECHNOLOGY</p>
                  <p className="text-[5px] text-gray-300 font-semibold leading-tight mt-0.5">Gedung BITC, Jl. HMS Mintareja, Baros, Cimahi Tengah, Jawa Barat 40521</p>
                  <div className="flex justify-center items-center gap-1.5 mt-2.5 text-[5px] font-mono text-gray-200 font-bold border-t border-white/10 pt-2">
                    <span className="flex items-center gap-0.5 truncate max-w-[100px]">
                      <span className="text-[#F6C13B]">✉️</span> {email}
                    </span>
                    <span className="text-white/20">|</span>
                    <span className="flex items-center gap-0.5">
                      <span className="text-[#F6C13B]">📞</span> {noTelp}
                    </span>
                  </div>
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
                  <Download size={13} />
                  Download PDF
                </button>
              </div>
              
              {/* Help/Tip under print button */}
              <p className="text-[9px] text-gray-400 text-center mt-3 leading-normal">
                💡 <b>Tips:</b> Pilih opsi <b>"Simpan sebagai PDF"</b> atau <b>"Save as PDF"</b> pada dialog cetak browser Anda untuk mengunduh file kartu karyawan.
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
          /* Show only print ID card wrapper and its children */
          #printable-id-card-wrapper, #printable-id-card-wrapper * {
            visibility: visible;
          }
          #printable-id-card-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
          }
          .printable-card-side {
            width: 54mm !important;
            height: 86mm !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 12px !important;
            box-shadow: none !important;
            margin: 0 auto 10mm auto !important;
            padding: 0 !important;
            background-color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          /* Ensure Card Back background colors print correctly */
          #printable-id-card-back {
            background-color: #1C3D3F !important;
          }
          .printable-card-side:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
            margin-bottom: 0 !important;
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














