import React from 'react';
import { motion } from 'framer-motion';
import { DonutChart } from './DonutChart';
import { ExceptionBarChart } from './ExceptionBarChart';
import { AccuracyComparisonChart } from './AccuracyComparisonChart';

export function DashboardCharts({ matchesCount, exceptionsCount, needsReviewCount, exceptionsList, summary }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      {/* Donut Chart Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="bg-[#FAFAFA] border-2 border-[#18181B] shadow-[4px_4px_0px_0px_#18181B] p-6 rounded-none flex flex-col justify-between"
      >
        <div>
          <h3 className="text-sm font-black uppercase text-[#18181B] tracking-wider">
            Reconciliation Breakdown
          </h3>
          <p className="text-xs text-zinc-600 font-medium mt-1">
            Status distribution of processed records
          </p>
        </div>

        <div className="h-56 w-full my-4">
          <DonutChart
            matchesCount={matchesCount}
            needsReviewCount={needsReviewCount}
            exceptionsCount={exceptionsCount}
          />
        </div>

        <div className="pt-3 border-t-2 border-[#18181B]/10 grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="block text-[10px] uppercase font-extrabold text-zinc-500">Auto-Match</span>
            <span className="text-sm font-mono font-black text-[#18181B]">{matchesCount}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-extrabold text-zinc-500">Needs Rev</span>
            <span className="text-sm font-mono font-black text-[#18181B]">{needsReviewCount}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-extrabold text-zinc-500">Exceptions</span>
            <span className="text-sm font-mono font-black text-[#18181B]">{exceptionsCount}</span>
          </div>
        </div>
      </motion.div>

      {/* Exception Categories Bar Chart Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.08 }}
        className="bg-[#FAFAFA] border-2 border-[#18181B] shadow-[4px_4px_0px_0px_#18181B] p-6 rounded-none flex flex-col justify-between"
      >
        <div>
          <h3 className="text-sm font-black uppercase text-[#18181B] tracking-wider">
            Exception Categories
          </h3>
          <p className="text-xs text-zinc-600 font-medium mt-1">
            Root-cause volume breakdown across operations
          </p>
        </div>

        <div className="h-56 w-full my-4">
          <ExceptionBarChart exceptionsList={exceptionsList} />
        </div>

        <div className="pt-3 border-t-2 border-[#18181B]/10 flex items-center justify-between text-xs font-bold text-zinc-600">
          <span>Active Issues:</span>
          <span className="font-mono font-black text-[#18181B]">{exceptionsList.length} items</span>
        </div>
      </motion.div>

      {/* Accuracy Comparison Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.16 }}
        className="bg-[#FAFAFA] border-2 border-[#18181B] shadow-[4px_4px_0px_0px_#18181B] p-6 rounded-none flex flex-col justify-between"
      >
        <div>
          <h3 className="text-sm font-black uppercase text-[#18181B] tracking-wider">
            Rules vs AI Pipeline Lift
          </h3>
          <p className="text-xs text-zinc-600 font-medium mt-1">
            Accuracy comparison against legacy rule engine
          </p>
        </div>

        <div className="h-56 w-full my-4">
          <AccuracyComparisonChart summary={summary} />
        </div>

        <div className="pt-3 border-t-2 border-[#18181B]/10 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-zinc-400 border border-[#18181B]" />
            <span className="font-bold text-zinc-600 text-[10px] uppercase">Plain Rules</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-[#18181B] border border-[#18181B]" />
            <span className="font-black text-[#18181B] text-[10px] uppercase">Full AI Pipeline</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
