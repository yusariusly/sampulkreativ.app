"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { AlertCircle } from "lucide-react";

interface QrScannerViewProps {
  onScanSuccess: (token: string) => void;
  scanError: string | null;
  setScanError: (error: string | null) => void;
  isActive: boolean;
  cameraFacing?: "user" | "environment";
  onToggleFacing?: () => void;
}

export default function QrScannerView({
  onScanSuccess,
  scanError,
  setScanError,
  isActive,
  cameraFacing: propCameraFacing,
  onToggleFacing,
}: QrScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [internalFacing, setInternalFacing] = useState<"user" | "environment">("user");
  const cameraFacing = propCameraFacing !== undefined ? propCameraFacing : internalFacing;
  const [cameraLoading, setCameraLoading] = useState(false);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = useCallback(async () => {
    if (!isActive) return;
    stopCamera();
    setCameraLoading(true);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: "continuous" } as any],
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
            console.error("Gagal play video scanner:", err);
          }
        }
      }
      setScanError(null);
    } catch (err) {
      console.error("Gagal membuka kamera stasiun:", err);
      setScanError("Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.");
    } finally {
      setCameraLoading(false);
    }
  }, [isActive, cameraFacing, setScanError]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isActive) {
      timer = setTimeout(() => {
        startCamera();
      }, 0);
    } else {
      stopCamera();
    }
    return () => {
      if (timer) clearTimeout(timer);
      stopCamera();
    };
  }, [isActive, startCamera]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let isMounted = true;

    const scanLoop = () => {
      if (!isActive || !isMounted) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          const maxDim = 800;
          let scanWidth = video.videoWidth;
          let scanHeight = video.videoHeight;
          if (scanWidth > maxDim) {
            scanHeight = Math.round((video.videoHeight / video.videoWidth) * maxDim);
            scanWidth = maxDim;
          }

          canvas.width = scanWidth;
          canvas.height = scanHeight;
          ctx.drawImage(video, 0, 0, scanWidth, scanHeight);

          const imageData = ctx.getImageData(0, 0, scanWidth, scanHeight);
          
          let code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });

          if (!code) {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = scanWidth;
            tempCanvas.height = scanHeight;
            const tempCtx = tempCanvas.getContext("2d");
            if (tempCtx) {
              tempCtx.translate(scanWidth, 0);
              tempCtx.scale(-1, 1);
              tempCtx.drawImage(canvas, 0, 0);
              const mirroredData = tempCtx.getImageData(0, 0, scanWidth, scanHeight);
              code = jsQR(mirroredData.data, mirroredData.width, mirroredData.height, {
                inversionAttempts: "attemptBoth",
              });
            }
          }

          if (code) {
            const scannedData = code.data.trim();
            let token = scannedData;

            try {
              if (scannedData.startsWith("http://") || scannedData.startsWith("https://")) {
                const urlObj = new URL(scannedData);
                const tokenParam = urlObj.searchParams.get("token");
                if (tokenParam) {
                  token = tokenParam.trim();
                }
              }
            } catch (e) {
              console.error("Gagal mem-parse URL dari scan QR:", e);
            }

            if (token) {
              if (navigator.vibrate) {
                navigator.vibrate(100);
              }
              onScanSuccess(token);
              return;
            }
          }
        }
      }
      timeoutId = setTimeout(scanLoop, 150);
    };

    if (isActive) {
      scanLoop();
    }

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isActive, onScanSuccess]);

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-950 flex items-center justify-center">
      {/* 1. Camera Video Feed (Full Screen Background) */}
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
          <p className="text-xs text-slate-400 font-medium">Menghubungkan kamera...</p>
        </div>
      )}

      {/* 2. Target Scan Frame Overlay */}
      {isActive && !cameraLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/30 pointer-events-none">
          <div className="relative w-64 h-64 md:w-80 md:h-80 border border-white/10 rounded-3xl flex items-center justify-center">
            {/* Corner border overlays */}
            <div className="absolute top-0 left-0 w-10 h-10 border-t-[5px] border-l-[5px] border-[#2AB0B2] rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-10 h-10 border-t-[5px] border-r-[5px] border-[#2AB0B2] rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[5px] border-l-[5px] border-[#2AB0B2] rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[5px] border-r-[5px] border-[#2AB0B2] rounded-br-2xl" />
            
            {/* Laser pulse effect */}
            <div className="w-[90%] h-0.5 bg-[#2AB0B2] shadow-[0_0_15px_#2AB0B2] animate-pulse" />
          </div>
          <p className="text-xs font-bold text-white tracking-wider uppercase mt-8 bg-slate-900/80 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-slate-800 shadow-xl pointer-events-auto">
            Arahkan QR Code Kartu Anda ke Sini
          </p>
        </div>
      )}

      {/* Error Notification Overlay */}
      {scanError && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-30 animate-fade-in">
          <AlertCircle className="text-rose-500 mb-3" size={44} />
          <h4 className="text-base font-bold text-white mb-1.5">Akses Kamera Gagal</h4>
          <p className="text-xs text-slate-400 max-w-xs">{scanError}</p>
        </div>
      )}
    </div>
  );
}
