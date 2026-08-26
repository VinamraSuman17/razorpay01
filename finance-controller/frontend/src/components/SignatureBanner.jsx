import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

export function SignatureBanner({ summary }) {
  const matchRate = summary?.match_rate_percent ?? 0;
  const totalRecords = summary?.total_bank_settlements ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-[#0F172A] text-[#FAFAFA] p-6 mb-6 border-2 border-[#1E3A8A] shadow-[5px_5px_0px_0px_#0F172A] rounded-none"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-[#1D4ED8] text-white border-2 border-[#2563EB]">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-[#FAFAFA] uppercase">
              AI Autonomous Reconciliation Core
            </h2>
            <span className="px-3 py-1 text-xs font-extrabold uppercase bg-[#1D4ED8] text-white border border-[#2563EB] shadow-[2px_2px_0px_0px_#0F172A]">
              Production v1.0 Active
            </span>
          </div>
          <p className="text-xs text-blue-200/80 max-w-2xl font-medium leading-relaxed">
            Multi-stage pipeline executing 4-phase deterministic SQL rules, RapidFuzz candidate shortlisting, and Gemini LLM verification with SHA256 disk caching.
          </p>
        </div>

        <div className="flex items-center space-x-6 bg-[#1E293B] border-2 border-[#1E3A8A] px-6 py-4 shadow-[3px_3px_0px_0px_#0F172A] shrink-0">
          <div className="text-center">
            <span className="block text-[10px] uppercase font-extrabold tracking-wider text-blue-300">Match Coverage</span>
            <span className="text-3xl font-black font-mono tabular-nums text-[#FAFAFA]">{matchRate}%</span>
          </div>
          <div className="h-10 w-0.5 bg-[#1E3A8A]" />
          <div className="text-center">
            <span className="block text-[10px] uppercase font-extrabold tracking-wider text-blue-300">Total Audited</span>
            <span className="text-3xl font-black font-mono tabular-nums text-[#FAFAFA]">{totalRecords}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
