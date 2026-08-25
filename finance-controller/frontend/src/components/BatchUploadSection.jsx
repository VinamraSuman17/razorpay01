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
      className="bg-[#FAFAFA] border-2 border-[#18181B] shadow-[4px_4px_0px_0px_#18181B] p-6 mb-6 rounded-none"
    >
      <div className="flex items-center space-x-3 mb-6 pb-4 border-b-2 border-[#18181B]">
        <div className="p-2 bg-[#18181B] text-[#FAFAFA] border-2 border-[#18181B] shadow-[2px_2px_0px_0px_rgba(24,24,27,0.3)]">
          <Upload className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <h3 className="text-lg font-black uppercase text-[#18181B]">Supply Custom Dataset Batch</h3>
          <p className="text-xs font-medium text-zinc-600">Upload Bank Settlements and Internal Ledger CSV files to validate and reconcile a new dataset</p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-zinc-900 text-[#FAFAFA] border-2 border-[#18181B] shadow-[3px_3px_0px_0px_#18181B] text-xs flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-[#FAFAFA] shrink-0 mt-0.5" />
          <div className="flex-1 font-mono tabular-nums font-bold leading-relaxed">{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-[#18181B] text-[#FAFAFA] border-2 border-[#18181B] shadow-[3px_3px_0px_0px_#18181B] text-xs flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 text-[#FAFAFA] shrink-0" />
          <span className="font-extrabold uppercase tracking-wide">{successMsg}</span>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="mb-6 p-4 bg-zinc-200 border-2 border-[#18181B] shadow-[3px_3px_0px_0px_#18181B] text-xs font-mono tabular-nums text-[#18181B]">
          <div className="font-black uppercase mb-2 flex items-center space-x-1.5 text-[#18181B]">
            <AlertCircle className="w-4 h-4 text-[#18181B]" />
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
          <label className="block text-xs font-black uppercase tracking-wider text-[#18181B] mb-2">
            Bank Settlements CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setBankFile(e.target.files[0])}
            className="w-full text-xs text-[#18181B] font-bold file:mr-3 file:py-2 file:px-4 file:border-2 file:border-[#18181B] file:text-xs file:font-black file:bg-[#18181B] file:text-[#FAFAFA] file:shadow-[2px_2px_0px_0px_#18181B] hover:file:bg-zinc-800 cursor-pointer border-2 border-[#18181B] bg-zinc-100 p-2 shadow-[2px_2px_0px_0px_#18181B]"
          />
        </div>

        {/* Ledger File Input */}
        <div className="md:col-span-2">
          <label className="block text-xs font-black uppercase tracking-wider text-[#18181B] mb-2">
            Internal Ledger CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setLedgerFile(e.target.files[0])}
            className="w-full text-xs text-[#18181B] font-bold file:mr-3 file:py-2 file:px-4 file:border-2 file:border-[#18181B] file:text-xs file:font-black file:bg-[#18181B] file:text-[#FAFAFA] file:shadow-[2px_2px_0px_0px_#18181B] hover:file:bg-zinc-800 cursor-pointer border-2 border-[#18181B] bg-zinc-100 p-2 shadow-[2px_2px_0px_0px_#18181B]"
          />
        </div>

        {/* Primary Action Trigger Button */}
        <div className="md:col-span-1">
          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3 px-4 rounded-none text-xs font-black uppercase tracking-wider brutal-btn-black flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
