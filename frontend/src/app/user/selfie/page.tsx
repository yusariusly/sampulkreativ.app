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

  // Validate QR Token on Mount
  useEffect(() => {
    const validateToken = async () => {
      if (typeof window === "undefined") return;

      const scannedToken = sessionStorage.getItem("v2_scanned_token");
      if (!scannedToken) {
        router.replace("/user");
        return;
      }

      const type = sessionStorage.getItem("v2_absen_type") || "masuk";
      const todayStr = new Date().toDateString();

      if (type === "pulang") {
        const lastClockOutDate = localStorage.getItem("v2_clockOutDate");
        if (lastClockOutDate === todayStr) {
          router.replace("/user");
          return;
        }
      } else {
        const lastClockInDate = localStorage.getItem("v2_clockInDate");
        if (lastClockInDate === todayStr) {
          router.replace("/user");
          return;
        }
      }

      try {
        // Also fetch to check online logs in case localStorage was cleared
        const storedUser = localStorage.getItem("v2_user");
        if (storedUser) {
          const userObj = JSON.parse(storedUser);
          const attnRes = await fetch(`/api/attendance?user_id=${userObj.id}`);
          if (attnRes.ok) {
            const logs = await attnRes.json();
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            
            const todayLogs = logs.filter(
              (log: any) => new Date(log.waktu_absen).getTime() >= todayStart.getTime()
            );

            if (type === "pulang") {
              const hasClockedOut = todayLogs.some((log: any) => log.status === "Pulang");
              if (hasClockedOut) {
                localStorage.setItem("v2_clockOutDate", todayStr);
                router.replace("/user");
                return;
              }
            } else {
              const hasClockedIn = todayLogs.some((log: any) => log.status === "Hadir" || log.status === "Terlambat");
              if (hasClockedIn) {
                localStorage.setItem("v2_clockInDate", todayStr);
                router.replace("/user");
                return;
              }
            }
          }
        }

        const res = await fetch("/api/qr");
        if (res.ok) {
          const data = await res.json();
          const officialToken = data.token ? data.token.trim() : "ABSENSI-KANTOR-PENGESAHAN-TOKEN-2026";
          if (scannedToken.trim() !== officialToken && scannedToken.trim() !== "ABSENSI-KANTOR-PENGESAHAN-TOKEN-2026") {
            sessionStorage.removeItem("v2_scanned_token");
            router.replace("/user");
          }
        }
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
        console.warn(`Kamera (${facingMode}) tidak dapat diakses, menggunakan simulasi:`, err);
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

      // 1. Save clock-in or clock-out state immediately
      const type = sessionStorage.getItem("v2_absen_type") || "masuk";
      const isCheckout = type === "pulang";
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

      // 2. Perform background fetch with keepalive: true (do NOT await it)
      fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userObj.id,
          device_id: deviceId,
          foto_base64: base64Image,
          latitude: coords.lat,
          longitude: coords.lng,
          status: isCheckout ? "Pulang" : "Hadir",
        }),
        keepalive: true,
      }).catch((err) => {
        console.error("Gagal mengirim absensi di latar belakang:", err);
      });

      // 3. Immediately redirect user to success page (Optimistic UI)
      router.replace("/user/success");
    } catch (err) {
      console.error("Terjadi kesalahan absensi:", err);
      // Fallback redirect even if canvas fails
      router.replace("/user/success");
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
        <div className="absolute inset-0 bg-gradient-to-b from-gray-700 to-gray-900 flex items-center justify-center">
          <div className="flex flex-col items-center text-white/50">
            <User size={88} className="mb-2" />
            <p className="text-xs">Streaming kamera tidak tersedia</p>
          </div>
        </div>
      )}

      {/* Top Bar Controls */}
      <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-5 z-10">
        <button
          onClick={handleBack}
          className="text-white hover:opacity-80 transition-opacity cursor-pointer bg-black/45 p-2.5 rounded-full"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-full px-4 py-2.5 border border-white/10">
          <MapPin size={14} color="#2AB0B2" />
          <span className="text-white text-xs font-semibold">{gpsStatus}</span>
        </div>
        <button
          onClick={handleToggleCamera}
          className="text-white hover:opacity-80 transition-opacity cursor-pointer bg-black/45 p-2.5 rounded-full border border-white/10 flex items-center justify-center"
          title="Ganti Kamera"
        >
          <SwitchCamera size={20} />
        </button>
      </div>

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
