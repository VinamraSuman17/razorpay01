import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

export function SignatureBanner({ summary }) {
  const matchRate = summary?.match_rate_percent ?? 0;
  const totalRecords = summary?.total_bank_settlements ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-xl bg-[#0B1F3A] p-6 text-white mb-6 border border-slate-800 shadow-xs"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
            <h2 className="text-base font-semibold tracking-tight text-white">AI Autonomous Reconciliation Engine</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/30">
              Active Production Engine
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Multi-stage pipeline executing 4-phase deterministic SQL rules, RapidFuzz candidate shortlisting, and Gemini LLM verification with SHA256 disk caching.
          </p>
        </div>

        <div className="flex items-center space-x-6 bg-slate-900/80 px-6 py-3 rounded-lg border border-slate-800 shrink-0">
          <div className="text-center">
            <span className="block text-xs uppercase tracking-wider text-slate-400 font-medium">Match Coverage</span>
            <span className="text-2xl font-bold font-mono tabular-nums text-[#16A34A]">{matchRate}%</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-center">
            <span className="block text-xs uppercase tracking-wider text-slate-400 font-medium">Total Audited</span>
            <span className="text-2xl font-bold font-mono tabular-nums text-white">{totalRecords}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
