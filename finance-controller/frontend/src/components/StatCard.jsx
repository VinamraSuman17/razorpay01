import React from 'react';
import { motion } from 'framer-motion';

export function StatCard({ title, value, subtitle, icon: Icon, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: index * 0.06 }}
      className="bg-[#FAFAFA] border-2 border-[#1E3A8A] shadow-[4px_4px_0px_0px_#0F172A] p-6 rounded-none transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-[#0F172A]">{title}</span>
        {Icon && (
          <div className="p-2 bg-[#1D4ED8] text-white border-2 border-[#2563EB] shadow-[2px_2px_0px_0px_#0F172A]">
            <Icon className="w-4 h-4 stroke-[2.5]" />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-3xl font-black font-mono tabular-nums tracking-tight text-[#0F172A]">{value}</span>
      </div>
      {subtitle && <p className="mt-2 text-xs font-medium text-slate-600 border-t-2 border-[#1E3A8A]/15 pt-2">{subtitle}</p>}
    </motion.div>
  );
}
