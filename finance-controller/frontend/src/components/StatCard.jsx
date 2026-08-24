import React from 'react';
import { motion } from 'framer-motion';

export function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const borderColors = {
    blue: 'border-l-4 border-l-[#2563EB]',
    green: 'border-l-4 border-l-[#16A34A]',
    amber: 'border-l-4 border-l-[#D97706]',
    red: 'border-l-4 border-l-[#DC2626]',
    navy: 'border-l-4 border-l-[#0B1F3A]'
  };

  const iconBg = {
    blue: 'bg-blue-50 text-[#2563EB]',
    green: 'bg-green-50 text-[#16A34A]',
    amber: 'bg-amber-50 text-[#D97706]',
    red: 'bg-red-50 text-[#DC2626]',
    navy: 'bg-slate-100 text-[#0B1F3A]'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-white rounded-xl shadow-xs p-5 ${borderColors[color]} hover:shadow-md transition-all border border-slate-100`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconBg[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-3xl font-bold font-mono-tabular tracking-tight text-[#0B1F3A]">{value}</span>
        {trend && <span className="text-xs font-medium text-slate-500">{trend}</span>}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </motion.div>
  );
}
