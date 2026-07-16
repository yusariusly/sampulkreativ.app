"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Camera, RefreshCw, AlertCircle } from "lucide-react";

interface QrScannerViewProps {
  onScanSuccess: (token: string) => void;
  scanError: string | null;
  setScanError: (error: string | null) => void;
  isActive: boolean;
}

export default function QrScannerView({
  onScanSuccess,
  scanError,
  setScanError,
  isActive,
}: QrScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
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
    stopCamera();
    if (!isActive) return;

    // Set loading asynchronously to avoid synchronous setState inside useEffect
    Promise.resolve().then(() => {
      setCameraLoading(true);
    });

    try {
      const constraints: MediaStreamConstraints = {
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId }, width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: "continuous" } as any] }
          : { facingMode: cameraFacing, width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: "continuous" } as any] },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }
      setScanError(null);

      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((device) => device.kind === "videoinput");
        setCameras(videoDevices);
      }
    } catch (err) {
      console.error("Gagal membuka kamera stasiun:", err);
      setScanError("Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.");
    } finally {
      setCameraLoading(false);
    }
  }, [isActive, selectedCameraId, cameraFacing, setScanError]);

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

  const handleToggleFacing = () => {
    setSelectedCameraId("");
    setCameraFacing((prev) => (prev === "user" ? "environment" : "user"));
  };

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

      {/* 3. Selector Perangkat Kamera Floating */}
      {cameras.length > 1 && (
        <div className="absolute bottom-6 left-6 z-30 bg-slate-900/80 backdrop-blur-md p-2 rounded-2xl border border-slate-850 flex items-center gap-2 max-w-[260px] shadow-2xl">
          <Camera size={15} className="text-[#2AB0B2] ml-1 flex-shrink-0" />
          <select
            value={selectedCameraId}
            onChange={(e) => setSelectedCameraId(e.target.value)}
            className="bg-transparent text-[11px] text-white border-none outline-none focus:ring-0 cursor-pointer max-w-[160px] font-semibold pr-4 py-0"
          >
            {cameras.map((cam, idx) => (
              <option key={cam.deviceId} value={cam.deviceId} className="bg-slate-950 text-white">
                {cam.label || `Kamera ${idx + 1}`}
              </option>
            ))}
          </select>
          <button
            onClick={handleToggleFacing}
            title="Ganti Mode Kamera"
            className="p-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 transition-colors flex-shrink-0"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      )}

      {/* 4. Error Notification Overlay */}
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
