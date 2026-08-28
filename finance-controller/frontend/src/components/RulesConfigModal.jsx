import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, RefreshCw, CheckCircle2, Shield, Percent, Sliders } from 'lucide-react';

export function RulesConfigModal({ isOpen, onClose, feeRate, setFeeRate, gstRate, setGstRate, tolerance, setTolerance, onApply }) {
  const [tempFee, setTempFee] = useState(feeRate);
  const [tempGst, setTempGst] = useState(gstRate);
  const [tempTol, setTempTol] = useState(tolerance);
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsApplying(true);
    setFeeRate(tempFee);
    setGstRate(tempGst);
    setTolerance(tempTol);
    await onApply(tempFee, tempGst, tempTol);
    setIsApplying(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white border-4 border-[#0F172A] shadow-[8px_8px_0px_0px_#0F172A] max-w-lg w-full p-6 space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-[#0F172A] pb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-[#1E3A8A] text-white border border-[#0F172A]">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase text-[#0F172A] tracking-tight">
                  Rules & Rates Config Studio
                </h3>
                <span className="text-[10px] text-slate-500 font-mono font-bold block">
                  Dynamic FinOps Audit & Math Rules Parameter Switcher
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-200">
              <X className="w-5 h-5 text-[#0F172A]" />
            </button>
          </div>

          {/* Form Controls */}
          <div className="space-y-4 font-mono">
            {/* MDR Fee Rate */}
            <div className="bg-slate-50 border-2 border-[#CBD5E1] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-[#0F172A] flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-[#1E3A8A]" /> Platform MDR Payout Fee Rate
                </label>
                <span className="text-xs font-black text-[#1E3A8A] bg-blue-100 px-2 py-0.5 border border-blue-300">
                  {tempFee}%
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={tempFee}
                onChange={(e) => setTempFee(Number(e.target.value))}
                className="w-full accent-[#1E3A8A] cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                Standard Gateway Contract Fee (Default: 2.0%, Editable: 0.5% - 5.0%)
              </span>
            </div>

            {/* Statutory GST Rate */}
            <div className="bg-slate-50 border-2 border-[#CBD5E1] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-[#0F172A] flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-700" /> Statutory GST Rate
                </label>
                <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 border border-emerald-300">
                  {tempGst}%
                </span>
              </div>
              <select
                value={tempGst}
                onChange={(e) => setTempGst(Number(e.target.value))}
                className="w-full text-xs font-black p-2 border-2 border-[#0F172A] bg-white cursor-pointer"
              >
                <option value={18.0}>18.0% (Standard Services / IT Invoice GST)</option>
                <option value={12.0}>12.0% (Concessional Goods & Services)</option>
                <option value={5.0}>5.0% (Essential Goods / Transport Rate)</option>
                <option value={0.0}>0.0% (Exempted / Export Supplies)</option>
              </select>
              <span className="text-[10px] text-slate-500 block">
                Invoice statutory tax rate applied across audited line items.
              </span>
            </div>

            {/* Matching Tolerance */}
            <div className="bg-slate-50 border-2 border-[#CBD5E1] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-[#0F172A] flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-700" /> Statutory Tolerance Window
                </label>
                <span className="text-xs font-black text-amber-800 bg-amber-100 px-2 py-0.5 border border-amber-300">
                  {tempTol}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={tempTol}
                onChange={(e) => setTempTol(Number(e.target.value))}
                className="w-full accent-amber-700 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                Maximum allowable variance ratio before flagging tax leakage.
              </span>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-[10px] text-slate-500 font-mono font-bold">
              Real-Time Dynamic Recalculation Engine
            </span>
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 text-[#0F172A] text-xs font-black uppercase border border-slate-400 hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isApplying}
                className="px-4 py-2 bg-[#1E3A8A] text-white text-xs font-black uppercase border-2 border-[#0F172A] hover:bg-[#2563EB] transition-all flex items-center gap-1.5 shadow-[2px_2px_0px_0px_#0F172A]"
              >
                {isApplying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recalculating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Apply & Recalculate ⚡
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
