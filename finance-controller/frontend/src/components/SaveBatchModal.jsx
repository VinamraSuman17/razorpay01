import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function SaveBatchModal({ isOpen, onClose, onSave, savedBatchInfo, isSaving }) {
  const [batchName, setBatchName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!batchName.trim()) {
      setErrorMsg('Please enter a valid batch name.');
      return;
    }
    setErrorMsg('');
    onSave(batchName.trim());
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#FAFAFA] border-2 border-[#1E3A8A] shadow-[6px_6px_0px_0px_#0F172A] w-full max-w-md p-6 font-mono text-xs text-[#0F172A]"
        >
          <div className="flex items-center justify-between border-b-2 border-[#1E3A8A] pb-3 mb-4">
            <h3 className="text-sm font-black uppercase text-[#0F172A] flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#1D4ED8]" />
              Save Operational Batch Snapshot
            </h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-200 text-slate-700 font-black cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-blue-50 border-2 border-blue-400 text-blue-950 text-[11px] font-bold flex items-start gap-2">
              <Bookmark className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block uppercase text-blue-900">Multi-Batch Snapshot Storage:</span>
                This will save a new snapshot to your DuckDB history list. Existing saved snapshots remain preserved.
                {savedBatchInfo?.count !== undefined && (
                  <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                    Current storage: {savedBatchInfo.count} / {savedBatchInfo.capacity_limit || 10} snapshots saved.
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase text-slate-700 mb-1">
                Batch Snapshot Name:
              </label>
              <input
                type="text"
                placeholder="e.g. August Month-End Reconciliation"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                autoFocus
                className="w-full p-2.5 text-xs font-mono font-bold bg-white border-2 border-[#1E3A8A] shadow-[2px_2px_0px_0px_#0F172A] focus:outline-none focus:bg-blue-50 placeholder:text-slate-400"
              />
              {errorMsg && (
                <p className="text-rose-600 font-bold text-[10px] mt-1">{errorMsg}</p>
              )}
            </div>

            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              📌 This saves all reconciled matches, unmatched exceptions queue, analyst notes, and human review flags into DuckDB.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase border border-slate-400 shadow-[1.5px_1.5px_0px_0px_#0F172A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-[#1D4ED8] hover:bg-[#2563EB] text-white text-xs font-black uppercase border-2 border-[#0F172A] shadow-[2px_2px_0px_0px_#0F172A] cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving ? (
                  <span>Saving to DB...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Snapshot</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
