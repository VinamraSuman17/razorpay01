import React from 'react';
import { motion } from 'framer-motion';

export function ExceptionsTable({ exceptions }) {
  const priorityBadges = {
    HIGH: 'bg-black text-white border-1.5 border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] font-black',
    MEDIUM: 'bg-zinc-600 text-white border-1.5 border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] font-bold',
    LOW: 'bg-zinc-200 text-black border-1.5 border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] font-bold'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 overflow-hidden rounded-none"
    >
      <div className="p-6 border-b-2 border-black">
        <h3 className="text-lg font-black uppercase text-black">Operational Exceptions Queue</h3>
        <p className="text-xs font-medium text-zinc-600 mt-1">Unmatched settlements and ledger items requiring manual review or automated action</p>
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-black text-white border-b-2 border-black sticky top-0 uppercase tracking-wider font-black text-xs">
            <tr>
              <th className="py-3.5 px-6">Record ID</th>
              <th className="py-3.5 px-6">Source</th>
              <th className="py-3.5 px-6">Priority</th>
              <th className="py-3.5 px-6">Category</th>
              <th className="py-3.5 px-6">Reason & Context</th>
              <th className="py-3.5 px-6">Suggested Resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black/10 text-black">
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
                  className={`transition-colors hover:bg-zinc-100 ${
                    idx % 2 === 1 ? 'bg-zinc-50' : 'bg-white'
                  }`}
                >
                  <td className="py-3.5 px-6 font-mono tabular-nums font-black text-black">{exc.record_id}</td>
                  <td className="py-3.5 px-6 font-mono tabular-nums capitalize text-zinc-600 font-bold">{(exc?.source || '').replace(/_/g, ' ')}</td>
                  <td className="py-3.5 px-6 font-mono">
                    <span className={`inline-block px-2.5 py-0.5 text-[10px] uppercase ${priorityBadges[exc?.priority] || priorityBadges.LOW}`}>
                      {exc?.priority}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 font-mono font-extrabold text-black uppercase">
                    {(exc?.category || '').replace(/_/g, ' ')}
                  </td>
                  <td className="py-3.5 px-6 text-zinc-800 font-medium max-w-sm leading-relaxed">{exc.reason}</td>
                  <td className="py-3.5 px-6 text-black font-extrabold max-w-xs leading-relaxed underline underline-offset-2">{exc.suggested_action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
