import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, AlertCircle, CheckCircle2, RefreshCw, Play, Terminal } from 'lucide-react';

export function BatchUploadSection({ onUploadSuccess }) {
  const [bankFile, setBankFile] = useState(null);
  const [ledgerFile, setLedgerFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [liveLogs, setLiveLogs] = useState([]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!bankFile || !ledgerFile) {
      setErrorMsg('Please select both Bank Settlements CSV and Internal Ledger CSV files.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setWarnings([]);
    setLiveLogs(['[INIT] Uploading dataset files to backend pipeline...']);

    const formData = new FormData();
    formData.append('bank_file', bankFile);
    formData.append('ledger_file', ledgerFile);

    try {
      const res = await fetch('/upload-batch', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || data?.message || `Upload failed (${res.status})`);
      }

      const batchId = data.batch_id;
      if (data.validation_warnings && data.validation_warnings.length > 0) {
        setWarnings(data.validation_warnings);
      }

      // Poll background status every 1.5 seconds for real-time live action feed
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/run-batch/${batchId}/status`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData?.recent_logs && statusData.recent_logs.length > 0) {
              setLiveLogs(statusData.recent_logs);
            }
            if (statusData?.progress_message) {
              setSuccessMsg(`STATUS: ${statusData.progress_message}`);
            }
            if (statusData?.status === 'COMPLETED') {
              clearInterval(pollInterval);
              setUploading(false);
              setSuccessMsg(`Batch ${batchId} reconciled successfully! (${data.bank_valid_records} bank rows, ${data.ledger_valid_records} ledger rows)`);
              if (typeof onUploadSuccess === 'function') {
                onUploadSuccess(statusData.summary);
              }
            } else if (statusData?.status === 'FAILED') {
              clearInterval(pollInterval);
              setUploading(false);
              setErrorMsg(statusData.error || 'Reconciliation failed in background worker.');
            }
          }
        } catch (pollErr) {
          console.error('Status polling error:', pollErr);
        }
      }, 1500);

    } catch (err) {
      setErrorMsg(err.message);
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-[#FAFAFA] border-2 border-[#1E3A8A] shadow-[4px_4px_0px_0px_#0F172A] p-6 mb-6 rounded-none"
    >
      <div className="flex items-center space-x-3 mb-6 pb-4 border-b-2 border-[#1E3A8A]">
        <div className="p-2 bg-[#1D4ED8] text-[#FAFAFA] border-2 border-[#2563EB] shadow-[2px_2px_0px_0px_#0F172A]">
          <Upload className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <h3 className="text-lg font-black uppercase text-[#0F172A]">Supply Custom Dataset Batch</h3>
          <p className="text-xs font-medium text-slate-600">Upload Bank Settlements and Internal Ledger CSV files to validate and reconcile a new dataset</p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-[#0F172A] text-red-200 border-2 border-red-500 shadow-[3px_3px_0px_0px_#0F172A] text-xs flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-mono tabular-nums font-bold leading-relaxed">{errorMsg}</div>
        </div>
      )}

      {successMsg && !uploading && (
        <div className="mb-6 p-4 bg-[#0F172A] text-[#FAFAFA] border-2 border-[#1E3A8A] shadow-[3px_3px_0px_0px_#0F172A] text-xs flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 text-[#60A5FA] shrink-0" />
          <span className="font-extrabold uppercase tracking-wide">{successMsg}</span>
        </div>
      )}

      {/* Live Processing Terminal Action Feed */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 bg-[#050814] text-[#60A5FA] border-2 border-[#2563EB] p-4 shadow-[4px_4px_0px_0px_#0F172A]"
          >
            <div className="flex items-center justify-between border-b border-[#1E3A8A] pb-2 mb-3">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-[#60A5FA]" />
                <span className="text-xs font-black uppercase tracking-wider text-white">Live Pipeline Execution Feed</span>
              </div>
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#60A5FA]" />
                <span className="text-[10px] font-mono font-bold uppercase text-blue-300">Processing Active Batch...</span>
              </div>
            </div>

            <div className="font-mono text-xs space-y-1.5 max-h-36 overflow-y-auto">
              {(liveLogs || []).map((log, idx) => (
                <div key={idx} className="flex items-start space-x-2 text-slate-200">
                  <span className="text-[#60A5FA] font-bold">›</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {warnings && warnings.length > 0 && (
        <div className="mb-6 p-4 bg-slate-200 border-2 border-[#1E3A8A] shadow-[3px_3px_0px_0px_#0F172A] text-xs font-mono tabular-nums text-[#0F172A]">
          <div className="font-black uppercase mb-2 flex items-center space-x-1.5 text-[#0F172A]">
            <AlertCircle className="w-4 h-4 text-[#1D4ED8]" />
            <span>Validation Warnings ({warnings.length} rejected row(s)):</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-xs font-bold">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
        {/* Bank File Input */}
        <div className="md:col-span-2">
          <label className="block text-xs font-black uppercase tracking-wider text-[#0F172A] mb-2">
            Bank Settlements CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setBankFile(e.target.files[0])}
            className="w-full text-xs text-[#0F172A] font-bold file:mr-3 file:py-2 file:px-4 file:border-2 file:border-[#1E3A8A] file:text-xs file:font-black file:bg-[#1D4ED8] file:text-[#FAFAFA] file:shadow-[2px_2px_0px_0px_#0F172A] hover:file:bg-[#2563EB] cursor-pointer border-2 border-[#1E3A8A] bg-slate-100 p-2 shadow-[2px_2px_0px_0px_#0F172A]"
          />
        </div>

        {/* Ledger File Input */}
        <div className="md:col-span-2">
          <label className="block text-xs font-black uppercase tracking-wider text-[#0F172A] mb-2">
            Internal Ledger CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setLedgerFile(e.target.files[0])}
            className="w-full text-xs text-[#0F172A] font-bold file:mr-3 file:py-2 file:px-4 file:border-2 file:border-[#1E3A8A] file:text-xs file:font-black file:bg-[#1D4ED8] file:text-[#FAFAFA] file:shadow-[2px_2px_0px_0px_#0F172A] hover:file:bg-[#2563EB] cursor-pointer border-2 border-[#1E3A8A] bg-slate-100 p-2 shadow-[2px_2px_0px_0px_#0F172A]"
          />
        </div>

        {/* Primary Action Trigger Button */}
        <div className="md:col-span-1">
          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3 px-4 rounded-none text-xs font-black uppercase tracking-wider brutal-btn-black flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Reconciling...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-white" />
                <span>Run Batch Reconciliation</span>
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
