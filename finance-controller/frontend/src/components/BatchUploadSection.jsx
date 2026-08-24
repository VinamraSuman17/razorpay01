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

    try {
      const res = await fetch('/upload-batch', {
        method: 'POST',
        body: formData
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(text || 'Upload server error');
      }

      if (!res.ok) {
        throw new Error(data.detail || 'Upload and validation failed.');
      }

      setSuccessMsg(data.message || `Batch ${data.batch_id} validated (${data.bank_valid_records} bank rows, ${data.ledger_valid_records} ledger rows) and reconciled!`);
      if (data.validation_warnings && data.validation_warnings.length > 0) {
        setWarnings(data.validation_warnings);
      }
      onUploadSuccess(data.summary);
    } catch (err) {
      setErrorMsg(err.message);
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
          <div className="relative border border-dashed border-slate-300 rounded-lg p-2.5 bg-slate-50 hover:bg-slate-100/80 transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setBankFile(e.target.files[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex items-center space-x-2 text-xs text-slate-600">
              <FileText className="w-4 h-4 text-[#2563EB]" />
              <span className="truncate">{bankFile ? bankFile.name : 'Choose bank_settlements.csv...'}</span>
            </div>
          </div>
        </div>

        {/* Ledger File Input */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Internal Ledger CSV
          </label>
          <div className="relative border border-dashed border-slate-300 rounded-lg p-2.5 bg-slate-50 hover:bg-slate-100/80 transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setLedgerFile(e.target.files[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex items-center space-x-2 text-xs text-slate-600">
              <FileText className="w-4 h-4 text-[#2563EB]" />
              <span className="truncate">{ledgerFile ? ledgerFile.name : 'Choose internal_ledger.csv...'}</span>
            </div>
          </div>
        </div>

        {/* Upload & Reconcile Button */}
        <div>
          <button
            type="submit"
            disabled={uploading || !bankFile || !ledgerFile}
            className="w-full py-2.5 px-4 bg-[#0B1F3A] hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-2 disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                <span>Validating...</span>
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
