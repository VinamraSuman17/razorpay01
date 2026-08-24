import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Cpu, Database } from 'lucide-react';

export function SignatureBanner({ matchRate, totalRecords, isRunning }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#0B1F3A] via-[#1E3A8A] to-[#0B1F3A] p-6 text-white shadow-lg mb-6 border border-slate-800">
      {/* Background Animated Pulse Glow */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.15, 0.35, 0.15]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-[#2563EB] blur-3xl pointer-events-none"
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-[#2563EB]" />
            <h2 className="text-xl font-bold tracking-tight text-white">AI Autonomous Reconciliation Core</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Active Guardrail Engine
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Multi-stage pipeline executing 4-phase deterministic rules, RapidFuzz candidate shortlisting, and Gemini LLM verification with SHA256 disk caching.
          </p>
        </div>

        <div className="flex items-center space-x-6 bg-white/10 backdrop-blur-md px-5 py-3 rounded-lg border border-white/10">
          <div className="text-center">
            <span className="block text-[10px] uppercase tracking-wider text-slate-300 font-semibold">Matched Coverage</span>
            <span className="text-2xl font-bold font-mono-tabular text-emerald-400">{matchRate}%</span>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center">
            <span className="block text-[10px] uppercase tracking-wider text-slate-300 font-semibold">Settlements Audited</span>
            <span className="text-2xl font-bold font-mono-tabular text-white">{totalRecords}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
