"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Camera, X, CreditCard, Download, LogOut, Mail, Phone, QrCode } from "lucide-react";
import { getDeviceId, clearSession } from "../../utils/session";
import { compressImage, IMAGE_PRESETS } from "../../utils/image";

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
  const [noKaryawan, setNoKaryawan] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [baseUrl] = useState(() => typeof window !== "undefined" ? window.location.origin : "");
  
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  const [showCardModal, setShowCardModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [jabatan, setJabatan] = useState("Karyawan");
  const [userRole, setUserRole] = useState("Karyawan");
  const [kategori, setKategori] = useState("Karyawan");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [cardToken, setCardToken] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("v2_user");
      if (storedUser) {
        const userObj = JSON.parse(storedUser);
        
        // Wrap state settings in setTimeout to avoid triggering synchronous render warnings
        setTimeout(() => {
          setUserId(userObj.id);
          setCardToken(userObj.card_token || userObj.username || "");
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
          setKategori(userObj.kategori || "Karyawan");
          setNoKaryawan(userObj.no_karyawan || "");
          setSchoolName(userObj.school_name || "");
        }, 0);

        // Fetch current user details to get real-time updates
        fetch("/api/users")
          .then((res) => res.json())
          .then((usersList) => {
            if (Array.isArray(usersList)) {
              const currentMe = usersList.find((u: { id: string | number }) => u.id === userObj.id);
              if (currentMe) {
                // Update local states
                setFullname(currentMe.nama_lengkap);
                setUserRole(currentMe.role || "Karyawan");
                setJabatan(currentMe.jabatan || "Karyawan");
                setEmail(currentMe.email || "");
                setNoTelp(currentMe.no_telp || "");
                setKategori(currentMe.kategori || "Karyawan");
                setNoKaryawan(currentMe.no_karyawan || "");
                setSchoolName(currentMe.school_name || "");
                
                // Keep localstorage synced
                const updatedUserObj = {
                  ...userObj,
                  nama_lengkap: currentMe.nama_lengkap,
                  role: currentMe.role,
                  jabatan: currentMe.jabatan || "Karyawan",
                  email: currentMe.email || "",
                  no_telp: currentMe.no_telp || "",
                  kategori: currentMe.kategori || "Karyawan",
                  no_karyawan: currentMe.no_karyawan || "",
                  school_name: currentMe.school_name || ""
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

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const compressedFile = await compressImage(file, IMAGE_PRESETS.profile);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await fetch("/api/users/update-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, device_id: getDeviceId(), foto_base64: base64 }),
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
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error("Gagal melakukan kompresi foto profil:", error);
      setError("Gagal memproses file foto");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitted(false);
    setSuccessMsg("");
    setLoading(true);

    if (newPassword && newPassword !== confirmPassword) {
      setError("⚠️ Konfirmasi password baru tidak cocok!");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/users/update-bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          device_id: getDeviceId(),
          tanggal_lahir: tanggalLahir,
          gender: gender,
          alamat: alamat,
          email: email,
          no_telp: noTelp,
          kategori: kategori,
          password: newPassword || undefined
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg("Biodata berhasil diperbarui!");
        setNewPassword("");
        setConfirmPassword("");
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
          userObj.kategori = data.user.kategori || "Karyawan";
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



  const handleConfirmLogout = async () => {
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          device_id: getDeviceId()
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        clearSession();
        localStorage.removeItem("v2_device_id");
        router.push("/");
      } else {
        setError(data.error || "Gagal melakukan logout");
      }
    } catch (err) {
      setError("Gagal menghubungi server untuk melakukan logout");
    } finally {
      setShowLogoutModal(false);
    }
  };

  return (
    <div id="profile-page-root" className="flex flex-col h-full bg-[#F0F2F5] px-5 py-8 overflow-y-auto select-none">
      <div className="print:hidden">
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
                <img src={profilePhoto} alt="Foto profil" className="w-full h-full object-cover" crossOrigin="anonymous" />
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
          {noKaryawan && (
            <p className="text-[#2AB0B2] text-xs font-mono font-bold mt-1 select-all">{noKaryawan}</p>
          )}
          
          <div className="flex flex-col gap-2 mt-4 w-full max-w-[280px]">
            {userRole === 'student' ? (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setShowCardModal(true);
                }}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-[#2AB0B2] to-[#209092] hover:from-[#209092] hover:to-[#1C3D3F] text-white font-bold text-xs rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CreditCard size={13} />
                Download Kartu Siswa PKL
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!jabatan || jabatan.trim() === "" || jabatan.trim().toLowerCase() === "karyawan") {
                    setError("⚠️ Jabatan Anda belum ditentukan oleh Administrator. Silakan hubungi Administrator.");
                  } else {
                    setError("");
                    setShowCardModal(true);
                  }
                }}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-[#2AB0B2] to-[#209092] hover:from-[#209092] hover:to-[#1C3D3F] text-white font-bold text-xs rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CreditCard size={13} />
                Download Kartu Karyawan
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setError("");
                setShowQrModal(true);
              }}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 text-[#1C3D3F] hover:bg-gray-50 font-bold text-xs rounded-xl shadow-xs hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <QrCode size={13} className="text-[#2AB0B2]" />
              Tampilkan QR Absensi
            </button>
          </div>
        </div>

        {/* Category Selector Component */}


        {/* Change Password Card */}
        <div className="bg-white rounded-2xl shadow-xs p-5 mb-4 border border-gray-100/50">
          <h3 className="font-bold text-gray-800 mb-5 text-base">Ubah Password</h3>
          
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
              <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5 flex justify-between items-center">
                <span>Password Baru</span>
                <span className="text-[10px] text-gray-400 font-bold lowercase tracking-normal bg-gray-50 px-1.5 py-0.5 rounded">Wajib</span>
              </label>
              <input
                type="password"
                required
                placeholder="Masukkan password baru Anda"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1.5 flex justify-between items-center">
                <span>Konfirmasi Password Baru</span>
                <span className="text-[10px] text-gray-400 font-bold lowercase tracking-normal bg-gray-50 px-1.5 py-0.5 rounded">Wajib</span>
              </label>
              <input
                type="password"
                required
                placeholder="Konfirmasi password baru Anda"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 transition-colors bg-white font-medium"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-bold cursor-pointer hover:bg-[#209092] transition-colors bg-[#2AB0B2] disabled:opacity-50 mt-2"
            >
              {loading ? "Menyimpan..." : "Simpan Password Baru"}
            </button>
          </form>
        </div>
      </div>
      </div>

            {/* Employee ID Card Preview Modal */}
      {showCardModal && (
        <div id="card-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div id="card-modal-content" className="bg-white rounded-3xl w-full max-w-[360px] md:max-w-[620px] overflow-hidden shadow-2xl border border-gray-100 flex flex-col items-center p-6 relative my-8">
            
            {/* Close Button */}
            <button
              onClick={() => setShowCardModal(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all cursor-pointer print:hidden"
            >
              <X size={18} />
            </button>

            {/* Header info */}
            <div id="card-modal-header" className="text-center mb-6 print:hidden">
              <span className="text-[10px] md:text-xs font-black tracking-widest text-[#2AB0B2] uppercase block">
                PRATINJAU KARTU
              </span>
              <h4 className="font-extrabold text-[#1C3D3F] text-sm md:text-base tracking-wide uppercase mt-1">
                {userRole === 'student' ? 'Siswa PKL' : 'Karyawan'}
              </h4>
              <div className="h-[2px] w-8 bg-[#2AB0B2]/30 mx-auto mt-2 rounded-full" />
            </div>

            {/* The Actual ID Card Elements wrapper */}
            <div id="printable-id-card-wrapper" className="flex flex-col lg:flex-row gap-6 items-center justify-center my-3 overflow-y-auto lg:overflow-x-auto w-full max-w-full py-2 px-1 scrollbar-thin">
              
              {/* CARD FRONT */}
              <div
                id="printable-id-card-front"
                className="printable-card-side w-[240px] h-[380px] rounded-2xl shadow-xl overflow-hidden flex flex-col relative bg-gradient-to-b from-[#FFFFFF] to-[#F5F7F8] border border-gray-200 flex-shrink-0"
                style={{ fontFamily: "Arial, sans-serif" }}
              >
                {/* Top Header */}
                <div className="relative z-10 flex flex-col items-center pt-3.5 pb-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Logo" className="logo-img w-8 h-8 object-contain" />
                  <div className="leading-none text-center mt-1">
                    <div className="text-[8.5px] font-black text-[#1C3D3F] tracking-widest">SAMPULKREATIV</div>
                    <div className="text-[5.5px] text-[#2AB0B2] tracking-widest font-black mt-0.5">TECHNOLOGY</div>
                  </div>
                </div>

                {/* Photo block */}
                <div className="relative z-10 flex flex-col items-center mt-1 px-4">
                  <div className="relative">
                    <div className="avatar-container w-[140px] h-[140px] rounded-full overflow-hidden flex items-center justify-center shadow-lg"
                      style={{border:"3px solid white", background:"#E5E7EB"}}>
                      {profilePhoto && profilePhoto !== "/uploads/placeholder.jpg" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profilePhoto} alt="Foto profil" className="w-full h-full object-cover" crossOrigin="anonymous" />
                      ) : (
                        <User size={70} className="avatar-placeholder text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Diagonal Block */}
                <div
                  className="w-full bg-[#1C3D3F] text-center pt-5 pb-2.5 px-3 mt-auto relative z-10 flex flex-col items-center"
                  style={{
                    clipPath: "polygon(0 12px, 100% 0, 100% 100%, 0 100%)",
                  }}
                >
                  <h5 className="fullname-text font-extrabold text-[#F6C13B] text-[13px] tracking-wide uppercase leading-tight truncate w-full max-w-[210px] mt-0.5">
                    {fullname}
                  </h5>
                  
                  {/* Gold divider line */}
                  <div className="h-[1px] bg-[#F6C13B]/70 w-32 mx-auto my-1" />
                  
                  <span className="role-text text-white text-[8px] font-bold tracking-widest uppercase block leading-none mb-1">
                    {userRole === 'student' ? 'SISWA PKL' : jabatan}
                  </span>

                  {userRole === 'student' ? (
                    schoolName && (
                      <span className="sub-text text-[#F6C13B] text-[7.5px] font-bold tracking-wider block leading-none mb-1 uppercase truncate max-w-[200px]">
                        {schoolName}
                      </span>
                    )
                  ) : (
                    noKaryawan && (
                      <span className="sub-text text-[#F6C13B] text-[7.5px] font-mono tracking-wider block leading-none mb-1 select-all">
                        {noKaryawan}
                      </span>
                    )
                  )}

                  {/* Address & Contacts */}
                  <div className="w-full mt-1 text-center text-white/95">
                    <div className="flex flex-col items-center gap-0.5 border-t border-white/10 pt-2">
                      <span className="address-band text-[6.5px] font-black tracking-widest text-[#F6C13B] uppercase">
                        SAMPULKREATIV TECHNOLOGY
                      </span>
                      <span className="address-detail text-[5px] text-gray-300 font-medium leading-tight max-w-[200px] mx-auto">
                        Gedung BITC, Jl. HMS Mintareja, Baros, Cimahi Tengah, Jawa Barat 40521
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD BACK */}
              {userRole === 'student' ? (
                <div
                  id="printable-id-card-back"
                  className="printable-card-side w-[240px] h-[380px] bg-[#1C3D3F] rounded-2xl shadow-lg border border-gray-900 overflow-hidden flex flex-col justify-between relative flex-shrink-0"
                  style={{
                    fontFamily: "Arial, sans-serif",
                  }}
                >
                  {/* Circular Pattern Overlays */}
                  <div className="absolute top-[-50px] left-[-50px] w-48 h-48 rounded-full border border-white/5 bg-white/2" />
                  <div className="absolute top-[-20px] left-[-20px] w-64 h-64 rounded-full border border-white/5 bg-transparent" />
                  <div className="absolute bottom-[-100px] right-[-100px] w-72 h-72 rounded-full border border-white/5 bg-[#2AB0B2]/5" />
                  
                  {/* Slot punch line at the top */}
                  <div className="w-12 h-2.5 bg-black/30 rounded-full mx-auto mt-3 border border-white/10 z-10" />

                  {/* Center Content: QR Code with centered logo */}
                  <div className="flex-1 flex flex-col items-center justify-center z-10 px-4 mt-2">
                    <div className="qr-container relative w-40 h-40 bg-white p-2 rounded-xl flex items-center justify-center shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=1c3d3f&ecc=H&data=${encodeURIComponent(
                          cardToken && baseUrl ? `${baseUrl}/station?token=${encodeURIComponent(cardToken)}` : username || ""
                        )}`}
                        alt="QR Absen"
                        className="w-full h-full object-contain"
                      />
                      {/* Center Logo overlay */}
                      <div className="qr-logo-overlay absolute w-7 h-7 bg-white rounded-md flex items-center justify-center p-0.5 shadow-sm border border-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/logo.png"
                          alt="SK Logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center leading-none mt-4">
                      <span className="qr-title text-[10px] font-black text-white tracking-widest uppercase">QR CODE ABSENSI</span>
                      <span className="qr-subtitle text-[7px] text-[#F6C13B] tracking-widest font-bold mt-1 uppercase">SAMPULKREATIV</span>
                    </div>
                  </div>

                  {/* Bottom Footer Band */}
                  <div className="w-full text-center text-white px-3 pb-5 pt-2 bg-gradient-to-t from-black/40 to-transparent z-10">
                    <p className="footer-brand-title text-[7px] font-bold tracking-wider text-gray-200 uppercase">SAMPULKREATIV TECHNOLOGY</p>
                    <p className="footer-brand-sub text-[5px] text-gray-300 font-semibold leading-tight mt-0.5">Gedung BITC, Jl. HMS Mintareja, Baros, Cimahi Tengah, Jawa Barat 40521</p>
                    <div className="footer-contact-wrapper flex justify-center items-center gap-1.5 mt-2.5 text-[5px] font-mono text-gray-200 font-bold border-t border-white/10 pt-2">
                      <span className="footer-contact-item flex items-center gap-1 truncate max-w-[100px] leading-none">
                        <Mail size={6} className="text-[#F6C13B] flex-shrink-0" strokeWidth={2.5} />
                        <span>{email || "-"}</span>
                      </span>
                      <span className="text-white/20">|</span>
                      <span className="footer-contact-item flex items-center gap-1 leading-none">
                        <Phone size={6} className="text-[#F6C13B] flex-shrink-0" strokeWidth={2.5} />
                        <span>{noTelp || "-"}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  id="printable-id-card-back"
                  className="printable-card-side w-[240px] h-[380px] bg-[#1C3D3F] rounded-2xl shadow-lg border border-gray-900 overflow-hidden flex flex-col justify-between relative flex-shrink-0"
                  style={{
                    fontFamily: "Arial, sans-serif",
                  }}
                >
                  {/* Circular Pattern Overlays */}
                  <div className="absolute top-[-50px] left-[-50px] w-48 h-48 rounded-full border border-white/5 bg-white/2" />
                  <div className="absolute top-[-20px] left-[-20px] w-64 h-64 rounded-full border border-white/5 bg-transparent" />
                  <div className="absolute bottom-[-100px] right-[-100px] w-72 h-72 rounded-full border border-white/5 bg-[#2AB0B2]/5" />
                  
                  {/* Slot punch line at the top */}
                  <div className="w-12 h-2.5 bg-black/30 rounded-full mx-auto mt-3 border border-white/10 z-10" />

                  {/* Center Content: QR Code with centered logo */}
                  <div className="flex-1 flex flex-col items-center justify-center z-10 px-4 mt-2">
                    <div className="qr-container relative w-40 h-40 bg-white p-2 rounded-xl flex items-center justify-center shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=1c3d3f&ecc=H&data=${encodeURIComponent(
                          cardToken && baseUrl ? `${baseUrl}/station?token=${encodeURIComponent(cardToken)}` : username || ""
                        )}`}
                        alt="QR Absen"
                        className="w-full h-full object-contain"
                      />
                      {/* Center Logo overlay */}
                      <div className="qr-logo-overlay absolute w-7 h-7 bg-white rounded-md flex items-center justify-center p-0.5 shadow-sm border border-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/logo.png"
                          alt="SK Logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center leading-none mt-4">
                      <span className="qr-title text-[10px] font-black text-white tracking-widest uppercase">QR CODE ABSENSI</span>
                      <span className="qr-subtitle text-[7px] text-[#F6C13B] tracking-widest font-bold mt-1 uppercase">SAMPULKREATIV</span>
                    </div>
                  </div>

                  {/* Bottom Footer Band */}
                  <div className="w-full text-center text-white px-3 pb-5 pt-2 bg-gradient-to-t from-black/40 to-transparent z-10">
                    <p className="footer-brand-title text-[7px] font-bold tracking-wider text-gray-200 uppercase">SAMPULKREATIV TECHNOLOGY</p>
                    <p className="footer-brand-sub text-[5px] text-gray-300 font-semibold leading-tight mt-0.5">Gedung BITC, Jl. HMS Mintareja, Baros, Cimahi Tengah, Jawa Barat 40521</p>
                    <div className="footer-contact-wrapper flex justify-center items-center gap-1.5 mt-2.5 text-[5px] font-mono text-gray-200 font-bold border-t border-white/10 pt-2">
                      <span className="footer-contact-item flex items-center gap-1 truncate max-w-[100px] leading-none">
                        <Mail size={6} className="text-[#F6C13B] flex-shrink-0" strokeWidth={2.5} />
                        <span>{email || "-"}</span>
                      </span>
                      <span className="text-white/20">|</span>
                      <span className="footer-contact-item flex items-center gap-1 leading-none">
                        <Phone size={6} className="text-[#F6C13B] flex-shrink-0" strokeWidth={2.5} />
                        <span>{noTelp || "-"}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Inputs inside Modal to populate Email and Phone Number for Card printing */}
            <div className="w-full mt-4 border-t border-gray-100 pt-4 px-1 print:hidden">
              <h5 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Informasi Kontak untuk Kartu</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="nama@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">
                    No. Telepon
                  </label>
                  <input
                    type="tel"
                    placeholder="Contoh: 08123456789"
                    value={noTelp}
                    onChange={(e) => setNoTelp(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-semibold bg-gray-50 focus:bg-white transition-all text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Print Controls */}
            <div className="w-full mt-5 flex flex-col print:hidden">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCardModal(false)}
                  className="flex-1 py-3 text-xs font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all cursor-pointer border border-gray-200"
                >
                  Tutup
                </button>
                <button
                  onClick={async () => {
                    // Save dynamically then print
                    if (!email || email.trim() === "" || !noTelp || noTelp.trim() === "") {
                      alert("⚠️ Email dan No. Telepon wajib diisi untuk kartu!");
                      return;
                    }
                    try {
                      const res = await fetch("/api/users/update-bio", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          user_id: userId,
                          device_id: getDeviceId(),
                          email: email,
                          no_telp: noTelp
                        })
                      });
                      if (res.ok) {
                        const data = await res.json();
                        if (data.success) {
                          const storedUser = localStorage.getItem("v2_user");
                          if (storedUser) {
                            const userObj = JSON.parse(storedUser);
                            userObj.email = email;
                            userObj.no_telp = noTelp;
                            localStorage.setItem("v2_user", JSON.stringify(userObj));
                          }
                        }
                      }
                    } catch (err) {
                      console.error("Gagal memperbarui biodata saat cetak:", err);
                    }
                    if (typeof window !== "undefined") {
                      window.print();
                    }
                  }}
                  className="flex-2 py-3 text-xs font-bold text-white bg-[#2AB0B2] hover:bg-[#209092] rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                >
                  <Download size={13} />
                  Simpan & Cetak Kartu
                </button>
              </div>
              
              {/* Help/Tip under print button */}
              <p className="text-[9px] text-gray-400 text-center mt-3 leading-normal">
                💡 <b>Tips:</b> Pilih opsi <b>&quot;Simpan sebagai PDF&quot;</b> atau <b>&quot;Save as PDF&quot;</b> pada dialog cetak browser Anda untuk mengunduh file kartu karyawan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QR Absensi Modal - Massive Screen Size */}
      {showQrModal && (
        <div id="qr-modal-overlay-custom" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-4 animate-fade-in print:hidden">
          
          {/* Close Button */}
          <button
            onClick={() => setShowQrModal(false)}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all cursor-pointer z-20"
          >
            <X size={28} />
          </button>

          {/* Massive QR Code Container */}
          <div className="relative w-[92vw] h-[92vw] max-w-[80vh] max-h-[80vh] bg-white p-3 rounded-[32px] flex items-center justify-center shadow-2xl border border-gray-100/90 my-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=450x450&color=1c3d3f&ecc=H&data=${encodeURIComponent(
                cardToken && baseUrl ? `${baseUrl}/station?token=${encodeURIComponent(cardToken)}` : username || ""
              )}`}
              alt="QR Absen"
              className="w-full h-full object-contain"
            />
            {/* Center Logo overlay */}
            <div className="absolute w-[16%] h-[16%] max-w-[64px] max-h-[64px] bg-white rounded-2xl flex items-center justify-center p-0.5 shadow-md border border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="SK Logo"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <div className="text-center mt-2 mb-4 w-full max-w-xs flex flex-col items-center">
            <h4 className="text-[#1C3D3F] font-black text-base uppercase tracking-widest leading-none">
              {fullname}
            </h4>
            <p className="text-[#2AB0B2] text-[11px] font-bold mt-1.5 uppercase tracking-wider">
              {userRole === 'student' ? 'Siswa PKL' : jabatan}
            </p>
            <p className="text-gray-400 text-[9px] mt-3 leading-relaxed border-t border-gray-150 pt-3 w-full">
              Posisikan QR Code ini di depan kamera absensi SampulKreativ.
            </p>
            
            {/* Close Button at bottom */}
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full mt-4 py-3 rounded-xl text-white bg-[#2AB0B2] hover:bg-[#209092] font-bold text-xs transition-all cursor-pointer shadow-md text-center uppercase tracking-wider"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Logout Button Card */}
      <div className="mt-2 mb-4 print:hidden">
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          className="w-full py-3.5 rounded-xl text-white bg-slate-900 hover:bg-slate-800 font-extrabold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-[0.98]"
        >
          <LogOut size={15} className="text-red-500" />
          Keluar dari Akun
        </button>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 select-none">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl border border-gray-150 relative">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              Keluar Akun
            </h3>
            <p className="text-gray-400 text-xs mb-6">
              Apakah Anda yakin ingin keluar dari akun ini?
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors cursor-pointer text-center"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="py-3 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold rounded-xl text-sm transition-colors cursor-pointer text-center"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS style overrides for page printing & screen layout adjustments */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          /* Mobile & Tablet view */
          #card-modal-overlay {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background-color: #ffffff !important;
            z-index: 50 !important;
            padding: 1.5rem !important;
            margin: 0 !important;
            display: block !important;
            overflow-y: auto !important;
          }

          #card-modal-content {
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            min-height: 100vh !important;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
            padding: 1rem 0 3rem 0 !important;
            margin: 0 !important;
          }

          #printable-id-card-wrapper {
            overflow: visible !important;
          }

          /* Scale up cards on mobile/tablet screen */
          .printable-card-side {
            width: 290px !important;
            height: 460px !important;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
          }
          
          .printable-card-side .logo-img {
            width: 44px !important;
            height: 44px !important;
          }
          .printable-card-side .avatar-container {
            width: 215px !important;
            height: 215px !important;
          }
          .printable-card-side .avatar-placeholder {
            width: 110px !important;
            height: 110px !important;
          }
          .printable-card-side h5.fullname-text {
            font-size: 16px !important;
            max-width: 250px !important;
          }
          .printable-card-side .role-text {
            font-size: 10px !important;
          }
          .printable-card-side .sub-text {
            font-size: 9.5px !important;
            max-width: 240px !important;
          }
          .printable-card-side .address-band {
            font-size: 8px !important;
          }
          .printable-card-side .address-detail {
            font-size: 6.5px !important;
            max-width: 245px !important;
          }
          .printable-card-side .qr-container {
            width: 190px !important;
            height: 190px !important;
          }
          .printable-card-side .qr-logo-overlay {
            width: 36px !important;
            height: 36px !important;
          }
          .printable-card-side .qr-title {
            font-size: 12px !important;
          }
          .printable-card-side .qr-subtitle {
            font-size: 8.5px !important;
          }
          .printable-card-side .footer-brand-title {
            font-size: 8.5px !important;
          }
          .printable-card-side .footer-brand-sub {
            font-size: 6.5px !important;
          }
          .printable-card-side .footer-contact-wrapper {
            margin-top: 12px !important;
            padding-top: 10px !important;
          }
          .printable-card-side .footer-contact-item {
            font-size: 6.5px !important;
            max-width: 120px !important;
          }
          .printable-card-side .footer-contact-item svg {
            width: 8px !important;
            height: 8px !important;
          }

          /* Desktop View Override */
          @media (min-width: 1024px) {
            #card-modal-overlay {
              position: fixed !important;
              inset: 0 !important;
              display: flex !important;
              align-items: flex-start !important;
              justify-content: center !important;
              background-color: rgba(0, 0, 0, 0.6) !important;
              backdrop-filter: blur(4px) !important;
              padding: 4rem 1.5rem !important;
            }

            #card-modal-content {
              width: 100% !important;
              max-width: 780px !important;
              height: auto !important;
              min-height: unset !important;
              border-radius: 1.5rem !important;
              border: 1px solid #f3f4f6 !important;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
              padding: 2.5rem !important;
              margin: 0 0 4rem 0 !important;
            }

            /* Even larger card scale on desktop */
            .printable-card-side {
              width: 300px !important;
              height: 475px !important;
            }
            .printable-card-side .logo-img {
              width: 48px !important;
              height: 48px !important;
            }
             .printable-card-side .avatar-container {
               width: 195px !important;
               height: 195px !important;
             }
             .printable-card-side .avatar-placeholder {
               width: 100px !important;
               height: 100px !important;
             }
            .printable-card-side h5.fullname-text {
              font-size: 17px !important;
              max-width: 260px !important;
            }
            .printable-card-side .role-text {
              font-size: 11px !important;
            }
            .printable-card-side .sub-text {
              font-size: 10px !important;
              max-width: 250px !important;
            }
            .printable-card-side .address-band {
              font-size: 8.5px !important;
            }
            .printable-card-side .address-detail {
              font-size: 7px !important;
              max-width: 250px !important;
            }
            .printable-card-side .qr-container {
              width: 200px !important;
              height: 200px !important;
            }
            .printable-card-side .qr-logo-overlay {
              width: 38px !important;
              height: 38px !important;
            }
            .printable-card-side .qr-title {
              font-size: 13px !important;
            }
            .printable-card-side .qr-subtitle {
              font-size: 9px !important;
            }
            .printable-card-side .footer-brand-title {
              font-size: 9px !important;
            }
            .printable-card-side .footer-brand-sub {
              font-size: 7px !important;
            }
            .printable-card-side .footer-contact-wrapper {
              margin-top: 14px !important;
              padding-top: 12px !important;
            }
            .printable-card-side .footer-contact-item {
              font-size: 7px !important;
              max-width: 130px !important;
            }
            .printable-card-side .footer-contact-item svg {
              width: 9px !important;
              height: 9px !important;
            }
          }
        }

        @media print {
          /* Force hide anything with print:hidden class */
          .print\\:hidden, [class*="print:hidden"] {
            display: none !important;
          }
          
          /* Reset layout parent wrappers to prevent height constraints or cropping */
          #user-layout-root,
          #user-layout-container,
          #profile-page-root,
          html,
          body {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
            width: auto !important;
            max-width: none !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }

          /* Reset modal overlays to let the cards flow naturally in print layout */
          #card-modal-overlay {
            position: static !important;
            display: block !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
          }
          
          #card-modal-content {
            position: static !important;
            display: block !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: auto !important;
            height: auto !important;
            max-width: 100% !important;
            overflow: visible !important;
          }

          #printable-id-card-wrapper {
            position: static !important;
            display: flex !important;
            flex-direction: row !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 15mm !important;
            width: 100% !important;
            overflow: visible !important;
            margin: 40mm auto 0 auto !important;
            padding: 0 !important;
          }

          .printable-card-side {
            width: 54mm !important;
            height: 86mm !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 12px !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .printable-card-side .avatar-container {
            width: 32mm !important;
            height: 32mm !important;
          }

          /* Force backgrounds on print */
          #printable-id-card-front {
            background: linear-gradient(to bottom, #FFFFFF, #F5F7F8) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #printable-id-card-front .bg-\\[\\#1C3D3F\\] {
            background-color: #1C3D3F !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #printable-id-card-back {
            background-color: #1C3D3F !important;
            background-image: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #printable-id-card-back .bg-white {
            background-color: #FFFFFF !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
        © 2026 sampulkreativ · sampulkreativ.app · All rights reserved
      </p>
    </div>
  );
}














