"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

function QrCodeGraphic() {
  return (
    <svg width="130" height="130" viewBox="0 0 130 130" fill="white" className="opacity-85">
      <rect x="8" y="8" width="44" height="44" rx="3" fill="none" stroke="white" strokeWidth="5" />
      <rect x="19" y="19" width="22" height="22" fill="white" />
      <rect x="78" y="8" width="44" height="44" rx="3" fill="none" stroke="white" strokeWidth="5" />
      <rect x="89" y="19" width="22" height="22" fill="white" />
      <rect x="8" y="78" width="44" height="44" rx="3" fill="none" stroke="white" strokeWidth="5" />
      <rect x="19" y="89" width="22" height="22" fill="white" />
      <rect x="78" y="78" width="10" height="10" fill="white" />
      <rect x="93" y="78" width="10" height="10" fill="white" />
      <rect x="108" y="78" width="14" height="10" fill="white" />
      <rect x="78" y="93" width="18" height="10" fill="white" />
      <rect x="100" y="93" width="10" height="10" fill="white" />
      <rect x="78" y="108" width="10" height="14" fill="white" />
      <rect x="93" y="108" width="29" height="8" fill="white" />
      <rect x="112" y="100" width="10" height="22" fill="white" />
    </svg>
  );
}

export default function QRScanPage() {
  const router = useRouter();
  const [qrToken, setQrToken] = useState("");
  const BOX = 240;

  useEffect(() => {
    const getQrToken = async () => {
      try {
        const res = await fetch("/api/qr");
        if (res.ok) {
          const data = await res.json();
          setQrToken(data.token);
        }
      } catch (err) {
        console.error("Gagal memuat token QR:", err);
      }
    };
    getQrToken();
  }, []);

  const handleScanned = () => {
    if (typeof window !== "undefined") {
      // Save scanned validation token
      sessionStorage.setItem("v2_scanned_token", qrToken || "DEFAULT-TOKEN");
    }
    router.push("/user/selfie");
  };

  const handleBack = () => {
    router.push("/user");
  };

  return (
    <div className="relative h-full flex flex-col items-center bg-black overflow-hidden select-none">
      {/* Simulated dark camera background */}
      <div className="absolute inset-0 bg-[#1a1a2e] opacity-95" />

      {/* Subtle room texture lines */}
      <div className="absolute inset-0 opacity-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="absolute h-px bg-white left-0 right-0"
            style={{ top: `${15 + i * 14}%` }}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={handleBack}
        className="absolute top-6 left-5 z-10 text-white hover:opacity-80 transition-opacity cursor-pointer"
      >
        <X size={28} />
      </button>

      {/* Viewfinder box container */}
      <div
        className="absolute z-10"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -57%)",
          width: BOX,
          height: BOX,
        }}
      >
        {/* Border Corners */}
        {[
          { pos: "top-0 left-0", cls: "border-t-4 border-l-4 rounded-tl-xl" },
          { pos: "top-0 right-0", cls: "border-t-4 border-r-4 rounded-tr-xl" },
          { pos: "bottom-0 left-0", cls: "border-b-4 border-l-4 rounded-bl-xl" },
          { pos: "bottom-0 right-0", cls: "border-b-4 border-r-4 rounded-br-xl" },
        ].map(({ pos, cls }, i) => (
          <div
            key={i}
            className={`absolute ${pos} w-9 h-9 ${cls}`}
            style={{ borderColor: "#2AB0B2" }}
          />
        ))}

        {/* Inner frosted graphic area */}
        <div className="absolute inset-3 rounded-lg overflow-hidden bg-white/10 backdrop-blur-xs flex items-center justify-center">
          <QrCodeGraphic />
        </div>

        {/* Glowing animated scanline */}
        <div
          className="absolute left-3 right-3 h-0.5 z-20 rounded-full animate-scan"
          style={{
            backgroundColor: "#2AB0B2",
            boxShadow: "0 0 12px 3px rgba(42, 176, 178, 0.55)",
          }}
        />
      </div>

      {/* Instructions label */}
      <div
        className="absolute z-10 text-center w-full px-6"
        style={{ top: "calc(50% + 96px)" }}
      >
        <p className="text-white text-lg font-medium">Arahkan kamera ke</p>
        <p className="text-white text-lg font-medium">QR Code kantor</p>
        {qrToken && (
          <p className="text-gray-500 text-xs mt-2 font-mono">ID: {qrToken.substring(0, 15)}...</p>
        )}
      </div>

      {/* Simulation trigger */}
      <button
        onClick={handleScanned}
        className="absolute bottom-10 z-10 px-8 py-3 rounded-full text-sm font-semibold text-white border border-white/30 backdrop-blur-md cursor-pointer hover:bg-white/10 active:scale-95 transition-all"
        style={{ backgroundColor: "rgba(42, 176, 178, 0.3)" }}
      >
        Simulasi Berhasil Pindai →
      </button>
    </div>
  );
}
