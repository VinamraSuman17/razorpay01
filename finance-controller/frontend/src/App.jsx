import React, { useState } from 'react';
import { Play, RefreshCw, CheckCircle, AlertTriangle, Activity, Database, Clock, UploadCloud } from 'lucide-react';
import { StatCard } from './components/StatCard';
import { SignatureBanner } from './components/SignatureBanner';
import { DashboardCharts } from './components/DashboardCharts';
import { MatchesTable } from './components/MatchesTable';
import { ExceptionsTable } from './components/ExceptionsTable';
import { SettlementQA } from './components/SettlementQA';
import { BatchUploadSection } from './components/BatchUploadSection';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [summary, setSummary] = useState(null);
  const [matches, setMatches] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [lastRunTime, setLastRunTime] = useState(null);
  const [running, setRunning] = useState(false);
  const [hasDataset, setHasDataset] = useState(false);
  const [noDataAlert, setNoDataAlert] = useState(null);

  // Fetch matches and exceptions from FastAPI backend after dataset upload
  const fetchData = async () => {
    try {
      const [matchRes, excRes] = await Promise.all([
        fetch('/matches'),
        fetch('/exceptions')
      ]);

      if (matchRes.ok) {
        const mData = await matchRes.json();
        setMatches(mData);
        if (mData.length > 0 && mData[0].timestamp) {
          setLastRunTime(mData[0].timestamp);
        }
      }

      if (excRes.ok) {
        const eData = await excRes.json();
        setExceptions(eData);
      }
    } catch (err) {
      console.error('Error fetching backend data:', err);
    }
  };

  // Run Batch handler with guard check and timeout controller
  const handleRunBatch = async () => {
    if (!hasDataset) {
      setNoDataAlert("No dataset uploaded yet in this session. Please select Bank Settlements and Internal Ledger CSV files in the section below and click 'Upload & Reconcile Batch' first.");
      return;
    }

    setNoDataAlert(null);
    setRunning(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min timeout

    try {
      const res = await fetch('/run-batch', { method: 'POST', signal: controller.signal });
      clearTimeout(timeoutId);

      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // Handle non-JSON responses
      }

      if (res.ok) {
        setSummary(data);
        await fetchData();
      } else {
        const errorMsg = data?.detail || data?.message || (
          res.status === 502 ? 'Server gateway timeout (502). The reconciliation task is taking longer than expected. Please try again.' :
          res.status === 413 ? 'Uploaded file is too large (413). Maximum allowed size per file is 10 MB.' :
          res.status === 400 ? 'Invalid request (400). Please check your upload files.' :
          `Server error (${res.status}). Please try again.`
        );
        setNoDataAlert(errorMsg);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Error executing batch reconciliation:', err);
      if (err.name === 'AbortError') {
        setNoDataAlert('Reconciliation request timed out after 10 minutes. The server is still processing in the background.');
      } else {
        setNoDataAlert('Failed to connect to backend server. Please check your network or try again.');
      }
    } finally {
      setRunning(false);
    }
  };

  const handleUploadSuccess = async (newSummary) => {
    setHasDataset(true);
    setNoDataAlert(null);
    setSummary(newSummary);
    await fetchData();
  };

  // Q&A Question Handler
  const handleAskQuestion = async (question) => {
    const res = await fetch('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // Non-JSON
    }

    if (!res.ok) {
      const errorMsg = data?.detail || data?.message || `API returned server error (${res.status})`;
      throw new Error(errorMsg);
    }
    return data;
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F7F8FA] text-[#0B1F3A]">
        {/* Header */}
        <header className="bg-[#0B1F3A] text-white py-4 px-6 border-b border-slate-800 sticky top-0 z-50 shadow-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#2563EB] rounded-lg">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  Razorpay Autonomous Finance Controller
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono uppercase font-semibold">
                    Production v1.0
                  </span>
                </h1>
                <p className="text-xs text-slate-400">Autonomous Bank Settlement & Internal Ledger Matching Engine</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {lastRunTime && (
                <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 font-mono-tabular">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Last Run: {new Date(lastRunTime).toLocaleTimeString()}</span>
                </div>
              )}

              <button
                onClick={handleRunBatch}
                disabled={running}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                  running
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-[#2563EB] hover:bg-blue-600 text-white cursor-pointer active:scale-98'
                }`}
              >
                {running ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Reconciliation in progress...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Batch Reconciliation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-6">
          {/* Signature Match Rate Banner */}
          <SignatureBanner summary={summary} />

          {/* No Dataset Warning Alert */}
          {noDataAlert && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{noDataAlert}</div>
              <button
                onClick={() => setNoDataAlert(null)}
                className="text-amber-700 hover:text-amber-950 font-bold text-sm px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Upload Section */}
          <BatchUploadSection onUploadSuccess={handleUploadSuccess} />

          {!hasDataset ? (
            /* Initial Empty State Card */
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-12 text-center my-6">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#0B1F3A] mb-1">No Reconciliation Dataset Uploaded</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                Upload your Bank Settlements CSV and Internal Ledger CSV using the file picker above to validate schema and run automated multi-tier reconciliation.
              </p>
              <div className="inline-flex items-center space-x-2 text-xs font-semibold text-[#2563EB] bg-blue-50/80 px-4 py-2 rounded-lg border border-blue-100">
                <span>Select two CSV files above and click "Upload & Reconcile Batch"</span>
              </div>
            </div>
          ) : (
            <>
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  title="Total Settlements"
                  value={summary?.total_bank_settlements ?? 0}
                  subtitle="Bank records in batch"
                  icon={Database}
                  color="blue"
                />
                <StatCard
                  title="Reconciled Matches"
                  value={summary?.matched_count ?? 0}
                  subtitle={`${summary?.match_rate_percent ?? 0}% match coverage`}
                  icon={CheckCircle}
                  color="emerald"
                />
                <StatCard
                  title="Needs Review (AI)"
                  value={summary?.needs_review_count ?? 0}
                  subtitle="Gemini verified items"
                  icon={Activity}
                  color="amber"
                />
                <StatCard
                  title="Exceptions Queue"
                  value={summary?.exception_count ?? 0}
                  subtitle="Unmatched records requiring action"
                  icon={AlertTriangle}
                  color="red"
                />
              </div>

              {/* Visx Charts Section */}
              <DashboardCharts summary={summary} exceptions={exceptions} />

              {/* Matches Audit Log Table */}
              <MatchesTable matches={matches} />

              {/* Operational Exceptions Queue Table */}
              <ExceptionsTable exceptions={exceptions} />

              {/* Q&A Assistant */}
              <SettlementQA onAskQuestion={handleAskQuestion} />
            </>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}
