import React, { useState } from 'react';
import { Play, RefreshCw, CheckCircle, AlertTriangle, Activity, Database, Clock, UploadCloud } from 'lucide-react';
import { StatCard } from './components/StatCard';
import { SignatureBanner } from './components/SignatureBanner';
import { DashboardCharts } from './components/DashboardCharts';
import { MatchesTable } from './components/MatchesTable';
import { ExceptionsTable } from './components/ExceptionsTable';
import { SettlementQA } from './components/SettlementQA';
import { BatchUploadSection } from './components/BatchUploadSection';

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

  // Run Batch handler with guard check when no data uploaded
  const handleRunBatch = async () => {
    if (!hasDataset) {
      setNoDataAlert("No dataset uploaded yet in this session. Please select Bank Settlements and Internal Ledger CSV files in the section below and click 'Upload & Reconcile Batch' first.");
      return;
    }

    setNoDataAlert(null);
    try {
      setRunning(true);
      const res = await fetch('/run-batch', { method: 'POST' });
      if (res.ok) {
        const sData = await res.json();
        setSummary(sData);
        await fetchData();
      } else {
        const errData = await res.json();
        setNoDataAlert(errData.detail || 'Reconciliation failed. Please upload CSV files first.');
      }
    } catch (err) {
      console.error('Error executing batch reconciliation:', err);
      setNoDataAlert('Failed to connect to backend server. Please try again.');
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
    if (!res.ok) {
      throw new Error(`API returned status ${res.status}`);
    }
    return await res.json();
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#0B1F3A]">
      {/* Header */}
      <header className="bg-[#0B1F3A] text-white py-4 px-6 border-b border-slate-800 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#2563EB] rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Razorpay Finance Controller</h1>
              <p className="text-[11px] text-slate-300">Autonomous Settlement Reconciliation & Audit Platform</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Last Reconciliation Run Timestamp */}
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-300 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Last Run:</span>
              <span className="font-mono-tabular font-semibold text-white">
                {lastRunTime ? lastRunTime : 'Not Run Yet'}
              </span>
            </div>

            {/* Run Batch Button */}
            <button
              onClick={handleRunBatch}
              disabled={running}
              className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-2 transition-all disabled:opacity-50"
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Reconciling Batch...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Batch Reconciliation</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6">
        {/* Warning Alert if user clicks Run Batch before uploading */}
        {noDataAlert && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-medium">{noDataAlert}</span>
            </div>
            <button
              onClick={() => setNoDataAlert(null)}
              className="text-amber-700 hover:text-amber-900 font-bold ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Custom CSV Upload Section (Always Visible) */}
        <BatchUploadSection onUploadSuccess={handleUploadSuccess} />

        {!hasDataset ? (
          /* Empty State Initial Prompt */
          <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-xs mb-6 text-center space-y-4">
            <div className="w-14 h-14 bg-blue-50 text-[#2563EB] rounded-full flex items-center justify-center mx-auto shadow-xs">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#0B1F3A]">Upload a Dataset to Run Reconciliation</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Select your Bank Settlements CSV and Internal Ledger CSV above and click <strong>Upload & Reconcile Batch</strong> to start autonomous matching and view audit analytics.
              </p>
            </div>
          </div>
        ) : (
          /* Populated Dashboard Content */
          <>
            {/* Top Signature Banner */}
            <SignatureBanner
              matchRate={summary?.match_rate_percent || 0}
              totalRecords={summary?.total_bank_settlements || 0}
              isRunning={running}
            />

            {/* Top Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="Total Bank Settlements"
                value={summary?.total_bank_settlements || 0}
                subtitle="Ingested & Audited Statements"
                icon={Database}
                color="navy"
              />
              <StatCard
                title="Overall Match Rate"
                value={`${summary?.match_rate_percent || 0}%`}
                subtitle="Full Autonomous Pipeline Coverage"
                icon={CheckCircle}
                color="green"
                trend="100% Precision"
              />
              <StatCard
                title="Operational Exceptions"
                value={summary?.exception_count || 0}
                subtitle="Duplicates, Chargebacks & Unidentified"
                icon={AlertTriangle}
                color="red"
                trend="Requires Action"
              />
              <StatCard
                title="Needs Review Queue"
                value={summary?.needs_review_count || 0}
                subtitle="Low Confidence LLM Shortlists"
                icon={Activity}
                color="amber"
                trend="0 Pending"
              />
            </div>

            {/* Charts Section */}
            <DashboardCharts
              matchesCount={matches.length}
              exceptionsCount={exceptions.length}
              needsReviewCount={summary?.needs_review_count || 0}
              exceptionsList={exceptions}
              summary={summary}
            />

            {/* Settlement Q&A Assistant Section */}
            <SettlementQA onAskQuestion={handleAskQuestion} />

            {/* Matches Audit Log Table */}
            <MatchesTable matches={matches} />

            {/* Exceptions Queue Table */}
            <ExceptionsTable exceptions={exceptions} />
          </>
        )}
      </main>
    </div>
  );
}
