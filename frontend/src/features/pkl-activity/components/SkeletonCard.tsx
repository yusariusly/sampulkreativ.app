/**
 * @file components/SkeletonCard.tsx
 * @description Renders a shimmer layout representing a card that is loading.
 */

import React from "react";

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs animate-pulse space-y-4">
      {/* Skeleton header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded-md w-1/3" />
          <div className="h-3 bg-gray-200 rounded-md w-1/2" />
        </div>
      </div>

      {/* Skeleton body lines */}
      <div className="space-y-2.5 pt-2">
        <div className="h-3.5 bg-gray-200 rounded-md w-full" />
        <div className="h-3.5 bg-gray-200 rounded-md w-5/6" />
        <div className="h-3.5 bg-gray-200 rounded-md w-3/4" />
      </div>

      {/* Skeleton footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="h-6 bg-gray-200 rounded-full w-16" />
        <div className="h-6 bg-gray-200 rounded-full w-24" />
      </div>
    </div>
  );
};
export default SkeletonCard;
