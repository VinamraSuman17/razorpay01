import React from 'react';
import { DonutChart } from './DonutChart';
import { ExceptionBarChart } from './ExceptionBarChart';
import { AccuracyComparisonChart } from './AccuracyComparisonChart';

export function DashboardCharts({ matchesCount, exceptionsCount, needsReviewCount, exceptionsList, summary }) {
  const donutData = [
    { label: 'Auto-Matched', value: matchesCount, color: '#16A34A' },
    { label: 'Needs Review', value: needsReviewCount, color: '#D97706' },
    { label: 'Exceptions', value: exceptionsCount, color: '#DC2626' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      {/* 1. Visx Donut Chart */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#0B1F3A]">Reconciliation Status Breakdown</h3>
          <p className="text-[11px] text-slate-400 mb-3">Auto-Matched vs Needs Review vs Exceptions</p>
        </div>
        <div className="h-52 w-full">
          <DonutChart
            matchesCount={matchesCount}
            needsReviewCount={needsReviewCount}
            exceptionsCount={exceptionsCount}
          />
        </div>
        <div className="flex justify-center space-x-4 text-xs font-medium text-slate-600 mt-3 pt-2 border-t border-slate-100">
          {donutData.map((d, i) => (
            <div key={i} className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span>{d.label}: <strong className="font-mono-tabular text-[#0B1F3A]">{d.value}</strong></span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Visx Exception Categories Horizontal Bar Chart */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#0B1F3A]">Exceptions by Operational Category</h3>
          <p className="text-[11px] text-slate-400 mb-3">Sorted by frequency count</p>
        </div>
        <div className="h-52 w-full">
          <ExceptionBarChart exceptionsList={exceptionsList} />
        </div>
      </div>

      {/* 3. Visx Baseline vs Full Pipeline Accuracy Comparison Chart */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#0B1F3A]">Accuracy & Match Coverage (%)</h3>
          <p className="text-[11px] text-slate-400 mb-3">Deterministic Rules vs Full AI Pipeline</p>
        </div>
        <div className="h-52 w-full">
          <AccuracyComparisonChart summary={summary} />
        </div>
      </div>
    </div>
  );
}
