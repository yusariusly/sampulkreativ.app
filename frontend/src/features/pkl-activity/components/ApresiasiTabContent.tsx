import React, { useEffect, useState } from "react";
import {
  Crown,
  Star,
  Clock,
  Smile,
  CheckSquare,
  User,
  Sparkles,
  BookOpen,
  Award,
  Lock
} from "lucide-react";
import { DiscretePointsRow } from "./DiscretePointsRow";

interface ApresiasiTabContentProps {
  papan_apresiasi: {
    is_published: boolean;
    week_number?: number;
    cohort_week_number?: number;
    total_points?: number;
    aspects?: {
      wkt_point: number;
      skp_point: number;
      has_point: number;
      ker_point: number;
      ini_point: number;
    };
    feedback?: {
      tags: string[];
      comments: string | null;
    } | null;
    message?: string;
  } | null;
  aspect_settings?: Array<{
    aspect_key: string;
    label: string;
    icon_name: string;
    is_active: number;
  }>;
  userId: string;
  deviceId: string;
  cohort_active_week?: number;
  active_week?: number;
}

// Jester / Clown Hat SVG
const ClownHatIcon: React.FC<{ size?: number; className?: string }> = ({ size = 40, className }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 19L12 4l7 15" />
    <path d="M4 19c4-1.5 6-1.5 8 0s4 1.5 8 0" />
    <circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);

/** Maps icon_name string from aspect_settings to the correct Lucide component */
const ICON_MAP: Record<string, typeof Star> = {
  Clock,
  Smile,
  CheckSquare,
  User,
  Sparkles,
  Star,
};

function resolveAspectIcon(iconName: string): typeof Star {
  return ICON_MAP[iconName] || Star;
}

type RankStatus = "winner" | "loser" | "neutral";

/** Determines hero visual config based on rank status */
function getHeroConfig(status: RankStatus) {
  switch (status) {
    case "winner":
      return {
        containerBg: "bg-white border-slate-200",
        iconBg: "bg-teal-50 border-teal-100",
        label: "Peraih Poin Tertinggi",
        labelColor: "text-[#1C3D3F] bg-teal-50 border-[#2AB0B2]/30",
        subtitle: "Luar biasa! Anda memimpin perolehan poin pekan ini.",
        subtitleColor: "text-slate-500",
        pointsColor: "text-[#1C3D3F]",
      };
    case "loser":
      return {
        containerBg: "bg-white border-slate-200",
        iconBg: "bg-slate-50 border-slate-200",
        label: "Peraih Poin Terendah",
        labelColor: "text-slate-700 bg-slate-50 border-slate-200",
        subtitle: "Jadikan pekan ini motivasi untuk berkinerja lebih baik!",
        subtitleColor: "text-slate-500",
        pointsColor: "text-[#1C3D3F]",
      };
    default:
      return {
        containerBg: "bg-white border-slate-200",
        iconBg: "bg-slate-50 border-slate-200",
        label: null,
        labelColor: "",
        subtitle: null,
        subtitleColor: "",
        pointsColor: "text-[#1C3D3F]",
      };
  }
}


export const ApresiasiTabContent: React.FC<ApresiasiTabContentProps> = ({
  papan_apresiasi,
  aspect_settings,
  userId,
  deviceId,
  cohort_active_week,
  active_week
}) => {
  const [apresiasiScoreboard, setApresiasiScoreboard] = useState<any[]>([]);
  const [scoreboardLoaded, setScoreboardLoaded] = useState(false);

  useEffect(() => {
    console.log("ApresiasiTabContent mounted/updated:", { userId, deviceId, is_published: papan_apresiasi?.is_published });
    if (!userId || !deviceId || !papan_apresiasi?.is_published) return;
    const fetchApresiasiScoreboard = async () => {
      const activeWeek = papan_apresiasi.cohort_week_number || papan_apresiasi.week_number || cohort_active_week || active_week || 1;
      try {
        console.log("Fetching scoreboard for week:", activeWeek);
        const res = await fetch(`/api/v1/pkl/scoreboard?week=${activeWeek}`, {
          headers: {
            "x-user-id": userId,
            "x-device-id": deviceId,
          },
        });
        if (res.ok) {
          const json = await res.json();
          console.log("Scoreboard fetched successfully:", json);
          if (json.status === "success" && json.data) {
            setApresiasiScoreboard(json.data.rankings || []);
          }
        } else {
          console.error("Scoreboard fetch non-ok status:", res.status);
        }
      } catch (e) {
        console.error("Gagal memuat scoreboard untuk apresiasi:", e);
      } finally {
        setScoreboardLoaded(true);
      }
    };
    fetchApresiasiScoreboard();
  }, [userId, deviceId, papan_apresiasi?.cohort_week_number, papan_apresiasi?.week_number, papan_apresiasi?.is_published, cohort_active_week, active_week]);


  const rankStatus: RankStatus = (() => {
    console.log("Evaluating rank status:", {
      is_published: papan_apresiasi?.is_published,
      scoreboardLoaded,
      rankingsCount: apresiasiScoreboard.length
    });
    if (!papan_apresiasi || !papan_apresiasi.is_published || !scoreboardLoaded || apresiasiScoreboard.length <= 1) {
      console.log("Rank evaluation skipped/defaulted to neutral");
      return "neutral";
    }
    const selfRankItem = apresiasiScoreboard.find(r => r.is_self);
    console.log("Self rank item:", selfRankItem);
    if (!selfRankItem) return "neutral";

    const maxPoints = Math.max(...apresiasiScoreboard.map(r => r.total_points));
    const minPoints = Math.min(...apresiasiScoreboard.map(r => r.total_points));
    console.log("Points comparison:", { selfPoints: selfRankItem.total_points, maxPoints, minPoints });

    if (maxPoints === minPoints) return "neutral";

    if (selfRankItem.total_points === maxPoints) return "winner";
    if (selfRankItem.total_points === minPoints) return "loser";
    return "neutral";
  })();


  // --- Unpublished State ---
  if (!papan_apresiasi || !papan_apresiasi.is_published) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-xl text-center">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
          <Lock size={16} className="stroke-[2.5px]" />
        </div>
        <p className="text-xs font-bold text-slate-600 mb-0.5">Poin Sedang Diproses</p>
        <p className="text-[10px] text-slate-400 max-w-[220px] leading-relaxed mt-1">
          {papan_apresiasi?.message || "Papan apresiasi mingguan Anda dirilis secara rutin oleh pembimbing magang Anda pada hari Jumat sore."}
        </p>
      </div>
    );
  }

  const heroConfig = getHeroConfig(rankStatus);

  // --- Published State ---
  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* ============================================ */}
      {/* 1. HERO: Status + Total Points               */}
      {/* ============================================ */}
      <div className={`rounded-xl border p-5 flex flex-col items-center text-center ${heroConfig.containerBg}`}>
        {/* Crown / Clown Hat / Neutral Icon — always visible, large */}
        {rankStatus === "winner" && (
          <div className="mb-3 flex flex-col items-center">
            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${heroConfig.iconBg}`}>
              <Crown size={36} className="text-[#2AB0B2] fill-[#2AB0B2]/15 stroke-[2px]" />
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest border px-2.5 py-0.5 rounded-md mt-2 ${heroConfig.labelColor}`}>
              {heroConfig.label}
            </span>
            <p className={`text-[10px] font-bold mt-1 ${heroConfig.subtitleColor}`}>
              {heroConfig.subtitle}
            </p>
          </div>
        )}
        {rankStatus === "loser" && (
          <div className="mb-3 flex flex-col items-center">
            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${heroConfig.iconBg}`}>
              <ClownHatIcon size={36} className="text-slate-400" />
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest border px-2.5 py-0.5 rounded-md mt-2 ${heroConfig.labelColor}`}>
              {heroConfig.label}
            </span>
            <p className={`text-[10px] font-bold mt-1 ${heroConfig.subtitleColor}`}>
              {heroConfig.subtitle}
            </p>
          </div>
        )}


        {/* Total Points — large number */}
        <h3 className={`text-5xl font-black leading-none tracking-tight ${heroConfig.pointsColor}`}>
          {papan_apresiasi.total_points}
        </h3>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Total Poin</p>

        {/* Separator */}
        <div className="w-8 h-[2px] bg-slate-200 rounded-full mt-3 mb-1.5" />

        <p className="text-[9px] font-bold text-slate-400">
          Perolehan Mingguan — Pekan {papan_apresiasi.week_number || "—"}
        </p>
      </div>

      {/* ============================================ */}
      {/* 2. RINCIAN POIN ASPEK                        */}
      {/* ============================================ */}
      {papan_apresiasi.aspects && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Rincian Poin Aspek</p>
          {aspect_settings && aspect_settings.length > 0 ? (
            aspect_settings
              .filter(a => a.is_active === 1)
              .map((aspect) => (
                <DiscretePointsRow
                  key={aspect.aspect_key}
                  aspectLabel={aspect.label}
                  pointsEarned={(papan_apresiasi.aspects as any)[aspect.aspect_key] || 0}
                  icon={resolveAspectIcon(aspect.icon_name)}
                />
              ))
          ) : (
            <>
              <DiscretePointsRow aspectLabel="Ketepatan Waktu (WKT)" pointsEarned={papan_apresiasi.aspects.wkt_point} icon={Clock} />
              <DiscretePointsRow aspectLabel="Sikap & Perilaku (SKP)" pointsEarned={papan_apresiasi.aspects.skp_point} icon={Smile} />
              <DiscretePointsRow aspectLabel="Hasil Kerja (HAS)" pointsEarned={papan_apresiasi.aspects.has_point} icon={CheckSquare} />
              <DiscretePointsRow aspectLabel="Kerapian Kerja (KER)" pointsEarned={papan_apresiasi.aspects.ker_point} icon={User} />
              <DiscretePointsRow aspectLabel="Inisiatif Kerja (INI)" pointsEarned={papan_apresiasi.aspects.ini_point} icon={Sparkles} />
            </>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* 3. FEEDBACK DARI ATASAN                      */}
      {/* ============================================ */}
      {(papan_apresiasi.feedback?.comments || (papan_apresiasi.feedback?.tags && papan_apresiasi.feedback.tags.length > 0)) && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
            <BookOpen size={12} className="text-slate-400" />
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Feedback Dari Atasan</p>
          </div>

          {/* Tags */}
          {papan_apresiasi.feedback!.tags && papan_apresiasi.feedback!.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {papan_apresiasi.feedback!.tags.map((tag: string, idx: number) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded"
                >
                  <Award size={9} className="text-slate-400" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Comments */}
          {papan_apresiasi.feedback!.comments && (
            <p className="text-[11px] text-slate-600 font-medium italic leading-relaxed">
              &ldquo;{papan_apresiasi.feedback!.comments}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
};
