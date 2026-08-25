import React from 'react';
import { motion } from 'framer-motion';
import { DonutChart } from './DonutChart';
import { ExceptionBarChart } from './ExceptionBarChart';
import { AccuracyComparisonChart } from './AccuracyComparisonChart';

export function DashboardCharts({ matchesCount, exceptionsCount, needsReviewCount, exceptionsList, summary }) {
  const donutData = [
    { label: 'Auto-Matched', value: matchesCount, color: '#000000' },
    { label: 'Needs Review', value: needsReviewCount, color: '#71717A' },
    { label: 'Exceptions', value: exceptionsCount, color: '#E4E4E7' }
  ];

  const totalRecords = summary?.total_bank_settlements || (matchesCount + needsReviewCount + exceptionsCount);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      {/* 1. Visx Donut Chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
        className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between rounded-none"
      >
        <div>
          <h3 className="text-sm font-black uppercase text-black">Reconciliation Breakdown</h3>
          <p className="text-xs font-medium text-zinc-600 mb-4">Auto-Matched vs Needs Review vs Exceptions</p>
        </div>
        <div className="h-52 w-full">
          <DonutChart
            matchesCount={matchesCount}
            needsReviewCount={needsReviewCount}
            exceptionsCount={exceptionsCount}
          />
        </div>
        <div className="pt-3 border-t-2 border-black mt-3">
          <div className="flex justify-center space-x-3 text-xs font-bold text-black mb-2">
            {donutData.map((d, i) => (
              <div key={i} className="flex items-center space-x-1.5 px-2 py-0.5 border-1.5 border-black bg-zinc-100 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                <span className="w-2.5 h-2.5 border border-black" style={{ backgroundColor: d.color }} />
                <span className="text-[11px] uppercase font-extrabold">{d.label}: <strong className="font-mono tabular-nums text-black font-black">{d.value}</strong></span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 text-center font-mono font-bold">
            Based on completed run — {totalRecords} settlements
          </p>
        </div>
      </motion.div>

      {/* 2. Visx Exception Categories Horizontal Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
        className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between rounded-none"
      >
        <div>
          <h3 className="text-sm font-black uppercase text-black">Exceptions by Category</h3>
          <p className="text-xs font-medium text-zinc-600 mb-4">Sorted by frequency count descending</p>
        </div>
        <div className="h-52 w-full">
          <ExceptionBarChart exceptionsList={exceptionsList} />
        </div>
        <div className="pt-3 border-t-2 border-black mt-3">
          <p className="text-[11px] text-zinc-600 text-center font-mono font-bold">
            Operational exceptions by root cause classification
          </p>
        </div>
      </motion.div>

      {/* 3. Visx Baseline vs Full Pipeline Accuracy Comparison Chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
        className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between rounded-none"
      >
        <div>
          <h3 className="text-sm font-black uppercase text-black">Accuracy & Coverage (%)</h3>
          <p className="text-xs font-medium text-zinc-600 mb-4">Deterministic Rules vs Full AI Pipeline</p>
        </div>
        <div className="h-52 w-full">
          <AccuracyComparisonChart summary={summary} />
        </div>
        <div className="pt-3 border-t-2 border-black mt-3">
          <p className="text-[11px] text-zinc-600 text-center font-mono font-bold">
            Deterministic rules vs multi-stage Gemini LLM pipeline
          </p>
        </div>
      </motion.div>
    </div>
  );
}
