import React, { useState } from 'react';
import { motion } from 'framer-motion';

export function MatchesTable({ matches }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMatches = (matches || []).filter(m =>
    (m?.settlement_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m?.order_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m?.rule_applied || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-[#FAFAFA] border-2 border-[#18181B] shadow-[4px_4px_0px_0px_#18181B] mb-6 overflow-hidden rounded-none"
    >
      <div className="p-6 border-b-2 border-[#18181B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black uppercase text-[#18181B]">Reconciled Matches Audit Log</h3>
          <p className="text-xs font-medium text-zinc-600 mt-1">Verified settlement-to-order pairings with rule provenance</p>
        </div>
        <input
          type="text"
          placeholder="Search Settlement, Order, or Rule..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 text-xs font-mono font-bold text-[#18181B] border-2 border-[#18181B] shadow-[2px_2px_0px_0px_#18181B] focus:outline-none focus:bg-zinc-100 w-full sm:w-72"
        />
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#18181B] text-[#FAFAFA] border-b-2 border-[#18181B] sticky top-0 uppercase tracking-wider font-black text-xs">
            <tr>
              <th className="py-3.5 px-6">Settlement ID</th>
              <th className="py-3.5 px-6">Matched Order ID</th>
              <th className="py-3.5 px-6">Rule Applied</th>
              <th className="py-3.5 px-6">Confidence</th>
              <th className="py-3.5 px-6">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-[#18181B]/10 text-[#18181B]">
            {filteredMatches.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center font-bold text-zinc-500">
                  No matched records found. Click "Run Batch Reconciliation" to process dataset.
                </td>
              </tr>
            ) : (
              filteredMatches.map((m, idx) => (
                <tr
                  key={idx}
                  className={`transition-colors hover:bg-zinc-200/60 ${
                    idx % 2 === 1 ? 'bg-zinc-100/70' : 'bg-[#FAFAFA]'
                  }`}
                >
                  <td className="py-3.5 px-6 font-mono tabular-nums font-black text-[#18181B]">{m.settlement_id}</td>
                  <td className="py-3.5 px-6 font-mono tabular-nums font-extrabold text-[#18181B] underline underline-offset-2">{m.order_id}</td>
                  <td className="py-3.5 px-6 font-mono">
                    <span className="px-2.5 py-1 text-[11px] font-black uppercase bg-zinc-200 text-[#18181B] border-1.5 border-[#18181B] shadow-[1.5px_1.5px_0px_0px_#18181B]">
                      {m.rule_applied}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 font-mono tabular-nums">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-xs font-black border-1.5 border-[#18181B] shadow-[1.5px_1.5px_0px_0px_#18181B] ${
                        m.confidence >= 0.95
                          ? 'bg-[#18181B] text-[#FAFAFA]'
                          : 'bg-zinc-300 text-[#18181B]'
                      }`}
                    >
                      {(m.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-3.5 px-6 font-mono tabular-nums text-zinc-600 font-bold text-[11px]">{m.timestamp}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
