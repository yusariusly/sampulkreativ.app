"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, Compass, Info, Clock, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface GPSUpdate {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: string;
}

interface AccuracyHistoryItem {
  id: number;
  accuracy: number;
  timestamp: string;
  updateNumber: number;
}

export default function SelfieDebugPage() {
  const router = useRouter();
  const [coords, setCoords] = useState<GPSUpdate | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logHistory, setLogHistory] = useState<string[]>([]);
  const [accuracyHistory, setAccuracyHistory] = useState<AccuracyHistoryItem[]>([]);
  const [startTime] = useState<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Watch position options
  const watchOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
  };

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    const logStr = `[${time}] ${message}`;
    console.log(logStr);
    setLogHistory((prev) => [logStr, ...prev].slice(0, 50));
  };

  // Elapsed time tracker
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setErrorMsg("Browser Anda tidak mendukung Geolocation API.");
      addLog("ERROR: Geolocation tidak didukung.");
      return;
    }

    addLog("Memulai navigator.geolocation.watchPosition()...");
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const timeStr = new Date(position.timestamp).toLocaleTimeString();
        const newCoords: GPSUpdate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: timeStr,
        };

        setCoords(newCoords);
        setUpdateCount((prev) => {
          const nextCount = prev + 1;
          
          // Append to accuracy history
          setAccuracyHistory((history) => [
            {
              id: Date.now(),
              accuracy: position.coords.accuracy,
              timestamp: timeStr,
              updateNumber: nextCount,
            },
            ...history
          ].slice(0, 30));

          return nextCount;
        });
        setErrorMsg(null);

        addLog(`Update #${updateCount + 1}: Lat=${newCoords.latitude.toFixed(7)}, Lng=${newCoords.longitude.toFixed(7)}, Accuracy=${newCoords.accuracy}m`);
      },
      (error) => {
        const errMsg = `Code ${error.code}: ${error.message}`;
        setErrorMsg(errMsg);
        addLog(`ERROR: ${errMsg}`);
      },
      watchOptions
    );

    return () => {
      addLog("Menghentikan watchPosition...");
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Accuracy status helper
  const getAccuracyStatus = (acc: number | undefined) => {
    if (acc === undefined) return { label: "Mencari...", color: "text-zinc-400", bg: "bg-zinc-950", border: "border-zinc-800", icon: <Compass className="text-zinc-500" /> };
    if (acc <= 30) {
      return {
        label: "AKURAT (Lolos Absensi)",
        color: "text-emerald-400",
        bg: "bg-emerald-950/20",
        border: "border-emerald-500/30",
        icon: <CheckCircle className="text-emerald-400" size={16} />
      };
    }
    if (acc <= 100) {
      return {
        label: "KURANG AKURAT (30m - 100m)",
        color: "text-amber-400",
        bg: "bg-amber-950/20",
        border: "border-amber-500/30",
        icon: <AlertTriangle className="text-amber-400" size={16} />
      };
    }
    return {
      label: "TIDAK AKURAT (> 100m)",
      color: "text-red-400",
      bg: "bg-red-950/20",
      border: "border-red-500/30",
      icon: <AlertCircle className="text-red-400" size={16} />
    };
  };

  const status = getAccuracyStatus(coords?.accuracy);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 flex flex-col justify-between select-none">
      <div>
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push("/user")}
            className="text-white hover:opacity-80 transition-opacity bg-white/10 p-2.5 rounded-full"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold">GPS Real-time Debug</h1>
            <p className="text-xs text-zinc-400">Inspeksi Data Runtime Sensor GPS</p>
          </div>
        </div>

        {/* Real-time Stats */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 mb-5">
          <div className={`flex items-center justify-between border-b border-zinc-800 pb-4 mb-4`}>
            <div className="flex items-center gap-3">
              <div className="bg-[#2AB0B2]/10 p-2 rounded-xl">
                <Compass className="text-[#2AB0B2]" size={20} />
              </div>
              <div>
                <p className="text-[10px] text-zinc-400">Sensor Status</p>
                <p className="text-xs font-semibold text-white">
                  {errorMsg ? "Error / Connection Lost" : coords ? "Menerima Pembaruan..." : "Mencari Lokasi..."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800/80">
              <Clock size={12} className="text-zinc-400" />
              <span className="text-[10px] font-mono text-zinc-300">{elapsedSeconds}s elapsed</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800/50">
              <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5">Latitude</p>
              <p className="text-xs font-mono text-white">{coords ? coords.latitude : "-"}</p>
            </div>
            <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800/50">
              <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5">Longitude</p>
              <p className="text-xs font-mono text-white">{coords ? coords.longitude : "-"}</p>
            </div>
            <div className={`col-span-2 p-4 rounded-2xl border ${status.border} ${status.bg} flex items-center justify-between`}>
              <div>
                <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5">Akurasi GPS (Accuracy)</p>
                <p className={`text-2xl font-bold font-mono ${status.color}`}>
                  {coords ? `${coords.accuracy.toFixed(1)} meter` : "-"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Status Kelayakan</span>
                <div className="flex items-center gap-1.5">
                  {status.icon}
                  <span className={`text-xs font-bold ${status.color}`}>{status.label}</span>
                </div>
              </div>
            </div>
            <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800/50">
              <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5">Altitude</p>
              <p className="text-xs font-mono text-white">
                {coords && coords.altitude !== null ? `${coords.altitude.toFixed(1)} m` : "Tidak Didukung"}
              </p>
            </div>
            <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800/50">
              <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5">Heading</p>
              <p className="text-xs font-mono text-white">
                {coords && coords.heading !== null ? `${coords.heading.toFixed(1)}°` : "Tidak Didukung"}
              </p>
            </div>
            <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800/50">
              <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5">Speed</p>
              <p className="text-xs font-mono text-white">
                {coords && coords.speed !== null ? `${coords.speed.toFixed(1)} m/s` : "Tidak Didukung"}
              </p>
            </div>
            <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800/50">
              <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5">GPS Update Count</p>
              <p className="text-xs font-mono text-white">{updateCount}</p>
            </div>
          </div>
        </div>

        {/* Geolocation Options */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Info size={14} className="text-[#2AB0B2]" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">watchPosition Config</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            <div className="bg-zinc-950 py-2.5 px-1.5 rounded-xl border border-zinc-800/40">
              <p className="text-zinc-500 font-semibold mb-0.5">enableHighAccuracy</p>
              <p className="font-mono text-emerald-400">{watchOptions.enableHighAccuracy.toString()}</p>
            </div>
            <div className="bg-zinc-950 py-2.5 px-1.5 rounded-xl border border-zinc-800/40">
              <p className="text-zinc-500 font-semibold mb-0.5">timeout</p>
              <p className="font-mono text-white">{watchOptions.timeout} ms</p>
            </div>
            <div className="bg-zinc-950 py-2.5 px-1.5 rounded-xl border border-zinc-800/40">
              <p className="text-zinc-500 font-semibold mb-0.5">maximumAge</p>
              <p className="font-mono text-white">{watchOptions.maximumAge}</p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-950/40 border border-red-800/50 text-red-200 text-xs rounded-2xl p-4 mb-5">
            ⚠️ <strong>GPS Error:</strong> {errorMsg}
          </div>
        )}

        {/* Real-time Accuracy History */}
        <div className="mb-5">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Kronologi Akurasi GPS (Max 30)</p>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 h-40 overflow-y-auto font-mono text-[10px] text-zinc-300 flex flex-col gap-2">
            {accuracyHistory.length === 0 ? (
              <p className="text-zinc-500 italic">Menunggu update data...</p>
            ) : (
              accuracyHistory.map((item) => {
                const itemStatus = getAccuracyStatus(item.accuracy);
                return (
                  <div key={item.id} className="flex justify-between items-center border-b border-zinc-900 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-zinc-400">Update #{item.updateNumber}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-500">{item.timestamp}</span>
                      <span className={`font-bold ${itemStatus.color}`}>{item.accuracy.toFixed(1)} meter</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Log */}
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Live Log</p>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 h-32 overflow-y-auto font-mono text-[9px] text-zinc-500 flex flex-col gap-1.5">
            {logHistory.map((log, index) => (
              <div key={index} className="border-b border-zinc-900 pb-1.5 last:border-0 last:pb-0">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[9px] text-zinc-500 mt-6 pt-4 border-t border-zinc-900">
        PT Sampul Kreativ Technology • Mode Investigasi Geolocation
      </div>
    </div>
  );
}
