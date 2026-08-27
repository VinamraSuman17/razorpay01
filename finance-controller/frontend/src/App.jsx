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
      <div className="min-h-screen bg-[#F1F5F9] text-[#0F172A]">
        {/* Header - Deep Sapphire Midnight Blue Bar */}
        <header className="bg-[#0F172A] text-[#FAFAFA] py-4 px-6 border-b-2 border-[#1E3A8A] sticky top-0 z-50 shadow-[0_4px_0_0_#0F172A]">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#1D4ED8] text-white border-2 border-[#2563EB] shadow-[2px_2px_0px_0px_#0F172A]">
                <Activity className="w-5 h-5 stroke-[3]" />
              </div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-white">
                  Razorpay Autonomous Finance Controller
                  <span className="text-[10px] bg-[#1D4ED8] text-white border border-[#2563EB] px-2 py-0.5 font-mono uppercase font-black shadow-[2px_2px_0px_0px_#0F172A]">
                    v1.0 Production
                  </span>
                </h1>
                <p className="text-xs text-blue-200/80 font-medium">Autonomous Bank Settlement & Internal Ledger Matching Engine</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {lastRunTime ? (
                <div className="hidden sm:flex items-center space-x-2 text-xs text-[#FAFAFA] bg-[#1E293B] px-3.5 py-1.5 border-2 border-[#1E3A8A] font-mono font-bold shadow-[2px_2px_0px_0px_#0F172A]">
                  <Clock className="w-4 h-4 text-[#60A5FA]" />
                  <span>Last Run: {new Date(lastRunTime).toLocaleTimeString()}</span>
                </div>
              ) : (
                <div className="hidden sm:flex items-center space-x-2 text-xs text-blue-200 bg-[#1E293B] px-3.5 py-1.5 border-2 border-[#1E3A8A] font-mono font-bold shadow-[2px_2px_0px_0px_#0F172A]">
                  <span className="w-2.5 h-2.5 rounded-none bg-[#2563EB] border border-[#60A5FA]" />
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
            <div className="mb-6 p-4 bg-[#0F172A] text-[#FAFAFA] border-2 border-[#1E3A8A] shadow-[4px_4px_0px_0px_#0F172A] text-xs flex items-start space-x-3 font-bold">
              <AlertTriangle className="w-5 h-5 text-[#60A5FA] shrink-0 mt-0.5" />
              <div className="flex-1 font-mono leading-relaxed">{noDataAlert}</div>
              <button
                onClick={() => setNoDataAlert(null)}
                className="text-[#FAFAFA] hover:text-blue-300 font-black text-sm px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Upload Section with Single Primary Trigger */}
          <BatchUploadSection onUploadSuccess={handleUploadSuccess} />

          {/* Calm Pending Verification Status Note (Separate from Exceptions) */}
          {summary?.pending_verification_count > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-slate-200 border-2 border-[#1E3A8A] shadow-[4px_4px_0px_0px_#0F172A] text-xs flex items-center justify-between font-bold text-[#0F172A]"
            >
              <div className="flex items-center space-x-2.5">
                <Clock className="w-4 h-4 text-slate-700 shrink-0 stroke-[2.5]" />
                <span>
                  {summary.pending_verification_count} record{summary.pending_verification_count > 1 ? 's' : ''} awaiting AI verification — will resolve automatically once capacity is available
                </span>
              </div>
              <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 bg-[#1D4ED8] text-white border border-[#2563EB] font-extrabold shadow-[1.5px_1.5px_0px_0px_#0F172A]">
                Deferred / Auto-Retry
              </span>
            </motion.div>
          )}

          {!hasDataset ? (
            /* Initial Empty State Card */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="bg-[#FAFAFA] border-2 border-[#1E3A8A] shadow-[5px_5px_0px_0px_#0F172A] p-12 text-center my-6 rounded-none"
            >
              <div className="w-16 h-16 bg-[#1D4ED8] text-white border-2 border-[#2563EB] flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_0px_#0F172A]">
                <UploadCloud className="w-8 h-8 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-black uppercase text-[#0F172A] mb-1">No Reconciliation Dataset Loaded</h3>
              <p className="text-xs font-medium text-slate-600 max-w-md mx-auto mb-6 leading-relaxed">
                Upload your Bank Settlements CSV and Internal Ledger CSV using the file picker above to validate schema and run automated multi-tier reconciliation.
              </p>
              <div className="inline-flex items-center space-x-2 text-xs font-black uppercase text-[#0F172A] bg-slate-200 px-4 py-2.5 border-2 border-[#1E3A8A] shadow-[3px_3px_0px_0px_#0F172A]">
                <span>Select two CSV files above and click "Run Batch Reconciliation"</span>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Zero-Exceptions Clean Reconciliation Banner */}
              {(exceptions || []).length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-6 p-4 bg-[#0F172A] text-white border-2 border-[#2563EB] shadow-[4px_4px_0px_0px_#0F172A] flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-[#1D4ED8] text-white border border-[#60A5FA]">
                      <CheckCircle className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase text-white">Clean Reconciliation Achieved!</h4>
                      <p className="text-xs text-blue-200 font-medium">All bank settlements matched internal ledger orders cleanly. 0 exceptions require manual intervention.</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black uppercase bg-[#1D4ED8] text-white px-3 py-1 border border-[#60A5FA]">
                    0 Exceptions in Queue
                  </span>
                </motion.div>
              )}
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <StatCard
                  title="Total Settlements"
                  value={summary?.total_bank_settlements ?? 0}
                  subtitle="Bank records in batch"
                  icon={Database}
                  index={0}
                />
                <StatCard
                  title="Reconciled Matches"
                  value={summary?.matched_count ?? 0}
                  subtitle={`${summary?.match_rate_percent ?? 0}% match coverage`}
                  icon={CheckCircle}
                  index={1}
                />
                <StatCard
                  title="Needs Review (AI)"
                  value={summary?.needs_review_count ?? 0}
                  subtitle="Gemini verified items"
                  icon={Activity}
                  index={2}
                />
                <StatCard
                  title="Exceptions Queue"
                  value={summary?.exception_count ?? 0}
                  subtitle="Unmatched records requiring action"
                  icon={AlertTriangle}
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
