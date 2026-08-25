import React from 'react';
import { motion } from 'framer-motion';

export function StatCard({ title, value, subtitle, icon: Icon, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: index * 0.06 }}
      className="bg-[#FAFAFA] border-2 border-[#18181B] shadow-[4px_4px_0px_0px_#18181B] p-6 rounded-none transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-[#18181B]">{title}</span>
        {Icon && (
          <div className="p-2 bg-[#18181B] text-[#FAFAFA] border-2 border-[#18181B] shadow-[2px_2px_0px_0px_rgba(24,24,27,0.3)]">
            <Icon className="w-4 h-4 stroke-[2.5]" />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-3xl font-black font-mono tabular-nums tracking-tight text-[#18181B]">{value}</span>
      </div>
      {subtitle && <p className="mt-2 text-xs font-medium text-zinc-600 border-t-2 border-[#18181B]/10 pt-2">{subtitle}</p>}
    </motion.div>
  );
}
