"use client";

import React, { useEffect, useState, useCallback } from "react";
import { DollarSign, Wallet, ShieldAlert, Award, FileText, Settings, User } from "lucide-react";
import EmployeeDirectory from "./components/EmployeeDirectory";
import SalaryConfigForm from "./components/SalaryConfigForm";
import GenerateSlipForm from "./components/GenerateSlipForm";
import SlipsHistoryList from "./components/SlipsHistoryList";
import PayslipPreviewModal from "./components/PayslipPreviewModal";
import ApproverConfigCard from "./components/ApproverConfigCard";

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

export default function AdminPayrollPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Tab states for selected employee panel
  const [activeTab, setActiveTab] = useState<"config" | "generate" | "history">("config");

  // Signature states
  const [approverName, setApproverName] = useState("M. Firas Faisal");
  const [approverRole, setApproverRole] = useState("Direktur Utama");

  // Re-fetch triggers
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState(0);

  // Selected slip for preview modal
  const [previewSlip, setPreviewSlip] = useState<any | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/payroll/config");
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
        
        // Sync selected employee state if one is already chosen
        if (selectedEmployee) {
          const updated = data.find((e: Employee) => e.user_id === selectedEmployee.user_id);
          if (updated) setSelectedEmployee(updated);
        }
      }
    } catch (err) {
      console.error("Gagal memuat karyawan:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee]);

  useEffect(() => {
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setActiveTab("config");
  };

  const handleApproverUpdated = useCallback((name: string, role: string) => {
    setApproverName(name);
    setApproverRole(role);
  }, []);

  const handlePreviewSlip = (slipDetails: any) => {
    setPreviewSlip(slipDetails);
  };

  const handleSaveSlipSuccess = () => {
    setRefreshHistoryTrigger((prev) => prev + 1);
    setActiveTab("history");
  };

  return (
    <div className="flex-1 bg-[#F0F2F5] p-4 md:p-8 select-none relative print:p-0 print:bg-white">
      {/* Title Header (Hidden on Print) */}
      <div className="flex items-center justify-between mb-6 md:mb-8 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#2AB0B2]/10 rounded-xl text-[#2AB0B2]">
              <Wallet size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#1C3D3F]">Sistem Payroll Karyawan</h1>
              <p className="text-gray-400 text-xs mt-1">Kelola gaji pokok, tunjangan, potongan absensi, dan terbitkan slip gaji resmi</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:hidden">
        {/* Left Side: Employee Directory */}
        <div className="lg:col-span-4 h-[calc(100vh-180px)] min-h-[500px]">
          <EmployeeDirectory
            employees={employees}
            selectedEmployee={selectedEmployee}
            onSelectEmployee={handleSelectEmployee}
            loading={loading}
          />
        </div>

        {/* Right Side: Selected Employee Action Center */}
        <div className="lg:col-span-8 space-y-6">
          {selectedEmployee ? (
            <>
              {/* Employee Summary Card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#2AB0B2]/10 flex items-center justify-center text-[#2AB0B2] font-black text-sm">
                    {selectedEmployee.nama_lengkap.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[#1C3D3F] text-base">{selectedEmployee.nama_lengkap}</h3>
                    <p className="text-xs font-bold text-[#2AB0B2] mt-0.5 uppercase tracking-wider">{selectedEmployee.jabatan}</p>
                    <p className="text-[10px] text-gray-400 font-semibold mt-1">Username: @{selectedEmployee.username}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 rounded-xl border border-emerald-100/50">
                  <DollarSign size={14} className="text-emerald-500" />
                  <span className="text-xs font-extrabold text-emerald-600">Aktif</span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex gap-2 border-b border-gray-200 pb-px">
                <button
                  onClick={() => setActiveTab("config")}
                  className={`px-4.5 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
                    activeTab === "config"
                      ? "border-[#2AB0B2] text-[#2AB0B2]"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Konfigurasi Finansial
                </button>
                <button
                  onClick={() => setActiveTab("generate")}
                  className={`px-4.5 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
                    activeTab === "generate"
                      ? "border-[#2AB0B2] text-[#2AB0B2]"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Generate Slip Gaji
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-4.5 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
                    activeTab === "history"
                      ? "border-[#2AB0B2] text-[#2AB0B2]"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Riwayat Slip
                </button>
              </div>

              {/* Active Tab Panel */}
              <div className="transition-all duration-200">
                {activeTab === "config" && (
                  <SalaryConfigForm
                    employee={selectedEmployee}
                    onSaveSuccess={fetchEmployees}
                  />
                )}

                {activeTab === "generate" && (
                  <GenerateSlipForm
                    employee={selectedEmployee}
                    onPreviewRequested={handlePreviewSlip}
                  />
                )}

                {activeTab === "history" && (
                  <SlipsHistoryList
                    userId={selectedEmployee.user_id}
                    refreshTrigger={refreshHistoryTrigger}
                    onSelectSlip={handlePreviewSlip}
                  />
                )}
              </div>

              {/* Signature Settings Form Card */}
              <ApproverConfigCard onApproverUpdated={handleApproverUpdated} />
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 bg-[#2AB0B2]/5 border border-[#2AB0B2]/10 text-[#2AB0B2] rounded-3xl flex items-center justify-center mb-4">
                <Wallet size={28} />
              </div>
              <h3 className="font-extrabold text-[#1C3D3F] text-base">Dasbor Payroll Terpadu</h3>
              <p className="text-gray-400 text-xs mt-1.5 max-w-sm leading-relaxed">
                Silakan pilih salah satu karyawan dari direktori sebelah kiri untuk mengonfigurasi rincian gaji, menghitung rekap absensi, atau menerbitkan dan mengunduh slip gaji bulanan mereka.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Slip Preview Modal (Overlay) */}
      {previewSlip && (
        <PayslipPreviewModal
          slip={previewSlip}
          approverName={approverName}
          approverRole={approverRole}
          onClose={() => setPreviewSlip(null)}
          onSaveSuccess={handleSaveSlipSuccess}
        />
      )}
    </div>
  );
}
