import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, AlertCircle, CheckCircle2, RefreshCw, Play } from 'lucide-react';

export function BatchUploadSection({ onUploadSuccess }) {
  const [bankFile, setBankFile] = useState(null);
  const [ledgerFile, setLedgerFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [warnings, setWarnings] = useState([]);

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

    const formData = new FormData();
    formData.append('bank_file', bankFile);
    formData.append('ledger_file', ledgerFile);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes timeout

    try {
      const res = await fetch('/upload-batch', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // Non-JSON HTML response
      }

      if (!res.ok) {
        const errorMsg = data?.detail || data?.message || (
          res.status === 502 ? 'Server gateway timeout (502). Reconciliation took longer than expected. Please try again.' :
          res.status === 413 ? 'Uploaded file is too large (413). Maximum allowed size per file is 10 MB.' :
          res.status === 400 ? 'Invalid file upload (400). Please check your CSV files.' :
          `Upload failed with server error (${res.status}). Please try again.`
        );
        throw new Error(errorMsg);
      }

      setSuccessMsg(data.message || `Batch ${data.batch_id} validated (${data.bank_valid_records} bank rows, ${data.ledger_valid_records} ledger rows) and reconciled!`);
      if (data.validation_warnings && data.validation_warnings.length > 0) {
        setWarnings(data.validation_warnings);
      }
      onUploadSuccess(data.summary);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setErrorMsg('Upload request timed out after 10 minutes. The server is still processing in the background.');
      } else {
        setErrorMsg(err.message);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 mb-6"
    >
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 rounded-lg bg-blue-50 text-[#2563EB]">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[#0B1F3A]">Supply Custom Dataset Batch</h3>
          <p className="text-xs text-slate-500 mt-0.5">Upload Bank Settlements and Internal Ledger CSV files to validate and reconcile a new dataset</p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626] text-xs flex items-start space-x-2 whitespace-pre-wrap">
          <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
          <div className="flex-1 font-mono tabular-nums">{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-lg bg-[#16A34A]/10 border border-[#16A34A]/20 text-[#16A34A] text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-[#D97706]/10 border border-[#D97706]/20 text-[#D97706] text-xs font-mono tabular-nums">
          <div className="font-semibold mb-2 flex items-center space-x-1.5 text-[#D97706]">
            <AlertCircle className="w-4 h-4 text-[#D97706]" />
            <span>Validation Warnings ({warnings.length} rejected row(s)):</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-[11px]">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
        {/* Bank File Input */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-2">
            Bank Settlements CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setBankFile(e.target.files[0])}
            className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#2563EB] hover:file:bg-blue-100 cursor-pointer border border-slate-200 rounded-lg p-1.5"
          />
        </div>

        {/* Ledger File Input */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-2">
            Internal Ledger CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setLedgerFile(e.target.files[0])}
            className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#2563EB] hover:file:bg-blue-100 cursor-pointer border border-slate-200 rounded-lg p-1.5"
          />
        </div>

        {/* Primary Action Trigger Button */}
        <div className="md:col-span-1">
          <button
            type="submit"
            disabled={uploading}
            className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center space-x-2 transition-colors ${
              uploading
                ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                : 'bg-[#2563EB] hover:bg-blue-600 text-white cursor-pointer'
            }`}
          >
            {uploading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Reconciling...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run Batch Reconciliation</span>
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
