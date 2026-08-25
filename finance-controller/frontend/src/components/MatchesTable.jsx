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
      className="bg-white rounded-xl border border-slate-200 shadow-xs mb-6 overflow-hidden"
    >
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-[#0B1F3A]">Reconciled Matches Audit Log</h3>
          <p className="text-xs text-slate-500 mt-1">Verified settlement-to-order pairings with rule provenance</p>
        </div>
        <input
          type="text"
          placeholder="Filter by Settlement, Order, or Rule..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#2563EB] w-full sm:w-64"
        />
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#0B1F3A] text-white sticky top-0 uppercase tracking-wider font-medium text-[11px]">
            <tr>
              <th className="py-3 px-6">Settlement ID</th>
              <th className="py-3 px-6">Matched Order ID</th>
              <th className="py-3 px-6">Rule Applied</th>
              <th className="py-3 px-6">Confidence</th>
              <th className="py-3 px-6">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredMatches.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No matched records found. Click "Run Batch Reconciliation" to process dataset.
                </td>
              </tr>
            ) : (
              filteredMatches.map((m, idx) => (
                <tr
                  key={idx}
                  className={`transition-colors hover:bg-slate-100/60 ${
                    idx % 2 === 1 ? 'bg-[#F7F8FA]' : 'bg-white'
                  }`}
                >
                  <td className="py-3 px-6 font-mono tabular-nums font-semibold text-[#0B1F3A]">{m.settlement_id}</td>
                  <td className="py-3 px-6 font-mono tabular-nums text-[#2563EB] font-medium">{m.order_id}</td>
                  <td className="py-3 px-6 font-mono text-slate-600">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px]">
                      {m.rule_applied}
                    </span>
                  </td>
                  <td className="py-3 px-6 font-mono tabular-nums">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        m.confidence >= 0.95
                          ? 'bg-[#16A34A]/15 text-[#16A34A]'
                          : 'bg-[#D97706]/15 text-[#D97706]'
                      }`}
                    >
                      {(m.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-3 px-6 font-mono tabular-nums text-slate-500 text-[11px]">{m.timestamp}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
