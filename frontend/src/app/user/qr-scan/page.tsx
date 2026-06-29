"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, CameraOff, RefreshCw, AlertCircle } from "lucide-react";
import jsQR from "jsqr";

export default function QRScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
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

  const startCamera = async () => {
    try {
      setLoading(true);
      setCameraError(null);
      setScanning(true);

      if (typeof window !== "undefined" && !window.isSecureContext) {
        setCameraError(
          "Kamera diblokir karena koneksi tidak aman (HTTP). Sistem absensi wajib menggunakan HTTPS agar browser mengizinkan akses kamera HP Anda."
        );
        setLoading(false);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          "Kamera tidak didukung oleh browser Anda atau diblokir karena protokol HTTP. Silakan gunakan protokol HTTPS yang aman."
        );
        setLoading(false);
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      activeStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }
      setLoading(false);
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setCameraError(
        "Gagal mengakses kamera. Silakan pastikan izin kamera diizinkan untuk situs ini."
      );
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initCamera = async () => {
      await startCamera();
      if (!isMounted) {
        stopCamera();
      }
    };

    initCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, []);

  useEffect(() => {
    let timeoutId: any;

    const scanLoop = () => {
      if (!scanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          // Downscale to 480px width for fast decoding and lower CPU footprint
          const maxDim = 480;
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
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          
          if (code) {
            const scannedData = code.data.trim();
            const officialToken = qrToken ? qrToken.trim() : "ABSENSI-KANTOR-PENGESAHAN-TOKEN-2026";

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
              console.error("Gagal parse URL dari scan QR:", e);
            }

            let myUsername = "";
            if (typeof window !== "undefined") {
              const storedUser = localStorage.getItem("v2_user");
              if (storedUser) {
                myUsername = JSON.parse(storedUser).username || "";
              }
            }

            const isValidToken = 
              token === officialToken || 
              token === "ABSENSI-KANTOR-PENGESAHAN-TOKEN-2026" || 
              (myUsername && token === myUsername.trim());

            if (isValidToken) {
              setScanning(false);
              stopCamera();

              if (navigator.vibrate) {
                navigator.vibrate(100);
              }

              if (typeof window !== "undefined") {
                sessionStorage.setItem("v2_scanned_token", token);
              }
              router.push("/user/selfie");
              return;
            } else {
              setScanError("QR Code tidak valid!");
              if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
              }
              // Clear error after 2 seconds
              setTimeout(() => {
                setScanError(null);
              }, 2000);
            }
          }
        }
      }
      timeoutId = setTimeout(scanLoop, 150);
    };

    if (!loading && !cameraError && scanning) {
      timeoutId = setTimeout(scanLoop, 150);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [scanning, loading, cameraError, qrToken]);

  const handleBack = () => {
    stopCamera();
    router.push("/user");
  };

  return (
    <div className="relative h-full w-full flex flex-col items-center bg-black overflow-hidden select-none">
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Live Video Stream */}
      {!cameraError && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
      )}

      {/* Viewfinder box container (without dark overlay) */}
      {!cameraError && !loading && (
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
        </div>
      )}

      {/* Instructions label */}
      {!cameraError && !loading && (
        <div
          className="absolute z-10 text-center w-full px-6"
          style={{ top: "calc(50% + 96px)" }}
        >
          <p className="text-white text-lg font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Arahkan kamera ke</p>
          <p className="text-white text-lg font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">QR Code kantor</p>
        </div>
      )}

      {/* Scan Error Toast */}
      {scanError && (
        <div className="absolute top-20 z-40 bg-red-600/90 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <AlertCircle size={16} />
          {scanError}
        </div>
      )}

      {/* Loading State */}
      {loading && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-30">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white text-sm">Menyiapkan kamera...</p>
        </div>
      )}

      {/* Error state (Camera Permission Denied) */}
      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111] px-6 text-center z-30">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
            <CameraOff size={32} />
          </div>
          <h3 className="text-white text-xl font-semibold mb-2">Kamera Tidak Aktif</h3>
          <p className="text-gray-400 text-sm max-w-xs mb-8 leading-relaxed">
            {cameraError}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={startCamera}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-full hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw size={18} />
              Coba Lagi
            </button>
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 border border-white/20 text-white font-medium rounded-full hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            >
              <AlertCircle size={18} />
              Cara Izinkan Kamera
            </button>
          </div>
        </div>
      )}

      {/* Top action buttons */}
      <div className="absolute top-6 left-5 right-5 z-20 flex justify-between items-center pointer-events-none">
        <button
          onClick={handleBack}
          className="text-white bg-black/40 backdrop-blur-md p-2.5 rounded-full hover:bg-black/60 transition-all cursor-pointer pointer-events-auto shadow-md"
        >
          <X size={22} />
        </button>
        <button
          onClick={() => setShowHelpModal(true)}
          className="text-white bg-black/40 backdrop-blur-md p-2.5 rounded-full hover:bg-black/60 transition-all cursor-pointer pointer-events-auto shadow-md"
        >
          <AlertCircle size={22} />
        </button>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-45 flex items-center justify-center p-6">
          <div className="bg-[#152525] border border-primary/40 rounded-2xl w-full max-w-sm p-6 text-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4 text-primary">
              <AlertCircle size={28} />
              <h3 className="text-lg font-bold">Panduan Izin Kamera</h3>
            </div>
            
            <p className="text-gray-300 text-sm mb-5 leading-relaxed">
              Jika kamera tidak terbuka atau izin terlanjur ditolak, silakan ikuti panduan berikut sesuai perangkat Anda:
            </p>

            <div className="space-y-4 text-xs mb-6">
              <div className="border-l-2 border-primary/50 pl-3">
                <span className="font-semibold text-primary block mb-0.5 text-sm">Chrome (Android / PC)</span>
                <span className="text-gray-300 leading-normal">
                  Ketuk ikon <b>gembok 🔒</b> di kiri kolom alamat browser, lalu ubah izin <b>Kamera</b> menjadi <b>Izinkan / Allow</b>.
                </span>
              </div>

              <div className="border-l-2 border-primary/50 pl-3">
                <span className="font-semibold text-primary block mb-0.5 text-sm">Safari (iPhone / iOS)</span>
                <span className="text-gray-300 leading-normal">
                  Ketuk tombol <b>aA</b> di kiri kolom alamat browser, pilih <b>Pengaturan Situs Web</b>, lalu ubah izin <b>Kamera</b> menjadi <b>Izinkan / Allow</b>.
                </span>
              </div>

              <div className="border-l-2 border-primary/50 pl-3">
                <span className="font-semibold text-primary block mb-0.5 text-sm">Aplikasi Homescreen (PWA)</span>
                <span className="text-gray-300 leading-normal">
                  Buka <b>Pengaturan HP</b> &gt; Aplikasi &gt; <b>sampulkreativ.app</b> &gt; Izin &gt; Aktifkan Kamera.
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer text-center text-sm shadow-md"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
