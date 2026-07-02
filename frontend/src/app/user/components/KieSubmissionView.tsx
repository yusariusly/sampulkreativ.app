"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Key, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { getDeviceId } from "../../utils/session";

interface KieSubmissionViewProps {
  onBack: () => void;
}

export default function KieSubmissionView({ onBack }: KieSubmissionViewProps) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Countdown timer for automatic redirect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (success) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onBack();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [success, onBack]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim().length !== 32) {
      setError("Kunci API harus tepat 32 karakter.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) {
        setError("Sesi Anda telah berakhir. Silakan login kembali.");
        setLoading(false);
        return;
      }
      const userObj = JSON.parse(storedUser);

      const res = await fetch("/api/kie/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey.trim(),
          user_id: userObj.id,
          device_id: getDeviceId(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Gagal menyetor KIE API.");
      }
    } catch {
      setError("Gagal menghubungi server. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\s/g, ""); // Remove spaces
    if (val.length <= 32) {
      setApiKey(val);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 select-none relative transition-all">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-50 rounded-full text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-[#1C3D3F]">Setor API KIE AI</h2>
          <p className="text-xs text-gray-400 mt-0.5">Kumpulkan kunci API KIE AI Anda di sini</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-2xl flex items-start gap-2.5 text-xs font-semibold border border-red-100/50">
          <AlertTriangle size={16} className="shrink-0 text-red-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
            Kunci API KIE (32 Karakter)
          </label>
          <div className="relative">
            <input
              type="text"
              value={apiKey}
              onChange={handleInputChange}
              disabled={loading || success}
              placeholder="Masukkan 32 karakter kunci API"
              className="w-full pl-11 pr-16 py-3.5 rounded-2xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-mono font-semibold bg-gray-50 focus:bg-white transition-all text-sm tracking-wider"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Key size={18} />
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 bg-gray-200/50 px-2 py-1 rounded-md">
              {apiKey.length}/32
            </div>
          </div>
          <p className="text-gray-400 text-[11px] mt-2.5 leading-relaxed">
            API key harus pas 32 karakter, tanpa spasi. Kunci API yang berhasil disetor akan otomatis dikirimkan ke Telegram group perusahaan.
          </p>
        </div>

        <button
          type="submit"
          disabled={apiKey.length !== 32 || loading || success}
          className="w-full py-3.5 bg-[#2AB0B2] hover:bg-[#209092] disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-2xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Mengirim KIE API...</span>
            </>
          ) : (
            <span>Kirim KIE API</span>
          )}
        </button>
      </form>

      {/* Success Countdown Overlay Modal */}
      {success && (
        <div className="fixed inset-0 z-50 bg-[#1C3D3F]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-8 text-center shadow-xl border border-gray-100/50 flex flex-col items-center">
            <div className="w-16 h-16 bg-[#2AB0B2]/10 rounded-full flex items-center justify-center mb-4 text-[#2AB0B2] animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-lg font-bold text-[#1C3D3F]">Sudah Terkirim!</h3>
            <p className="text-sm text-gray-400 mt-2">
              Kunci API KIE AI Anda telah berhasil dicatat dan dikirim ke grup Telegram.
            </p>
            <div className="mt-6 w-full space-y-3">
              <button
                onClick={onBack}
                className="w-full py-3 bg-[#2AB0B2] hover:bg-[#209092] text-white font-bold rounded-2xl transition-all cursor-pointer text-sm"
              >
                Lewati & Kembali ({countdown}s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
