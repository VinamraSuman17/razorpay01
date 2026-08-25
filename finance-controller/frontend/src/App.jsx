import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, Activity, Database, Clock, UploadCloud } from 'lucide-react';
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
        {/* Header - Navy Solid Surface */}
        <header className="bg-[#0B1F3A] text-white py-4 px-6 border-b border-slate-800 sticky top-0 z-50 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#2563EB] rounded-lg">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  Razorpay Autonomous Finance Controller
                  <span className="text-[10px] bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/30 px-2 py-0.5 rounded font-mono uppercase font-semibold">
                    Production v1.0
                  </span>
                </h1>
                <p className="text-xs text-slate-400">Autonomous Bank Settlement & Internal Ledger Matching Engine</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {lastRunTime ? (
                <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 font-mono">
                  <Clock className="w-4 h-4 text-[#2563EB]" />
                  <span>Last Run: {new Date(lastRunTime).toLocaleTimeString()}</span>
                </div>
              ) : (
                <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span>Awaiting Dataset Upload</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-6">
          {/* Signature Match Rate Banner */}
          <SignatureBanner summary={summary} />

          {/* No Dataset Warning Alert */}
          {noDataAlert && (
            <div className="mb-6 p-4 rounded-xl bg-[#D97706]/10 border border-[#D97706]/20 text-[#D97706] text-xs flex items-start space-x-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{noDataAlert}</div>
              <button
                onClick={() => setNoDataAlert(null)}
                className="text-[#D97706] hover:text-amber-950 font-bold text-sm px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Upload Section with Single Primary Trigger */}
          <BatchUploadSection onUploadSuccess={handleUploadSuccess} />

          {!hasDataset ? (
            /* Initial Empty State Card */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-12 text-center my-6"
            >
              <div className="w-16 h-16 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#0B1F3A] mb-1">No Reconciliation Dataset Uploaded</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                Upload your Bank Settlements CSV and Internal Ledger CSV using the file picker above to validate schema and run automated multi-tier reconciliation.
              </p>
              <div className="inline-flex items-center space-x-2 text-xs font-semibold text-[#2563EB] bg-blue-50/80 px-4 py-2 rounded-lg border border-blue-100">
                <span>Select two CSV files above and click "Run Batch Reconciliation"</span>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <StatCard
                  title="Total Settlements"
                  value={summary?.total_bank_settlements ?? 0}
                  subtitle="Bank records in batch"
                  icon={Database}
                  color="blue"
                  index={0}
                />
                <StatCard
                  title="Reconciled Matches"
                  value={summary?.matched_count ?? 0}
                  subtitle={`${summary?.match_rate_percent ?? 0}% match coverage`}
                  icon={CheckCircle}
                  color="emerald"
                  index={1}
                />
                <StatCard
                  title="Needs Review (AI)"
                  value={summary?.needs_review_count ?? 0}
                  subtitle="Gemini verified items"
                  icon={Activity}
                  color="amber"
                  index={2}
                />
                <StatCard
                  title="Exceptions Queue"
                  value={summary?.exception_count ?? 0}
                  subtitle="Unmatched records requiring action"
                  icon={AlertTriangle}
                  color="red"
                  index={3}
                />
              </div>

              {/* Visx Charts Section */}
              <DashboardCharts
                matchesCount={summary?.matched_count ?? 0}
                exceptionsCount={summary?.exception_count ?? 0}
                needsReviewCount={summary?.needs_review_count ?? 0}
                exceptionsList={exceptions}
                summary={summary}
              />

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
