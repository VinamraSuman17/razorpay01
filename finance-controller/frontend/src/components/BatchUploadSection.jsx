import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

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
        // Non-JSON HTML response (e.g. proxy 502/413)
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 mb-6">
      <div className="flex items-center space-x-2 mb-4">
        <Upload className="w-5 h-5 text-[#2563EB]" />
        <div>
          <h3 className="text-sm font-bold text-[#0B1F3A]">Supply Custom Dataset Batch</h3>
          <p className="text-xs text-slate-500">Upload Bank Settlements and Internal Ledger CSV files to validate and reconcile a new dataset</p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2 whitespace-pre-wrap">
          <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
          <div className="flex-1 font-mono-tabular">{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono-tabular">
          <div className="font-semibold mb-1 flex items-center space-x-1.5 text-amber-800">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Validation Warnings ({warnings.length} rejected row(s)):</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-[11px]">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        {/* Bank File Input */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Bank Settlements CSV
          </label>
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setBankFile(e.target.files[0])}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#2563EB] hover:file:bg-blue-100 cursor-pointer border border-slate-200 rounded-lg py-1 px-2"
            />
          </div>
        </div>

        {/* Ledger File Input */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Internal Ledger CSV
          </label>
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setLedgerFile(e.target.files[0])}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#2563EB] hover:file:bg-blue-100 cursor-pointer border border-slate-200 rounded-lg py-1 px-2"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="md:col-span-1">
          <button
            type="submit"
            disabled={uploading}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center space-x-2 transition-all ${
              uploading
                ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                : 'bg-[#0B1F3A] hover:bg-slate-800 text-white cursor-pointer active:scale-98'
            }`}
          >
            {uploading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Reconciliation in progress, this can take a few minutes...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Upload & Reconcile</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
