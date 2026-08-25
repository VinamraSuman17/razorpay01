import React from 'react';
import { motion } from 'framer-motion';

export function ExceptionsTable({ exceptions }) {
  const priorityBadges = {
    HIGH: 'bg-[#DC2626]/15 text-[#DC2626]',
    MEDIUM: 'bg-[#D97706]/15 text-[#D97706]',
    LOW: 'bg-slate-100 text-slate-700'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-white rounded-xl border border-slate-200 shadow-xs mb-6 overflow-hidden"
    >
      <div className="p-6 border-b border-slate-200">
        <h3 className="text-base font-semibold text-[#0B1F3A]">Operational Exceptions Queue</h3>
        <p className="text-xs text-slate-500 mt-1">Unmatched settlements and ledger items requiring manual review or automated action</p>
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#0B1F3A] text-white sticky top-0 uppercase tracking-wider font-medium text-[11px]">
            <tr>
              <th className="py-3 px-6">Record ID</th>
              <th className="py-3 px-6">Source</th>
              <th className="py-3 px-6">Priority</th>
              <th className="py-3 px-6">Category</th>
              <th className="py-3 px-6">Reason & Context</th>
              <th className="py-3 px-6">Suggested Resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {exceptions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No operational exceptions present.
                </td>
              </tr>
            ) : (
              exceptions.map((exc, idx) => (
                <tr
                  key={idx}
                  className={`transition-colors hover:bg-slate-100/60 ${
                    idx % 2 === 1 ? 'bg-[#F7F8FA]' : 'bg-white'
                  }`}
                >
                  <td className="py-3 px-6 font-mono tabular-nums font-semibold text-[#0B1F3A]">{exc.record_id}</td>
                  <td className="py-3 px-6 font-mono tabular-nums capitalize text-slate-500">{(exc?.source || '').replace(/_/g, ' ')}</td>
                  <td className="py-3 px-6 font-mono">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full font-semibold text-[10px] uppercase ${priorityBadges[exc?.priority] || priorityBadges.LOW}`}>
                      {exc?.priority}
                    </span>
                  </td>
                  <td className="py-3 px-6 font-mono font-medium text-slate-800">
                    {(exc?.category || '').replace(/_/g, ' ')}
                  </td>
                  <td className="py-3 px-6 text-slate-600 max-w-sm leading-relaxed">{exc.reason}</td>
                  <td className="py-3 px-6 text-[#2563EB] font-medium max-w-xs leading-relaxed">{exc.suggested_action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
