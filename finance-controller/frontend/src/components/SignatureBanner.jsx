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
      className="bg-[#18181B] text-[#FAFAFA] p-6 mb-6 border-2 border-[#18181B] shadow-[5px_5px_0px_0px_#18181B] rounded-none"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-[#FAFAFA] text-[#18181B] border-2 border-[#FAFAFA]">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-[#FAFAFA] uppercase">
              AI Autonomous Reconciliation Core
            </h2>
            <span className="px-3 py-1 text-xs font-extrabold uppercase bg-[#FAFAFA] text-[#18181B] border-2 border-[#FAFAFA] shadow-[2px_2px_0px_0px_rgba(250,250,250,0.3)]">
              Production v1.0 Active
            </span>
          </div>
          <p className="text-xs text-zinc-300 max-w-2xl font-medium leading-relaxed">
            Multi-stage pipeline executing 4-phase deterministic SQL rules, RapidFuzz candidate shortlisting, and Gemini LLM verification with SHA256 disk caching.
          </p>
        </div>

        <div className="flex items-center space-x-6 bg-zinc-900 border-2 border-[#FAFAFA] px-6 py-4 shadow-[3px_3px_0px_0px_rgba(250,250,250,0.25)] shrink-0">
          <div className="text-center">
            <span className="block text-[10px] uppercase font-extrabold tracking-wider text-zinc-400">Match Coverage</span>
            <span className="text-3xl font-black font-mono tabular-nums text-[#FAFAFA]">{matchRate}%</span>
          </div>
          <div className="h-10 w-0.5 bg-zinc-700" />
          <div className="text-center">
            <span className="block text-[10px] uppercase font-extrabold tracking-wider text-zinc-400">Total Audited</span>
            <span className="text-3xl font-black font-mono tabular-nums text-[#FAFAFA]">{totalRecords}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
