import React, { useState } from 'react';

export function MatchesTable({ matches }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMatches = (matches || []).filter(m =>
    (m?.settlement_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m?.order_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m?.rule_applied || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs mb-6 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[#0B1F3A]">Reconciled Matches Audit Log</h3>
          <p className="text-xs text-slate-500">Verified settlement-to-order pairings with confidence scores</p>
        </div>
        <input
          type="text"
          placeholder="Filter by Settlement, Order, or Rule..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] w-64"
        />
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#0B1F3A] text-white sticky top-0 uppercase tracking-wider font-semibold">
            <tr>
              <th className="py-2.5 px-4">Settlement ID</th>
              <th className="py-2.5 px-4">Matched Order ID</th>
              <th className="py-2.5 px-4">Rule Applied</th>
              <th className="py-2.5 px-4">Confidence</th>
              <th className="py-2.5 px-4">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredMatches.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No matched records found. Click "Run Batch Reconciliation" to process dataset.
                </td>
              </tr>
            ) : (
              filteredMatches.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-mono-tabular font-bold text-[#0B1F3A]">{m.settlement_id}</td>
                  <td className="py-2.5 px-4 font-mono-tabular font-medium text-blue-700">{m.order_id}</td>
                  <td className="py-2.5 px-4 font-mono-tabular text-slate-600">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                      {m.rule_applied}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono-tabular">
                    <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                      m.confidence >= 0.95 ? 'bg-emerald-100 text-[#16A34A]' : 'bg-amber-100 text-[#D97706]'
                    }`}>
                      {(m.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono-tabular text-slate-500 text-[11px]">{m.timestamp}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
