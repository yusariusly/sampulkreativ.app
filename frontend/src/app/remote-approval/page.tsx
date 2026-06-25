"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface RequestDetails {
  id: string;
  tanggal: string;
  alasan: string;
  status: string;
  nama_lengkap: string;
}

function RemoteApprovalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<RequestDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Token persetujuan tidak ditemukan atau tautan tidak valid.");
      setLoading(false);
      return;
    }

    // Fetch token details from backend
    fetch(`/api/remote/requests/token/${token}`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.error || "Gagal memverifikasi token");
          });
        }
        return res.json();
      })
      .then((data) => {
        setDetails(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Gagal memverifikasi token.");
        setLoading(false);
      });
  }, [token]);

  const handleAction = async (decision: "approve" | "reject") => {
    if (!details || !token) return;

    setActionStatus("submitting");
    try {
      const response = await fetch(`/api/remote/requests/${details.id}/${decision}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Gagal memproses ${decision === "approve" ? "persetujuan" : "penolakan"}`);
      }

      setActionStatus("success");
      setMessage(data.message || `Permohonan WFH berhasil ${decision === "approve" ? "disetujui" : "ditolak"}.`);
    } catch (err: any) {
      setActionStatus("error");
      setMessage(err.message || "Terjadi kesalahan koneksi ke server.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground font-medium">Memverifikasi token permohonan...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md w-full mx-auto bg-white rounded-xl shadow-md border border-border overflow-hidden p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Tautan Kadaluwarsa / Tidak Valid</h2>
        <p className="text-muted-foreground text-sm mb-6">{error}</p>
        <div className="text-xs text-muted-foreground/60 border-t pt-4">
          Sampul Kreativ Management System
        </div>
      </div>
    );
  }

  if (actionStatus === "success") {
    return (
      <div className="max-w-md w-full mx-auto bg-white rounded-xl shadow-md border border-border overflow-hidden p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Proses Berhasil</h2>
        <p className="text-muted-foreground text-sm mb-6">{message}</p>
        <p className="text-xs text-emerald-600/80 bg-emerald-50 py-2 px-3 rounded-lg inline-block font-medium">
          Status permohonan telah diperbarui secara langsung.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-xl shadow-lg border border-border overflow-hidden">
      <div className="bg-primary px-6 py-8 text-white text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Persetujuan Remote Working</h1>
        <p className="text-white/80 text-sm mt-1">Portal Konfirmasi Atasan</p>
      </div>

      <div className="p-6">
        <div className="space-y-4 mb-6">
          <div>
            <span className="text-xs uppercase font-semibold text-muted-foreground block mb-0.5">Nama Karyawan</span>
            <span className="text-base font-bold text-foreground">{details?.nama_lengkap}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs uppercase font-semibold text-muted-foreground block mb-0.5">Tanggal Kerja</span>
              <span className="text-sm font-semibold text-foreground">
                {details?.tanggal ? new Date(details.tanggal).toLocaleDateString('id-ID', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : '-'}
              </span>
            </div>
            <div>
              <span className="text-xs uppercase font-semibold text-muted-foreground block mb-0.5">Status Saat Ini</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                {details?.status}
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs uppercase font-semibold text-muted-foreground block mb-0.5">Alasan Permohonan</span>
            <div className="p-3 bg-muted rounded-lg border text-sm text-foreground italic whitespace-pre-line">
              "{details?.alasan}"
            </div>
          </div>
        </div>

        {actionStatus === "error" && (
          <div className="p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold text-center">
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleAction("reject")}
            disabled={actionStatus === "submitting"}
            className="flex-1 py-3 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            Tolak Izin
          </button>
          <button
            onClick={() => handleAction("approve")}
            disabled={actionStatus === "submitting"}
            className="flex-1 py-3 px-4 rounded-lg bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-md shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {actionStatus === "submitting" ? "Memproses..." : "Setujui WFH"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RemoteApprovalPage() {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground font-medium">Memuat halaman persetujuan...</p>
        </div>
      }>
        <RemoteApprovalContent />
      </Suspense>
    </div>
  );
}
