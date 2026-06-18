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
          canvas.width = video.videoWidth || 480;
          canvas.height = video.videoHeight || 640;
          
          // Mirror image only if using front camera selfie
          if (facingMode === "user") {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Reset transformation
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          
          base64Image = canvas.toDataURL("image/jpeg", 0.85);
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

      // Submit to backend database API
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userObj.id,
          device_id: deviceId,
          foto_base64: base64Image,
          latitude: coords.lat,
          longitude: coords.lng,
          status: "Hadir",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        localStorage.setItem("v2_clockInTime", `${hh}:${mm}`);
        router.push("/user/success");
      } else {
        alert(data.error || "Gagal melakukan absensi");
        setLoading(false);
      }
    } catch (err) {
      console.error("Terjadi kesalahan absensi:", err);
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push("/user/qr-scan");
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
