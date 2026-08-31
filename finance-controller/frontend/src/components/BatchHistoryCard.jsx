import React from 'react';
import { motion } from 'framer-motion';
import { History, Bookmark, FolderDown, Clock, CheckCircle2, AlertCircle, Trash2, Database } from 'lucide-react';

export function BatchHistoryCard({
  hasDataset,
  savedBatchInfo,
  onOpenSaveModal,
  onLoadBatch,
  onDeleteBatch,
  isLoadingBatch,
  activeSnapshotId
}) {
  const savedBatches = savedBatchInfo?.saved_batches || [];
  const count = savedBatchInfo?.count || 0;
  const capacityLimit = savedBatchInfo?.capacity_limit || 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 bg-[#FAFAFA] border-2 border-[#1E3A8A] shadow-[5px_5px_0px_0px_#0F172A] p-5 font-mono text-xs text-[#0F172A]"
    >
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#1E3A8A] pb-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#1D4ED8] text-white border-2 border-[#0F172A] shadow-[2px_2px_0px_0px_#0F172A]">
            <History className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase text-[#0F172A] flex items-center gap-2">
              Operational Batch History & State Snapshot Manager
              <span className="text-[10px] bg-amber-200 text-amber-900 border border-amber-500 px-2 py-0.5 font-bold shadow-[1px_1px_0px_0px_#0F172A]">
                DuckDB Multi-Snapshot Engine
              </span>
            </h3>
            <p className="text-xs text-slate-600 font-medium">
              Save complete operational states (matches, exception flags, analyst notes, CFO metrics) to DuckDB history. Restores exact historical snapshots.
            </p>
          </div>
        </div>

        {/* Primary Action Button & Capacity Indicator */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          <div className="text-[11px] font-bold text-slate-700 bg-slate-200 border border-slate-400 px-2.5 py-1.5 shadow-[1.5px_1.5px_0px_0px_#0F172A] flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span>Capacity: <strong className="text-[#0F172A]">{count} / {capacityLimit} Snapshots</strong></span>
            <span className="text-[9px] bg-blue-100 text-blue-900 px-1 border border-blue-400 font-extrabold">FIFO Limit</span>
          </div>

          <button
            onClick={onOpenSaveModal}
            disabled={!hasDataset}
            className="px-4 py-2 bg-[#1D4ED8] hover:bg-[#2563EB] text-white text-xs font-black uppercase border-2 border-[#0F172A] shadow-[2.5px_2.5px_0px_0px_#0F172A] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            title={hasDataset ? "Save current active batch state to DuckDB history" : "Upload a dataset first to enable batch saving"}
          >
            <Bookmark className="w-4 h-4" />
            <span>Save Active Batch 💾</span>
          </button>
        </div>
      </div>

      {/* History Snapshots List */}
      {savedBatches.length > 0 ? (
        <div className="space-y-2">
          <div className="text-[11px] font-black uppercase text-slate-700 flex justify-between items-center px-1">
            <span>Saved Batch Snapshots ({savedBatches.length})</span>
            <span className="text-[10px] text-slate-500 font-normal italic">Click "Restore" on any snapshot to revert the dashboard to that exact state</span>
          </div>

          <div className="border-2 border-[#0F172A] bg-white divide-y-2 divide-slate-200 shadow-[3px_3px_0px_0px_#0F172A] max-h-64 overflow-y-auto">
            {savedBatches.map((snap) => {
              const isActive = activeSnapshotId === snap.id;
              return (
                <div
                  key={snap.id}
                  className={`p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                    isActive ? 'bg-emerald-50/90 font-semibold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-1.5 border border-[#0F172A] shadow-[1px_1px_0px_0px_#0F172A] ${isActive ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-900'}`}>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-[#0F172A] uppercase">{snap.name}</span>
                        {isActive && (
                          <span className="text-[9px] bg-emerald-600 text-white font-extrabold px-1.5 py-0.2 border border-emerald-800 shadow-[1px_1px_0px_0px_#0F172A]">
                            ACTIVE LOADED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-[10px] text-slate-600 mt-0.5 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Saved: <strong className="text-slate-900">{snap.saved_at}</strong>
                        </span>
                        <span>•</span>
                        <span>Volume: <strong className="text-slate-900">{snap.total_records} Records</strong></span>
                        <span>•</span>
                        <span className="text-emerald-700">Matches: {snap.matched_count || 0}</span>
                        <span>•</span>
                        <span className="text-rose-700">Exceptions: {snap.exceptions_count || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions per Row */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={() => onLoadBatch(snap.id)}
                      disabled={isLoadingBatch}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black uppercase border border-[#0F172A] shadow-[1.5px_1.5px_0px_0px_#0F172A] cursor-pointer disabled:opacity-40 flex items-center gap-1.5 transition-all"
                      title={`Restore exact historical state of "${snap.name}" (${snap.saved_at})`}
                    >
                      <FolderDown className="w-3.5 h-3.5" />
                      <span>{isLoadingBatch ? 'Restoring...' : 'Restore 📂'}</span>
                    </button>

                    <button
                      onClick={() => onDeleteBatch(snap.id)}
                      className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-400 shadow-[1.5px_1.5px_0px_0px_#0F172A] cursor-pointer transition-all"
                      title={`Delete snapshot "${snap.name}" from history`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-slate-100 border-2 border-slate-300 text-slate-600 flex items-center justify-between shadow-[1.5px_1.5px_0px_0px_#0F172A]">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-slate-500" />
            <span className="font-bold">No saved batch snapshots currently stored in DuckDB history.</span>
          </div>
          <span className="text-[10px] text-slate-500 italic">Upload a dataset and click "Save Active Batch" to create your first snapshot.</span>
        </div>
      )}
    </motion.div>
  );
}
