"use client";

import React, { useEffect, useState } from "react";
import { QrCode, RefreshCw, Printer, Check, Copy } from "lucide-react";

export default function AdminQRPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");

  const fetchToken = async () => {
    try {
      const res = await fetch("/api/qr");
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
      }
    } catch (err) {
      console.error("Gagal mengambil token QR:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
      }
    } catch (err) {
      console.error("Gagal meregenerasi token QR:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (typeof window !== "undefined" && token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const qrDataUrl = token && baseUrl
    ? `${baseUrl}/?token=${encodeURIComponent(token)}`
    : token || "";

  const qrImageUrl = qrDataUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=1c3d3f&data=${encodeURIComponent(qrDataUrl)}`
    : "";

  return (
    <div className="flex-1 bg-[#F0F2F5] p-6 md:p-10 select-none print:bg-white print:p-0">
      {/* Printable Area only */}
      <div className="hidden print:flex flex-col items-center justify-center min-h-screen text-center p-8 bg-white">
        <h1 className="text-3xl font-extrabold text-[#1C3D3F] mb-2">QR CODE ABSENSI</h1>
        <p className="text-gray-500 text-sm mb-8 font-medium">Scan QR Code ini menggunakan aplikasi PWA Absensi Kantor</p>
        
        {qrImageUrl && (
          <div className="border-[12px] border-zinc-800 p-6 rounded-[36px] bg-white shadow-xl mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImageUrl} alt="QR Code Absensi" className="w-[280px] h-[280px]" />
          </div>
        )}
        
        <p className="text-xs text-gray-400 font-mono">Token: {token}</p>
        <p className="text-xs text-gray-300 mt-1">Dicetak pada: {new Date().toLocaleString("id-ID")}</p>
      </div>

      {/* Main dashboard view */}
      <div className="print:hidden">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1C3D3F]">Generate QR Code</h1>
            <p className="text-gray-400 text-sm mt-1">Buat kode QR kehadiran statis untuk ditempel di lokasi kantor</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Panel: QR Code Preview Card */}
          <div className="lg:col-span-7 bg-white rounded-2xl shadow-xs p-8 flex flex-col items-center border border-gray-100/50">
            {loading ? (
              <div className="w-[300px] h-[300px] flex items-center justify-center bg-gray-50 rounded-2xl border">
                <RefreshCw size={36} className="text-gray-300 animate-spin" />
              </div>
            ) : qrImageUrl ? (
              <div className="border-8 border-gray-100 p-5 rounded-3xl bg-white shadow-xs relative group transition-transform duration-350 hover:scale-[1.01]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImageUrl} alt="QR Code Absensi" className="w-[260px] h-[260px]" />
              </div>
            ) : (
              <div className="w-[300px] h-[300px] flex flex-col items-center justify-center bg-gray-50 rounded-2xl border text-gray-400 text-sm font-semibold">
                <QrCode size={48} className="mb-2 text-gray-300" />
                Gagal memuat QR Code
              </div>
            )}

            {token && (
              <div className="w-full mt-8 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Token Aktif Saat Ini
                </p>
                <div className="flex items-center justify-between bg-gray-50 border rounded-xl px-4 py-3.5 font-mono text-sm text-gray-700 select-all">
                  <span className="truncate mr-4">{token}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="text-gray-400 hover:text-[#2AB0B2] transition-colors cursor-pointer"
                      title="Salin Token"
                    >
                      {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Operations & Guides */}
          <div className="lg:col-span-5 space-y-6">
            {/* Actions Card */}
            <div className="bg-white rounded-2xl shadow-xs p-6 border border-gray-100/50">
              <h3 className="font-bold text-gray-800 mb-5 text-base">Kontrol Generator</h3>
              <div className="space-y-3.5">
                <button
                  onClick={handleGenerate}
                  disabled={generating || loading}
                  className="w-full py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 cursor-pointer bg-[#2AB0B2] hover:bg-[#209092] transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={18} className={generating ? "animate-spin" : ""} />
                  Regenerasi Token Baru
                </button>
                <button
                  onClick={handlePrint}
                  disabled={loading || !token}
                  className="w-full py-3.5 rounded-xl border-2 border-zinc-800 text-zinc-800 hover:bg-zinc-50 font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Printer size={18} />
                  Cetak QR Code
                </button>
              </div>
            </div>

            {/* Instruction Card */}
            <div className="bg-[#2AB0B2]/5 rounded-2xl p-6 border border-[#2AB0B2]/10 text-sm text-gray-600 space-y-3">
              <p className="font-bold text-[#1C3D3F]">💡 Cara Penggunaan:</p>
              <p className="leading-relaxed">1. Klik <strong>Regenerasi Token Baru</strong> untuk meningkatkan keamanan secara berkala.</p>
              <p className="leading-relaxed">2. Klik <strong>Cetak QR Code</strong> untuk menampilkan layout cetak berkualitas tinggi, lalu cetak dan tempel di area masuk kantor.</p>
              <p className="leading-relaxed">3. Karyawan wajib berada di lokasi kantor untuk memindai kode QR fisik ini menggunakan kamera HP mereka.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
