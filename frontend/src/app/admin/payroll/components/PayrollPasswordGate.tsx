"use client";

import React, { useState, useEffect } from "react";
import {
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  RefreshCw,
  X,
} from "lucide-react";

interface PayrollPasswordGateProps {
  onSuccess: () => void;
}

export default function PayrollPasswordGate({ onSuccess }: PayrollPasswordGateProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal Ganti Password States
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState<"REQUEST" | "SUBMIT">("REQUEST");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Fetch HRD Email info for preview in modal
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.smtp_to) {
          setTargetEmail(data.smtp_to);
        }
      })
      .catch((err) => console.error("Gagal memuat info email HRD:", err));
  }, []);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg("Silakan masukkan kata sandi payroll.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/payroll/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Kata sandi payroll salah. Silakan coba lagi.");
        return;
      }

      // Simpan status unlock di sessionStorage
      sessionStorage.setItem("v2_payroll_unlocked", "true");
      onSuccess();
    } catch (err) {
      console.error("Gagal verifikasi password payroll:", err);
      setErrorMsg("Terjadi kesalahan jaringan saat memverifikasi kata sandi.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResetOtp = async () => {
    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const res = await fetch("/api/payroll/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || "Gagal mengirim kode verifikasi ke email HRD.");
        return;
      }

      setResetSuccess(data.message || "Kode verifikasi telah dikirim ke email HRD.");
      setResetStep("SUBMIT");
    } catch (err) {
      console.error("Gagal request OTP:", err);
      setResetError("Terjadi kesalahan jaringan saat mengirim kode OTP.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (!otpCode || otpCode.trim().length !== 6) {
      setResetError("Silakan masukkan 6 digit kode verifikasi OTP.");
      return;
    }

    if (!newPassword || newPassword.trim().length < 4) {
      setResetError("Kata sandi baru minimal 4 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setResetLoading(true);

    try {
      const res = await fetch("/api/payroll/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp: otpCode.trim(),
          new_password: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || "Gagal memperbarui kata sandi.");
        return;
      }

      setResetSuccess(data.message || "Kata sandi payroll berhasil diperbarui!");
      setTimeout(() => {
        setShowResetModal(false);
        setPassword(newPassword.trim());
        setResetStep("REQUEST");
        setOtpCode("");
        setNewPassword("");
        setConfirmPassword("");
      }, 1800);
    } catch (err) {
      console.error("Gagal submit reset password:", err);
      setResetError("Terjadi kesalahan jaringan saat memperbarui kata sandi.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-[calc(100dvh-57px)] flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-[#F0F2F5] to-teal-50/40 select-none">
      {/* Main Lock Card */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden transition-all duration-300 hover:shadow-teal-500/5">
        {/* Glow Accent */}
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-[#2AB0B2]/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />

        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1C3D3F] to-[#2AB0B2] flex items-center justify-center text-white shadow-lg shadow-teal-500/20 mb-3.5 relative group">
            <Lock size={28} className="stroke-[2.2px] transition-transform group-hover:scale-105" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <ShieldCheck size={11} className="text-white" />
            </div>
          </div>

          <span className="text-[10px] font-black uppercase tracking-widest text-[#2AB0B2] bg-teal-50 px-3 py-1 rounded-full border border-teal-100">
            Akses Terbatas HRD
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-[#1C3D3F] mt-2.5 tracking-tight">
            Sistem Payroll Karyawan
          </h2>

          <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
            Masukkan kata sandi khusus payroll untuk mengakses rincian gaji dan data keuangan karyawan.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center gap-2.5 text-rose-600 text-xs font-semibold animate-shake">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Password Form (1 Input Field) */}
        <form onSubmit={handleVerifyPassword} className="space-y-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
              Kata Sandi Payroll
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                <KeyRound size={17} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Masukkan kata sandi payroll..."
                autoFocus
                className="w-full pl-10 pr-11 py-3 text-sm bg-slate-50/75 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2AB0B2]/30 focus:border-[#2AB0B2] transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#1C3D3F] to-[#2AB0B2] hover:from-[#152e30] hover:to-[#228e90] text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-teal-700/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <Unlock size={15} />
                <span>Buka Sistem Payroll</span>
              </>
            )}
          </button>
        </form>

        {/* Change / Forgot Password Trigger */}
        <div className="mt-6 pt-4 border-t border-slate-150 text-center">
          <p className="text-[11px] text-slate-500 font-medium">
            Lupa atau ingin mengganti kata sandi?{" "}
            <button
              type="button"
              onClick={() => {
                setShowResetModal(true);
                setResetStep("REQUEST");
                setResetError(null);
                setResetSuccess(null);
              }}
              className="text-[#2AB0B2] hover:text-[#1C3D3F] font-black underline underline-offset-2 transition-colors cursor-pointer"
            >
              Ganti Password
            </button>
          </p>
        </div>
      </div>

      {/* Modal Alur Ganti Password via Email HRD */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xl relative animate-scale-in">
            {/* Close Button */}
            <button
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#2AB0B2] flex items-center justify-center flex-shrink-0">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-[#1C3D3F] leading-tight">
                  Ganti Kata Sandi Payroll
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Verifikasi keamanan melalui email resmi HRD
                </p>
              </div>
            </div>

            {/* Step 1: Request OTP */}
            {resetStep === "REQUEST" && (
              <div className="space-y-4">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Kode verifikasi OTP 6-digit akan dikirimkan ke email penerima laporan HRD yang terdaftar:
                  </p>
                  <p className="text-xs font-black text-[#1C3D3F] mt-1.5 flex items-center gap-1.5">
                    <Mail size={13} className="text-[#2AB0B2]" />
                    <span>{targetEmail || "hasan.farisi100@gmail.com"}</span>
                  </p>
                </div>

                {resetError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={15} className="flex-shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRequestResetOtp}
                  disabled={resetLoading}
                  className="w-full py-3 px-4 bg-[#2AB0B2] hover:bg-[#209092] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Mengirim Kode OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Kirim Kode ke Email HRD</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Step 2: Submit OTP & Set New Password */}
            {resetStep === "SUBMIT" && (
              <form onSubmit={handleSubmitResetPassword} className="space-y-3.5">
                {resetSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-600" />
                    <span>{resetSuccess}</span>
                  </div>
                )}

                {resetError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={15} className="flex-shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                    Kode Verifikasi (OTP) 6 Digit
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full py-2.5 px-3 text-center text-lg font-mono font-black tracking-[8px] bg-slate-50 border border-slate-200 rounded-xl text-[#1C3D3F] focus:outline-none focus:ring-2 focus:ring-[#2AB0B2]/30 focus:border-[#2AB0B2]"
                    autoFocus
                  />
                  <p className="text-[9px] text-slate-400 mt-1 text-center">
                    Periksa kotak masuk atau spam email HRD
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                    Kata Sandi Payroll Baru
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 4 karakter..."
                      className="w-full py-2.5 pl-3 pr-10 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2AB0B2]/30 focus:border-[#2AB0B2]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-1"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                    Ulangi Kata Sandi Baru
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang kata sandi baru..."
                    className="w-full py-2.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2AB0B2]/30 focus:border-[#2AB0B2]"
                  />
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full py-2.5 px-4 bg-[#2AB0B2] hover:bg-[#209092] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Menyimpan Password...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={15} />
                        <span>Simpan Password Baru</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleRequestResetOtp}
                    disabled={resetLoading}
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-bold underline transition-colors"
                  >
                    Kirim Ulang Kode OTP
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
