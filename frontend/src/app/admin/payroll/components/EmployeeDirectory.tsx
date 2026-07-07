"use client";

import React, { useState } from "react";
import { Users, Search, DollarSign } from "lucide-react";

interface Employee {
  user_id: string;
  username: string;
  nama_lengkap: string;
  role: string;
  gaji_pokok: number;
  tunjangan_makan: number;
  tunjangan_transport: number;
  potongan_alpha: number;
  jabatan: string;
  bonus: number;
}

interface EmployeeDirectoryProps {
  employees: Employee[];
  selectedEmployee: Employee | null;
  onSelectEmployee: (emp: Employee) => void;
  loading: boolean;
}

export default function EmployeeDirectory({
  employees,
  selectedEmployee,
  onSelectEmployee,
  loading,
}: EmployeeDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.jabatan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs flex flex-col h-full overflow-hidden">
      {/* Directory Header */}
      <div className="p-5 border-b border-gray-100/80 bg-slate-50/50 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} className="text-[#2AB0B2]" />
          <h3 className="font-bold text-[#1C3D3F] text-base">Direktori Karyawan</h3>
        </div>
        
        {/* Search input */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama atau jabatan..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#2AB0B2] outline-none text-gray-700 font-medium transition-all text-xs bg-white"
          />
        </div>
      </div>

      {/* Employee List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100/50">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-gray-400 font-medium">
            Memuat data karyawan...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <p className="text-gray-400 text-xs font-semibold">Tidak ada karyawan ditemukan</p>
            <p className="text-gray-300 text-[10px] mt-1">Coba kata kunci pencarian yang lain</p>
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const isSelected = selectedEmployee?.user_id === emp.user_id;
            return (
              <button
                key={emp.user_id}
                onClick={() => onSelectEmployee(emp)}
                className={`w-full text-left p-4 flex items-center justify-between transition-all outline-none cursor-pointer ${
                  isSelected
                    ? "bg-[#2AB0B2]/10 border-l-4 border-[#2AB0B2]"
                    : "hover:bg-slate-50 border-l-4 border-transparent"
                }`}
              >
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-gray-800 text-xs truncate">
                    {emp.nama_lengkap}
                  </p>
                  <p className="text-[10px] font-bold text-[#2AB0B2] mt-0.5 uppercase tracking-wide">
                    {emp.jabatan || "Karyawan"}
                  </p>
                  <p className="text-[10px] text-gray-400 font-semibold mt-1">
                    @{emp.username}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-[#2AB0B2]/10 rounded-md text-[10px] font-extrabold text-[#2AB0B2]">
                    <span>
                      {formatRupiah(
                        22 * (Number(emp.gaji_pokok) + Number(emp.tunjangan_makan) + Number(emp.tunjangan_transport)) + Number(emp.bonus || 0)
                      )}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Stats Summary Footer */}
      <div className="p-4 bg-slate-50/80 border-t border-gray-100/80 text-[10px] font-bold text-gray-400 flex justify-between flex-shrink-0">
        <span>TOTAL KARYAWAN:</span>
        <span className="text-[#1C3D3F]">{employees.length} Orang</span>
      </div>
    </div>
  );
}
