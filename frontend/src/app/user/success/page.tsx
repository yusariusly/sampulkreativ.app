"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

export default function SuccessPage() {
  const router = useRouter();
  const [clockTime, setClockTime] = useState("");
  const [coords, setCoords] = useState("Tanpa GPS");
  const [address, setAddress] = useState("Kantor");
  const [fullname, setFullname] = useState("Karyawan");
  const [absenType, setAbsenType] = useState("masuk");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedType = sessionStorage.getItem("v2_last_absen_type") || "masuk";
      setAbsenType(storedType);
      const isOut = storedType === "pulang";

      const timeKey = isOut ? "v2_clockOutTime" : "v2_clockInTime";
      const coordsKey = isOut ? "v2_clockOutCoords" : "v2_clockInCoords";

      const storedTime = localStorage.getItem(timeKey);
      if (storedTime) {
        setClockTime(storedTime);
      } else {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        setClockTime(`${hh}:${mm}`);
      }

      const storedCoords = localStorage.getItem(coordsKey);
      if (storedCoords) {
        setCoords(storedCoords);
      }

      const storedUser = localStorage.getItem("v2_user");
      if (storedUser) {
        try {
          const userObj = JSON.parse(storedUser);
          setFullname(userObj.nama_lengkap);
        } catch (e) {}
      }
    }
  }, []);

  const handleDone = () => {
    router.push("/user");
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#F0F2F5] px-7 select-none">
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center mb-7 animate-bounce"
        style={{ backgroundColor: absenType === "pulang" ? "#E0E7FF" : "#D1FAE5" }}
      >
        <CheckCircle size={64} color={absenType === "pulang" ? "#4F46E5" : "#10B981"} strokeWidth={1.5} />
      </div>
      
      <h2 className="text-2xl font-bold mb-2 text-[#1C3D3F]">
        {absenType === "pulang" ? "Absen Pulang Berhasil!" : "Absensi Berhasil!"}
      </h2>
      <p className="text-gray-400 text-sm mb-8 text-center">
        {absenType === "pulang"
          ? "Absen pulang Anda telah tercatat dengan sukses"
          : "Kehadiran Anda telah tercatat dengan sukses"}
      </p>

      <div className="bg-white rounded-2xl shadow-sm p-6 w-full mb-8 space-y-4 border border-gray-100/50">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Nama Karyawan</span>
          <span className="font-bold text-[#1C3D3F]">{fullname}</span>
        </div>
        <div className="h-px bg-gray-100" />
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Jam Absen</span>
          <span className="font-bold text-[#1C3D3F]">{clockTime} WIB</span>
        </div>
        <div className="h-px bg-gray-100" />
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Lokasi</span>
          <span className="font-bold text-sm text-right text-[#1C3D3F] max-w-[200px] truncate">
            {address}
          </span>
        </div>
        {coords !== "Tanpa GPS" && (
          <>
            <div className="h-px bg-gray-100" />
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Koordinat GPS</span>
              <span className="font-bold text-xs text-right text-gray-500 font-mono">
                {coords}
              </span>
            </div>
          </>
        )}
        <div className="h-px bg-gray-100" />
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Status</span>
          <span className={`rounded-full font-bold px-4 py-1.5 text-sm ${absenType === "pulang" ? "bg-indigo-600" : "bg-[#2AB0B2]"} text-white shadow-xs`}>
            {absenType === "pulang" ? "Pulang" : "Hadir"}
          </span>
        </div>
      </div>

      <button
        onClick={handleDone}
        className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-md transition-colors cursor-pointer ${
          absenType === "pulang"
            ? "bg-indigo-600 hover:bg-indigo-700"
            : "bg-[#2AB0B2] hover:bg-[#209092]"
        }`}
      >
        Kembali ke Beranda
      </button>
    </div>
  );
}
