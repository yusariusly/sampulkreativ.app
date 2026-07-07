"use client";

import React, { useEffect, useState, useCallback } from "react";
import { DollarSign, Wallet, ShieldAlert, Award, FileText, Settings, User, ArrowLeft } from "lucide-react";
import EmployeeDirectory from "./components/EmployeeDirectory";
import SalaryConfigForm from "./components/SalaryConfigForm";
import GenerateSlipForm from "./components/GenerateSlipForm";
import SlipsHistoryList from "./components/SlipsHistoryList";
import PayslipPreviewModal from "./components/PayslipPreviewModal";
import ApproverConfigCard from "./components/ApproverConfigCard";
import PayrollNoticeConfigCard from "./components/PayrollNoticeConfigCard";

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

  const [mobileSection, setMobileSection] = useState<"directory" | "settings">("directory");

  return (
    <div className="flex-1 bg-[#F0F2F5] p-4 lg:p-8 select-none relative print:p-0 print:bg-white h-[calc(100dvh-57px)] lg:h-auto flex flex-col overflow-hidden lg:overflow-visible">
      {/* Title Header (Hidden on Print) */}
      <div className="flex items-center justify-between mb-4 md:mb-6 print:hidden flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 md:gap-2.5">
            <div className="p-2 md:p-2.5 bg-[#2AB0B2]/10 rounded-xl text-[#2AB0B2]">
              <Wallet size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-3xl font-bold text-[#1C3D3F] leading-tight">Sistem Payroll Karyawan</h1>
              <p className="text-gray-400 text-[10px] md:text-xs mt-0.5 md:mt-1">Kelola gaji, tunjangan, potongan absensi, dan slip gaji</p>
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Control for Mobile Settings vs Directory (Only shown on mobile when no employee is selected) */}
      {!selectedEmployee && (
        <div className="flex lg:hidden bg-slate-200/60 p-1 rounded-xl mb-4 flex-shrink-0">
          <button
            onClick={() => setMobileSection("directory")}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mobileSection === "directory"
                ? "bg-[#2AB0B2] text-white shadow-xs"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Direktori Karyawan
          </button>
          <button
            onClick={() => setMobileSection("settings")}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mobileSection === "settings"
                ? "bg-[#2AB0B2] text-white shadow-xs"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Pengaturan Sistem
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:items-start print:hidden">
        {/* Left Side: Employee Directory */}
        <div className={`lg:col-span-4 h-full lg:h-[calc(100vh-180px)] lg:min-h-[500px] ${
          selectedEmployee 
            ? "hidden lg:block" 
            : (mobileSection === "directory" ? "block h-full" : "hidden lg:block")
        }`}>
          <EmployeeDirectory
            employees={employees}
            selectedEmployee={selectedEmployee}
            onSelectEmployee={handleSelectEmployee}
            loading={loading}
          />
        </div>

        {/* Right Side: Selected Employee Action Center & Global Configs */}
        <div className={`lg:col-span-8 h-full space-y-4 lg:space-y-6 ${
          selectedEmployee 
            ? "flex flex-col" 
            : (mobileSection === "settings" ? "flex flex-col lg:flex lg:flex-col" : "hidden lg:flex lg:flex-col")
        }`}>
          {selectedEmployee ? (
            <>
              {/* Employee Summary Card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 shadow-xs flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                  {/* Back button on mobile */}
                  <button 
                    onClick={() => setSelectedEmployee(null)}
                    className="lg:hidden p-2 -ml-2 hover:bg-slate-100 rounded-xl text-slate-500 mr-1 flex-shrink-0 cursor-pointer active:scale-90 transition-transform"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-[#2AB0B2]/10 flex items-center justify-center text-[#2AB0B2] font-black text-sm flex-shrink-0">
                    {selectedEmployee.nama_lengkap.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-[#1C3D3F] text-sm md:text-base truncate">{selectedEmployee.nama_lengkap}</h3>
                    <p className="text-[10px] font-bold text-[#2AB0B2] mt-0.5 uppercase tracking-wider truncate">{selectedEmployee.jabatan}</p>
                    <p className="text-[9px] text-gray-400 font-semibold mt-0.5 truncate">Username: @{selectedEmployee.username}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100/50 flex-shrink-0">
                  <DollarSign size={12} className="text-emerald-500" />
                  <span className="text-[10px] font-extrabold text-emerald-600">Aktif</span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex gap-2 border-b border-gray-200 pb-px overflow-x-auto no-scrollbar scroll-smooth flex-shrink-0">
                <button
                  onClick={() => setActiveTab("config")}
                  className={`px-3 md:px-4.5 py-2 md:py-2.5 font-bold text-[11px] md:text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "config"
                      ? "border-[#2AB0B2] text-[#2AB0B2]"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Konfigurasi Finansial
                </button>
                <button
                  onClick={() => setActiveTab("generate")}
                  className={`px-3 md:px-4.5 py-2 md:py-2.5 font-bold text-[11px] md:text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "generate"
                      ? "border-[#2AB0B2] text-[#2AB0B2]"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Generate Slip Gaji
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-3 md:px-4.5 py-2 md:py-2.5 font-bold text-[11px] md:text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "history"
                      ? "border-[#2AB0B2] text-[#2AB0B2]"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Riwayat Slip
                </button>
              </div>

              {/* Active Tab Panel */}
              <div className="transition-all duration-200 flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
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
            </>
          ) : (
            <div className="hidden lg:flex bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-xs flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 bg-[#2AB0B2]/5 border border-[#2AB0B2]/10 text-[#2AB0B2] rounded-3xl flex items-center justify-center mb-4">
                <Wallet size={28} />
              </div>
              <h3 className="font-extrabold text-[#1C3D3F] text-base">Dasbor Payroll Terpadu</h3>
              <p className="text-gray-400 text-xs mt-1.5 max-w-sm leading-relaxed">
                Silakan pilih salah satu karyawan dari direktori sebelah kiri untuk mengonfigurasi rincian gaji, menghitung rekap absensi, atau menerbitkan dan mengunduh slip gaji bulanan mereka.
              </p>
            </div>
          )}

          {/* Global Payroll Config Section */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden ${
            selectedEmployee 
              ? "hidden lg:grid" 
              : (mobileSection === "settings" ? "flex-1 min-h-0 overflow-y-auto pb-4 pr-1 grid" : "hidden lg:grid")
          }`}>
            <ApproverConfigCard onApproverUpdated={handleApproverUpdated} />
            <PayrollNoticeConfigCard />
          </div>
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
