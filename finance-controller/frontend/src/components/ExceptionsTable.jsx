import React from 'react';

export function ExceptionsTable({ exceptions }) {
  const priorityBadges = {
    HIGH: 'bg-red-100 text-[#DC2626] border border-red-200',
    MEDIUM: 'bg-amber-100 text-[#D97706] border border-amber-200',
    LOW: 'bg-slate-100 text-slate-700 border border-slate-200'
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs mb-6 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-base font-bold text-[#0B1F3A]">Operational Exceptions Queue</h3>
        <p className="text-xs text-slate-500">Unmatched settlements and ledger items requiring manual review or automated action</p>
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#0B1F3A] text-white sticky top-0 uppercase tracking-wider font-semibold">
            <tr>
              <th className="py-2.5 px-4">Record ID</th>
              <th className="py-2.5 px-4">Source</th>
              <th className="py-2.5 px-4">Priority</th>
              <th className="py-2.5 px-4">Category</th>
              <th className="py-2.5 px-4">Reason & Context</th>
              <th className="py-2.5 px-4">Suggested Resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {exceptions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No operational exceptions present.
                </td>
              </tr>
            ) : (
              exceptions.map((exc, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-mono-tabular font-bold text-[#0B1F3A]">{exc.record_id}</td>
                  <td className="py-2.5 px-4 font-mono-tabular capitalize text-slate-500">{exc.source.replace('_', ' ')}</td>
                  <td className="py-2.5 px-4 font-mono-tabular">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${priorityBadges[exc.priority] || priorityBadges.LOW}`}>
                      {exc.priority}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono-tabular font-semibold text-slate-800">
                    {exc.category.replace('_', ' ')}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 max-w-sm leading-snug">{exc.reason}</td>
                  <td className="py-2.5 px-4 text-blue-700 font-medium max-w-xs leading-snug">{exc.suggested_action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
