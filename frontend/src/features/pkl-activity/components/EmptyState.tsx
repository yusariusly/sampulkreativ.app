/**
 * @file components/EmptyState.tsx
 * @description Component for displaying a clean empty state with a Lucide icon, title, and description.
 */

import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-dashed border-gray-200 text-center select-none shadow-xs">
      <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
        <Icon className="text-gray-400" size={24} />
      </div>
      <h3 className="text-sm font-bold text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-400 max-w-[240px] leading-normal">{description}</p>
    </div>
  );
};
export default EmptyState;
