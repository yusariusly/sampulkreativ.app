"use client";

import React, { useEffect, useState, useCallback } from "react";
import { DollarSign, Wallet, ShieldAlert, Award, FileText, Settings, User, ArrowLeft, Lock } from "lucide-react";
import EmployeeDirectory from "./components/EmployeeDirectory";
import SalaryConfigForm from "./components/SalaryConfigForm";
import GenerateSlipForm from "./components/GenerateSlipForm";
import SlipsHistoryList from "./components/SlipsHistoryList";
import PayslipPreviewModal from "./components/PayslipPreviewModal";
import ApproverConfigCard from "./components/ApproverConfigCard";
import PayrollNoticeConfigCard from "./components/PayrollNoticeConfigCard";
import PayrollPasswordGate from "./components/PayrollPasswordGate";

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
  // Autentikasi Khusus Payroll Gate
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const unlocked = sessionStorage.getItem("v2_payroll_unlocked");
      if (unlocked === "true") {
        setIsUnlocked(true);
      }
      setAuthChecked(true);
    }
  }, []);

  const handleLockPayroll = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("v2_payroll_unlocked");
    }
    setIsUnlocked(false);
  };

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
    if (isUnlocked) {
      fetchEmployees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked]);

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

  if (!authChecked) {
    return (
      <div className="flex-1 min-h-[calc(100dvh-57px)] flex items-center justify-center bg-[#F0F2F5]">
        <div className="w-8 h-8 border-3 border-[#2AB0B2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Jika belum membuka gembok password, render PayrollPasswordGate
  if (!isUnlocked) {
    return <PayrollPasswordGate onSuccess={() => setIsUnlocked(true)} />;
  }

  return (
    <div className="flex-1 bg-[#F0F2F5] p-4 lg:p-8 select-none relative print:p-0 print:bg-white h-[calc(100dvh-57px)] lg:h-auto flex flex-col overflow-hidden lg:overflow-visible animate-fade-in">
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

        {/* Tombol Kunci Kembali Akses Payroll */}
        <button
          onClick={handleLockPayroll}
          title="Kunci Akses Payroll"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-bold transition-all shadow-3xs cursor-pointer active:scale-95"
        >
          <Lock size={13} />
          <span className="hidden sm:inline">Kunci Akses</span>
        </button>
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
            Pengaturan & Notice
          </button>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Employee Directory */}
        <div
          className={`w-full lg:col-span-4 h-full min-h-0 lg:max-h-[calc(100vh-140px)] flex-col flex ${
            !selectedEmployee && mobileSection === "settings" ? "hidden lg:flex" : "flex"
          } ${selectedEmployee ? "hidden lg:flex" : "flex"}`}
        >
          <EmployeeDirectory
            employees={employees}
            selectedEmployee={selectedEmployee}
            onSelectEmployee={handleSelectEmployee}
            loading={loading}
          />
        </div>

        {/* Right Column: Work Area & Settings */}
        <div
          className={`w-full lg:col-span-8 flex-1 min-h-0 lg:max-h-[calc(100vh-140px)] flex-col gap-6 overflow-y-auto pr-0 lg:pr-1 ${
            !selectedEmployee && mobileSection === "directory" ? "hidden lg:flex" : "flex"
          }`}
        >
          {selectedEmployee ? (
            /* Selected Employee View */
            <div className="flex flex-col gap-5">
              {/* Mobile Back Button */}
              <div className="flex items-center justify-between lg:hidden mb-1">
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#2AB0B2] hover:text-[#1C3D3F] bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-3xs"
                >
                  <ArrowLeft size={14} />
                  <span>Kembali ke Daftar</span>
                </button>
                <span className="text-[11px] font-bold text-slate-400">
                  {selectedEmployee.nama_lengkap}
                </span>
              </div>

              {/* Navigation Tabs (Config / Generate / History) */}
              <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-3xs flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setActiveTab("config")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    activeTab === "config"
                      ? "bg-[#2AB0B2] text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <Settings size={14} />
                  <span>Konfigurasi Gaji</span>
                </button>

                <button
                  onClick={() => setActiveTab("generate")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    activeTab === "generate"
                      ? "bg-[#2AB0B2] text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <FileText size={14} />
                  <span>Hitung & Buat Slip Gaji</span>
                </button>

                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    activeTab === "history"
                      ? "bg-[#2AB0B2] text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <Award size={14} />
                  <span>Riwayat Slip Gaji</span>
                </button>
              </div>

              {/* Active Sub-component */}
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
          ) : (
            /* No Employee Selected Placeholder + Global Approver & Notice Settings */
            <div className="flex flex-col gap-6">
              <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-3xs flex flex-col items-center justify-center text-center min-h-[220px]">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#2AB0B2] flex items-center justify-center mb-3">
                  <Wallet size={26} />
                </div>
                <h3 className="text-base font-bold text-[#1C3D3F]">Dasbor Payroll Terpadu</h3>
                <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
                  Silakan pilih salah satu karyawan dari direktori sebelah kiri untuk mengonfigurasi rincian gaji, menghitung rekap absensi, atau menerbitkan dan mengunduh slip gaji bulanan mereka.
                </p>
              </div>

              {/* Dual Column for Global Approver & Notice Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ApproverConfigCard onApproverUpdated={handleApproverUpdated} />
                <PayrollNoticeConfigCard />
              </div>
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
