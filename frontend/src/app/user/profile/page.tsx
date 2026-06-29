"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Camera, Printer, X, CreditCard, Download, LogOut } from "lucide-react";
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
  
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  const [showCardModal, setShowCardModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [jabatan, setJabatan] = useState("Karyawan");
  const [userRole, setUserRole] = useState("Karyawan");
  const [kategori, setKategori] = useState("Karyawan");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
        setKategori(userObj.kategori || "Karyawan");
        setNoKaryawan(userObj.no_karyawan || "");

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
                setKategori(currentMe.kategori || "Karyawan");
                setNoKaryawan(currentMe.no_karyawan || "");
                
                // Keep localstorage synced
                const updatedUserObj = {
                  ...userObj,
                  nama_lengkap: currentMe.nama_lengkap,
                  role: currentMe.role,
                  jabatan: currentMe.jabatan || "Karyawan",
                  email: currentMe.email || "",
                  no_telp: currentMe.no_telp || "",
                  kategori: currentMe.kategori || "Karyawan",
                  no_karyawan: currentMe.no_karyawan || ""
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
          
          {userRole !== 'student' && (
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
              className="mt-4 px-4 py-2.5 bg-gradient-to-r from-[#2AB0B2] to-[#209092] hover:from-[#209092] hover:to-[#1C3D3F] text-white font-bold text-xs rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <CreditCard size={13} />
              Download Kartu Karyawan
            </button>
          )}
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
            <div className="text-center mb-5 print:hidden">
              <h4 className="font-bold text-[#1C3D3F] text-base">Pratinjau Kartu Karyawan</h4>
              <p className="text-xs text-gray-400">Tampilan depan & belakang bersampingan</p>
            </div>

            {/* The Actual ID Card Elements wrapper */}
            <div id="printable-id-card-wrapper" className="flex flex-row gap-6 items-center justify-start md:justify-center my-3 overflow-x-auto w-full max-w-full py-2 px-1 scrollbar-thin">
              
              {/* CARD FRONT */}
              <div
                id="printable-id-card-front"
                className="printable-card-side w-[240px] h-[380px] rounded-2xl shadow-xl overflow-hidden flex flex-col relative bg-gradient-to-b from-[#FFFFFF] to-[#F5F7F8] border border-gray-200 flex-shrink-0"
                style={{ fontFamily: "Arial, sans-serif" }}
              >
                {/* Top Header */}
                <div className="relative z-10 flex flex-col items-center pt-3.5 pb-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                  <div className="leading-none text-center mt-1">
                    <div className="text-[8.5px] font-black text-[#1C3D3F] tracking-widest">SAMPULKREATIV</div>
                    <div className="text-[5.5px] text-[#2AB0B2] tracking-widest font-black mt-0.5">TECHNOLOGY</div>
                  </div>
                </div>

                {/* Photo block */}
                <div className="relative z-10 flex flex-col items-center mt-1 px-4">
                  <div className="relative">
                    <div className="w-[125px] h-[125px] rounded-full overflow-hidden flex items-center justify-center shadow-lg"
                      style={{border:"3px solid white", background:"#E5E7EB"}}>
                      {profilePhoto && profilePhoto !== "/uploads/placeholder.jpg" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profilePhoto} alt="Foto profil" className="w-full h-full object-cover" crossOrigin="anonymous" />
                      ) : (
                        <User size={60} className="text-gray-400" />
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
                  <h5 className="font-extrabold text-[#F6C13B] text-[13px] tracking-wide uppercase leading-tight truncate w-full max-w-[210px] mt-0.5">
                    {fullname}
                  </h5>
                  
                  {/* Gold divider line */}
                  <div className="h-[1px] bg-[#F6C13B]/70 w-32 mx-auto my-1" />
                  
                  <span className="text-white text-[8px] font-bold tracking-widest uppercase block leading-none mb-1">
                    {jabatan}
                  </span>

                  {noKaryawan && (
                    <span className="text-[#F6C13B] text-[7.5px] font-mono tracking-wider block leading-none mb-1 select-all">
                      {noKaryawan}
                    </span>
                  )}

                  {/* Address & Contacts */}
                  <div className="w-full mt-1 text-center text-white/95">
                    <div className="flex flex-col items-center gap-0.5 border-t border-white/10 pt-2">
                      <span className="text-[6.5px] font-black tracking-widest text-[#F6C13B] uppercase">
                        SAMPULKREATIV TECHNOLOGY
                      </span>
                      <span className="text-[5px] text-gray-300 font-medium leading-tight max-w-[200px] mx-auto">
                        Gedung BITC, Jl. HMS Mintareja, Baros, Cimahi Tengah, Jawa Barat 40521
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD BACK */}
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
                💡 <b>Tips:</b> Pilih opsi <b>"Simpan sebagai PDF"</b> atau <b>"Save as PDF"</b> pada dialog cetak browser Anda untuk mengunduh file kartu karyawan.
              </p>
            </div>
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

      {/* CSS style overrides for page printing */}
      <style dangerouslySetInnerHTML={{ __html: `
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














