"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, RefreshCw, Compass } from "lucide-react";
import { useRouter } from "next/navigation";

interface GPSUpdate {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

export default function SelfieDebugPage() {
  const router = useRouter();
  const [coords, setCoords] = useState<GPSUpdate | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logHistory, setLogHistory] = useState<string[]>([]);

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    const logStr = `[${time}] ${message}`;
    console.log(logStr);
    setLogHistory((prev) => [logStr, ...prev].slice(0, 50));
  };

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
          timestamp: timeStr,
        };

        setCoords(newCoords);
        setUpdateCount((prev) => prev + 1);
        setErrorMsg(null);

        addLog(`Update #${updateCount + 1}: Lat=${newCoords.latitude.toFixed(7)}, Lng=${newCoords.longitude.toFixed(7)}, Accuracy=${newCoords.accuracy}m`);
      },
      (error) => {
        const errMsg = `Code ${error.code}: ${error.message}`;
        setErrorMsg(errMsg);
        addLog(`ERROR: ${errMsg}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );

    return () => {
      addLog("Menghentikan watchPosition...");
      navigator.geolocation.clearWatch(watchId);
    };
  }, [updateCount]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 flex flex-col justify-between select-none">
      <div>
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/user")}
            className="text-white hover:opacity-80 transition-opacity bg-white/10 p-2.5 rounded-full"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold">GPS Real-time Debug</h1>
            <p className="text-xs text-zinc-400">Investigasi watchPosition & Akurasi</p>
          </div>
        </div>

        {/* Real-time Stats */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6 border-b border-zinc-800 pb-4">
            <div className="bg-[#2AB0B2]/10 p-2 rounded-xl">
              <Compass className="text-[#2AB0B2]" size={24} />
            </div>
            <div>
              <p className="text-xs text-zinc-400">Status Sensor</p>
              <p className="text-sm font-semibold text-white">
                {errorMsg ? "Error / Terputus" : coords ? "Menerima Pembaruan..." : "Mencari Satelit..."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">Latitude</p>
              <p className="text-sm font-mono text-white">{coords ? coords.latitude : "-"}</p>
            </div>
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">Longitude</p>
              <p className="text-sm font-mono text-white">{coords ? coords.longitude : "-"}</p>
            </div>
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50 col-span-2">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">Akurasi GPS (Accuracy)</p>
              <p className={`text-xl font-bold font-mono ${coords && coords.accuracy <= 30 ? "text-emerald-400" : "text-amber-400"}`}>
                {coords ? `${coords.accuracy.toFixed(1)} meter` : "-"}
              </p>
              {coords && coords.accuracy > 30 && (
                <p className="text-[10px] text-amber-500/80 mt-1">⚠️ Melebihi radius kantor (30m)</p>
              )}
            </div>
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">Update Count</p>
              <p className="text-sm font-mono text-white">{updateCount}</p>
            </div>
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">Timestamp</p>
              <p className="text-sm font-mono text-white">{coords ? coords.timestamp : "-"}</p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-950/40 border border-red-800/50 text-red-200 text-xs rounded-2xl p-4 mb-6">
            ⚠️ <strong>GPS Error:</strong> {errorMsg}
          </div>
        )}

        {/* Log Viewer */}
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Live Log History (Max 50)</p>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 h-60 overflow-y-auto font-mono text-[10px] text-zinc-300 flex flex-col gap-1.5">
            {logHistory.length === 0 ? (
              <p className="text-zinc-500 italic">Menunggu update data...</p>
            ) : (
              logHistory.map((log, index) => (
                <div key={index} className="border-b border-zinc-900 pb-1 last:border-0">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[10px] text-zinc-500 mt-6 pt-4 border-t border-zinc-900">
        PT Sampul Kreativ Technology • Mode Investigasi Geolocation
      </div>
    </div>
  );
}
