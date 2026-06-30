/**
 * @file components/DiscretePointsRow.tsx
 * @description Component for rendering points as amber and gray dots for a specific aspect.
 */

import React from "react";
import { LucideIcon } from "lucide-react";

interface DiscretePointsRowProps {
  aspectLabel: string;
  pointsEarned: number;
  icon: LucideIcon;
}

export const DiscretePointsRow: React.FC<DiscretePointsRowProps> = ({
  aspectLabel,
  pointsEarned,
  icon: Icon,
}) => {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center gap-2 text-slate-700">
        <Icon size={14} className="text-slate-400 flex-shrink-0 stroke-[2.2px]" />
        <span className="text-xs font-semibold text-slate-650">{aspectLabel}</span>
      </div>
        <span className="text-[10px] font-black text-[#1C3D3F] bg-teal-50 border border-[#2AB0B2]/30 px-1.5 py-0.5 rounded shadow-3xs">
          {pointsEarned} Poin
        </span>

    </div>
  );
};
