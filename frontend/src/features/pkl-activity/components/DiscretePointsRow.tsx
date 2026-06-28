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
  const maxPoints = 5;
  const clampedPoints = Math.max(0, Math.min(maxPoints, pointsEarned));

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center gap-2 text-slate-700">
        <Icon size={14} className="text-slate-400 flex-shrink-0 stroke-[2.2px]" />
        <span className="text-xs font-semibold text-slate-650">{aspectLabel}</span>
      </div>
      <div className="flex items-center gap-1" aria-label={`Poin: ${clampedPoints} dari ${maxPoints}`}>
        {Array.from({ length: maxPoints }).map((_, index) => {
          const isActive = index < clampedPoints;
          return (
            <span
              key={index}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                isActive ? "bg-amber-400 shadow-3xs" : "bg-slate-200/80"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};
