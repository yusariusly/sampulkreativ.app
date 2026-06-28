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
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-2 text-gray-700">
        <Icon size={16} className="text-gray-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-600">{aspectLabel}</span>
      </div>
      <div className="flex items-center gap-1.5" aria-label={`Poin: ${clampedPoints} dari ${maxPoints}`}>
        {Array.from({ length: maxPoints }).map((_, index) => {
          const isActive = index < clampedPoints;
          return (
            <span
              key={index}
              className={`w-3.5 h-3.5 rounded-full transition-colors duration-200 ${
                isActive ? "bg-amber-400 shadow-xs" : "bg-gray-200"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};
