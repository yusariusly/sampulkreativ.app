/**
 * @file components/WeeklyAccordionItem.tsx
 * @description Collapsible item for rendering historical weekly evaluations (points, tags, and comments).
 */

import React, { useState } from "react";
import { ChevronDown, Star, Award, MessageSquare } from "lucide-react";
import { StudentHistoryItem } from "../types";

interface WeeklyAccordionItemProps {
  item: StudentHistoryItem;
}

export const WeeklyAccordionItem: React.FC<WeeklyAccordionItemProps> = ({ item }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs hover:border-gray-300 transition-all mb-3 last:mb-0">
      {/* Accordion Trigger Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left select-none outline-none focus:bg-gray-50/50 cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center text-[#2AB0B2] flex-shrink-0">
            <span className="text-[10px] font-bold uppercase leading-none">Minggu</span>
            <span className="text-sm font-extrabold leading-none mt-0.5">{item.week_number}</span>
          </div>
          <div>
            <p className="text-xs font-extrabold text-gray-800">Evaluasi Mingguan</p>
            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
              Telah Dipublikasikan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Points summary badge */}
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg">
            <Star size={12} className="text-amber-500 fill-amber-500" />
            <span className="text-xs font-black text-amber-700">{item.total_points} pts</span>
          </div>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Accordion Content Panel */}
      {isOpen && (
        <div className="border-t border-gray-100 bg-gray-50/30 p-4 space-y-3 animate-slideDown">
          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div>
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Award size={11} className="text-[#2AB0B2]" /> Umpan Balik Cepat
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-slate-50 text-slate-650 border border-slate-200 rounded"
                  >
                    <Award size={10} className="text-slate-400" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Mentor Notes */}
          <div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <MessageSquare size={11} className="text-indigo-600" /> Catatan Pembimbing
            </p>
            <div className="p-3 bg-indigo-50/40 border border-indigo-100/50 rounded-xl">
              <p className="text-xs text-indigo-900 italic leading-normal">
                {item.comments || "Tidak ada catatan tertulis dari Pembimbing."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
