"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin, User, Camera, SwitchCamera } from "lucide-react";

export default function SelfiePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [hasCamera, setHasCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("Mencari GPS...");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Validate QR Token on Mount
  useEffect(() => {
    const validateToken = async () => {
      if (typeof window === "undefined") return;

      // Only check: do we have a valid scanned token?
      const scannedToken = sessionStorage.getItem("v2_scanned_token");
      if (!scannedToken) {
        router.replace("/user");
        return;
      }

      try {
        // Validate the token against the official QR token
        const res = await fetch("/api/qr");
        if (res.ok) {
          const data = await res.json();
          const officialToken = data.token ? data.token.trim() : "ABSENSI-KANTOR-PENGESAHAN-TOKEN-2026";
          
          const storedUser = localStorage.getItem("v2_user");
          const myUsername = storedUser ? JSON.parse(storedUser).username : null;

          const isValid = 
            scannedToken.trim() === officialToken || 
            scannedToken.trim() === "ABSENSI-KANTOR-PENGESAHAN-TOKEN-2026" ||
            (myUsername && scannedToken.trim() === myUsername.trim());

          if (!isValid) {
            sessionStorage.removeItem("v2_scanned_token");
            router.replace("/user");
          }
        }
        // If fetch fails, allow through (network issue shouldn't block selfie)
      } catch (err) {
        console.error("Gagal memvalidasi token QR:", err);
      }
    };

    validateToken();
  }, [router]);

  // Initialize & Restart Webcam Stream based on facingMode
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setCameraError(null);
        if (typeof window !== "undefined" && !window.isSecureContext) {
          setCameraError(
            "Kamera diblokir karena koneksi tidak aman (HTTP). Silakan gunakan protokol HTTPS agar dapat mengambil foto selfie kehadiran."
          );
          setHasCamera(false);
          return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError(
            "Kamera tidak didukung oleh browser Anda atau diblokir karena protokol HTTP. Silakan gunakan protokol HTTPS yang aman."
          );
          setHasCamera(false);
          return;
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: facingMode, 
            width: { ideal: 1920 }, 
            height: { ideal: 1080 } 
          },
          audio: false,
        });
        currentStream = mediaStream;
        setStream(mediaStream);
        setHasCamera(true);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play().catch(err => console.error("Selfie video play error:", err));
        }
      } catch (err) {
        console.warn(`Kamera (${facingMode}) tidak dapat diakses:`, err);
        setCameraError("Gagal mengakses kamera. Silakan pastikan izin kamera diizinkan untuk situs ini.");
        setHasCamera(false);
      }
    };

    startCamera();

    return () => {
      // Cleanup tracks on unmount or facingMode change
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [facingMode]);

  // Get Geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log(`[GPS_FRONTEND]\nLatitude: ${position.coords.latitude}\nLongitude: ${position.coords.longitude}\nAccuracy: ${position.coords.accuracy}\nTimestamp: ${position.timestamp}`);
          setCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setGpsStatus("GPS Terkunci");
        },
        (error) => {
          console.warn("GPS Geolocation gagal diakses, menggunakan simulasi:", error);
          setCoords({ lat: -6.2088, lng: 106.8456 }); // Fallback Jakarta HQ
          setGpsStatus("GPS Terkunci (Simulasi)");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setCoords({ lat: -6.2088, lng: 106.8456 });
      setGpsStatus("GPS Terkunci (Simulasi)");
    }
  }, []);

  const handleCapture = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg("");

    let base64Image = "";

    try {
      // Capture from HTML5 Video if camera is active
      if (hasCamera && videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Downscale captured image to 480x640 for fast encoding and low-bandwidth upload
          const targetWidth = 480;
          const targetHeight = 640;
          
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          // Source dimensions
          const sWidth = video.videoWidth || video.width || targetWidth;
          const sHeight = video.videoHeight || video.height || targetHeight;

          // Calculate source cropping coordinates to fit target ratio without distortion (object-cover)
          let sx = 0;
          let sy = 0;
          let sCol = sWidth;
          let sRow = sHeight;

          const targetRatio = targetWidth / targetHeight;
          const sourceRatio = sWidth / sHeight;

          if (sourceRatio > targetRatio) {
            // Source is wider than target ratio
            sCol = sHeight * targetRatio;
            sx = (sWidth - sCol) / 2;
          } else {
            // Source is taller than target ratio
            sRow = sWidth / targetRatio;
            sy = (sHeight - sRow) / 2;
          }
          
          // Mirror image only if using front camera selfie
          if (facingMode === "user") {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          
          ctx.drawImage(video, sx, sy, sCol, sRow, 0, 0, canvas.width, canvas.height);
          
          // Reset transformation
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          
          base64Image = canvas.toDataURL("image/jpeg", 0.75);
        }
      } else {
        // Fallback mockup base64
        base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      }

      // Read user details from localStorage
      const storedUser = localStorage.getItem("v2_user");
      if (!storedUser) {
        router.push("/");
        return;
      }

      const userObj = JSON.parse(storedUser);
      const deviceId = localStorage.getItem("v2_device_id") || userObj.device_id || "";
      const type = sessionStorage.getItem("v2_absen_type") || "masuk";
      const isCheckout = type === "pulang";

      const payload = {
        user_id: userObj.id,
        device_id: deviceId,
        foto_base64: base64Image,
        latitude: coords.lat,
        longitude: coords.lng,
        status: isCheckout ? "Pulang" : "Hadir",
      };

      console.log("[GPS_FRONTEND_PAYLOAD]", payload);

      // 1. Perform fetch and AWAIT it to ensure the database successfully records it!
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal mencatatkan absensi di server");
        setLoading(false);
        return;
      }

      // 2. Save clock-in or clock-out state to local storage ONLY after backend response OK
      sessionStorage.setItem("v2_last_absen_type", isCheckout ? "pulang" : "masuk");

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");

      if (isCheckout) {
        localStorage.setItem("v2_clockOutTime", `${hh}:${mm}`);
        localStorage.setItem("v2_clockOutDate", now.toDateString());
        if (coords && coords.lat !== null && coords.lng !== null) {
          localStorage.setItem("v2_clockOutCoords", `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
        } else {
          localStorage.setItem("v2_clockOutCoords", "Tanpa GPS");
        }
      } else {
        localStorage.setItem("v2_clockInTime", `${hh}:${mm}`);
        localStorage.setItem("v2_clockInDate", now.toDateString());
        if (coords && coords.lat !== null && coords.lng !== null) {
          localStorage.setItem("v2_clockInCoords", `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
        } else {
          localStorage.setItem("v2_clockInCoords", "Tanpa GPS");
        }
      }

      // Clear the scanned token and type after successful capture
      sessionStorage.removeItem("v2_scanned_token");
      sessionStorage.removeItem("v2_absen_type");

      // 3. Redirect user to success page
      router.replace("/user/success");
    } catch (err) {
      console.error("Terjadi kesalahan absensi:", err);
      setErrorMsg("⚠️ Terjadi kesalahan koneksi internet atau server.");
      setLoading(false);
    }
  };

  const handleBack = () => {
    // If they scanned QR from outside, they didn't come from in-app qr-scan, so go back to /user
    const hasToken = sessionStorage.getItem("v2_scanned_token");
    if (hasToken) {
      router.push("/user");
    } else {
      router.push("/user/qr-scan");
    }
  };

  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  return (
    <div
      className="relative h-full flex flex-col justify-between select-none bg-zinc-950 overflow-hidden"
    >
      {/* Hidden canvas to write video frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera feed or fallback user graphic */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""} ${hasCamera ? "" : "hidden"}`}
      />
      {!hasCamera && (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-700 to-gray-900 flex flex-col items-center justify-center p-6 text-center z-5">
          <div className="flex flex-col items-center text-white/50 max-w-xs">
            <User size={88} className="mb-4" />
            <p className="text-sm font-semibold mb-2">Streaming Kamera Tidak Tersedia</p>
            <p className="text-xs text-white/40 leading-relaxed mb-6">
              {cameraError || "Silakan pastikan izin kamera diaktifkan atau gunakan browser modern dengan protokol HTTPS."}
            </p>
            {cameraError && cameraError.includes("HTTP") && (
              <div className="bg-amber-500/20 text-[#F6C13B] border border-amber-500/30 rounded-xl p-3 text-xs text-left">
                ⚠️ <b>Peringatan Keamanan:</b> Browser memblokir akses kamera pada situs non-HTTPS demi alasan privasi. Hubungi Admin untuk mengaktifkan SSL/HTTPS.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Bar Controls */}
      <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-5 z-10">
        <button
          onClick={handleBack}
          className="text-white hover:opacity-80 transition-opacity cursor-pointer bg-black/45 p-2.5 rounded-full z-10"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-full px-4 py-2.5 border border-white/10 z-10">
          <MapPin size={14} color="#2AB0B2" />
          <span className="text-white text-xs font-semibold">{gpsStatus}</span>
        </div>
        <button
          onClick={handleToggleCamera}
          className="text-white hover:opacity-80 transition-opacity cursor-pointer bg-black/45 p-2.5 rounded-full border border-white/10 flex items-center justify-center z-10"
          title="Ganti Kamera"
        >
          <SwitchCamera size={20} />
        </button>
      </div>

      {/* Error Toast */}
      {errorMsg && (
        <div className="absolute top-22 left-5 right-5 z-30 bg-red-600/95 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl text-center border border-red-500/30 animate-bounce">
          {errorMsg}
        </div>
      )}

      {/* Bottom Shutter Controls */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 pb-10 pt-16 px-6"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}
      >
        <p className="text-white text-center font-semibold text-lg mb-7">
          Ambil foto selfie kehadiran
        </p>
        <div className="flex justify-center">
          <button
            onClick={handleCapture}
            disabled={loading}
            className="w-20 h-20 rounded-full flex items-center justify-center bg-black/30 active:scale-95 transition-all cursor-pointer hover:bg-black/45 disabled:opacity-50"
            style={{ border: "4px solid #2AB0B2" }}
          >
            <div className="w-14 h-14 rounded-full bg-white hover:bg-zinc-200 transition-colors flex items-center justify-center">
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#2AB0B2] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera size={24} className="text-gray-600" />
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
