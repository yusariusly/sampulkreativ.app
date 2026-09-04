"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Camera, ArrowLeft, RefreshCw } from "lucide-react";

// Konfigurasi standar untuk resolusi dan kompresi selfie
const CAMERA_PRESET = {
  maxDimension: 1024,
  quality: 0.8
};

interface UserInfo {
  id: string;
  username: string;
  nama_lengkap: string;
  role: string;
}

interface SelfieCaptureViewProps {
  user: UserInfo;
  nextStatus: "Hadir" | "Terlambat" | "Pulang";
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
}

export default function SelfieCaptureView({
  user,
  nextStatus,
  onCapture,
  onCancel,
}: SelfieCaptureViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [cameraLoading, setCameraLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const stopSelfieCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startSelfieCamera = useCallback(async () => {
    stopSelfieCamera();
    setCameraLoading(true);
    try {
      const constraints = {
        video: { 
          facingMode: cameraFacing, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        try {
          await videoRef.current.play();
        } catch (err: any) {
          if (err?.name !== "AbortError") {
            console.error("Gagal play video selfie:", err);
          }
        }
      }
    } catch (err) {
      console.error("Gagal membuka kamera selfie stasiun:", err);
    } finally {
      setCameraLoading(false);
    }
  }, [cameraFacing]);

  useEffect(() => {
    startSelfieCamera();
    return () => stopSelfieCamera();
  }, [startSelfieCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && !submitting) {
      setSubmitting(true);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Resolusi asli kamera
        const width = video.videoWidth || video.width || 1280;
        const height = video.videoHeight || video.height || 720;

        // Downscale secara proporsional ke maks dimensi CAMERA_PRESET.maxDimension agar file super ringan di jaringan
        const scale = Math.min(1, CAMERA_PRESET.maxDimension / Math.max(width, height));
        const targetWidth = Math.round(width * scale);
        const targetHeight = Math.round(height * scale);

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Bersihkan canvas
        ctx.clearRect(0, 0, targetWidth, targetHeight);

        // Lakukan pencerminan horizontal hanya jika kamera depan (user)
        if (cameraFacing === "user") {
          ctx.translate(targetWidth, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

        // Reset transformasi canvas ke default
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Kompresi kualitas JPEG preset
        const base64Image = canvas.toDataURL("image/jpeg", CAMERA_PRESET.quality);
        onCapture(base64Image);
      } else {
        setSubmitting(false);
      }
    }
  };

  const handleToggleFacing = () => {
    setCameraFacing((prev) => (prev === "user" ? "environment" : "user"));
  };

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-950 flex items-center justify-center">
      {/* 1. Full Screen Video Feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover z-0"
        style={cameraFacing === "user" ? { transform: "scaleX(-1)" } : undefined}
        muted
        playsInline
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Loading Overlay */}
      {cameraLoading && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-20 gap-3">
          <div className="w-8 h-8 border-3 border-[#2AB0B2]/30 border-t-[#2AB0B2] rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Mempersiapkan kamera...</p>
        </div>
      )}

      {/* 2. Floating User Console & Trigger Buttons */}
      {!cameraLoading && (
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-[92%] sm:w-[90%] max-w-md max-h-[85vh] overflow-y-auto z-20 bg-slate-900/95 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col gap-3 sm:gap-4 text-center">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Siswa / Karyawan Teridentifikasi
            </span>
            <h3 className="text-base sm:text-lg font-black text-white mt-1.5 truncate leading-snug">
              {user.nama_lengkap}
            </h3>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleCapture}
              disabled={cameraLoading || submitting}
              className={`flex items-center justify-center gap-2 w-full py-3.5 sm:py-4 text-white font-black rounded-2xl transition-all disabled:opacity-50 disabled:pointer-events-none shadow-xl active:scale-[0.99] text-sm ${
                nextStatus === "Pulang"
                  ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/25"
                  : "bg-[#2AB0B2] hover:bg-[#228e90] shadow-[#2AB0B2]/25"
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses Absensi...</span>
                </>
              ) : (
                <>
                  <Camera size={18} />
                  <span>
                    {nextStatus === "Pulang"
                      ? "Ambil Foto Selfie & Absen Pulang"
                      : "Ambil Foto Selfie & Absen Masuk"}
                  </span>
                </>
              )}
            </button>

            {/* Action Buttons: Flip Camera & Cancel (Side by side, never overlap!) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleToggleFacing}
                disabled={cameraLoading || submitting}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700/80 active:scale-[0.98] text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                title="Balik Kamera Depan / Belakang"
              >
                <RefreshCw size={14} className="text-[#2AB0B2] shrink-0" />
                <span className="truncate">{cameraFacing === "user" ? "Kamera Depan" : "Kamera Belakang"}</span>
              </button>

              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800/90 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 active:scale-[0.98] text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <ArrowLeft size={14} className="shrink-0" />
                <span className="truncate">Kembali ke QR</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
