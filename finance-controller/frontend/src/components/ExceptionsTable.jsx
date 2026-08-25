import React from 'react';
import { motion } from 'framer-motion';

export function ExceptionsTable({ exceptions }) {
  const priorityBadges = {
    HIGH: 'bg-[#18181B] text-[#FAFAFA] border-1.5 border-[#18181B] shadow-[1.5px_1.5px_0px_0px_#18181B] font-black',
    MEDIUM: 'bg-zinc-600 text-[#FAFAFA] border-1.5 border-[#18181B] shadow-[1.5px_1.5px_0px_0px_#18181B] font-bold',
    LOW: 'bg-zinc-200 text-[#18181B] border-1.5 border-[#18181B] shadow-[1.5px_1.5px_0px_0px_#18181B] font-bold'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-[#FAFAFA] border-2 border-[#18181B] shadow-[4px_4px_0px_0px_#18181B] mb-6 overflow-hidden rounded-none"
    >
      <div className="p-6 border-b-2 border-[#18181B]">
        <h3 className="text-lg font-black uppercase text-[#18181B]">Operational Exceptions Queue</h3>
        <p className="text-xs font-medium text-zinc-600 mt-1">Unmatched settlements and ledger items requiring manual review or automated action</p>
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#18181B] text-[#FAFAFA] border-b-2 border-[#18181B] sticky top-0 uppercase tracking-wider font-black text-xs">
            <tr>
              <th className="py-3.5 px-6">Record ID</th>
              <th className="py-3.5 px-6">Source</th>
              <th className="py-3.5 px-6">Priority</th>
              <th className="py-3.5 px-6">Category</th>
              <th className="py-3.5 px-6">Reason & Context</th>
              <th className="py-3.5 px-6">Suggested Resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-[#18181B]/10 text-[#18181B]">
            {exceptions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center font-bold text-zinc-500">
                  No operational exceptions present.
                </td>
              </tr>
            ) : (
              exceptions.map((exc, idx) => (
                <tr
                  key={idx}
                  className={`transition-colors hover:bg-zinc-200/60 ${
                    idx % 2 === 1 ? 'bg-zinc-100/70' : 'bg-[#FAFAFA]'
                  }`}
                >
                  <td className="py-3.5 px-6 font-mono tabular-nums font-black text-[#18181B]">{exc.record_id}</td>
                  <td className="py-3.5 px-6 font-mono tabular-nums capitalize text-zinc-600 font-bold">{(exc?.source || '').replace(/_/g, ' ')}</td>
                  <td className="py-3.5 px-6 font-mono">
                    <span className={`inline-block px-2.5 py-0.5 text-[10px] uppercase ${priorityBadges[exc?.priority] || priorityBadges.LOW}`}>
                      {exc?.priority}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 font-mono font-extrabold text-[#18181B] uppercase">
                    {(exc?.category || '').replace(/_/g, ' ')}
                  </td>
                  <td className="py-3.5 px-6 text-zinc-800 font-medium max-w-sm leading-relaxed">{exc.reason}</td>
                  <td className="py-3.5 px-6 text-[#18181B] font-extrabold max-w-xs leading-relaxed underline underline-offset-2">{exc.suggested_action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
