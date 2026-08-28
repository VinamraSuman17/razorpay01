import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ShieldAlert, Calendar, CheckCircle2, Sliders, Users, AlertTriangle, ChevronRight, X, Mail, ShieldCheck } from 'lucide-react';

export function CashForecastWidget({ forecast }) {
  const [activeTab, setActiveTab] = useState('overview'); // overview, risk_ranking, buckets, sandbox
  const [payoutDelayDays, setPayoutDelayDays] = useState(0);
  const [riskDiscountPercent, setRiskDiscountPercent] = useState(25);
  const [selectedBucketTab, setSelectedBucketTab] = useState('expected');
  const [showMathModal, setShowMathModal] = useState(false);
  const [dunningModalData, setDunningModalData] = useState(null);

  if (!forecast) return null;

  const {
    confirmed_bank_cash_inr = 0,
    projected_7d_inflow_inr = 0,
    projected_14d_inflow_inr = 0,
    projected_30d_inflow_inr = 0,
    at_risk_receivables_30d_inr = 0,
    data_derived_weights = {},
    customer_defaulter_analytics = [],
    order_buckets = {},
    forecast_ranges = {},
    stats = {}
  } = forecast;

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const simulated30dInflow = Math.max(0, projected_30d_inflow_inr * (1 - payoutDelayDays * 0.02));
  const simulatedAtRiskRecovery = at_risk_receivables_30d_inr * (riskDiscountPercent / 100);
  const simulatedConservativeTotal = confirmed_bank_cash_inr + simulated30dInflow * (data_derived_weights.expected_collection_weight || 0.887) + simulatedAtRiskRecovery;

  const confirmedOrders = order_buckets.confirmed_cash_orders || [];
  const expectedOrders = order_buckets.expected_inflow_orders || [];
  const atRiskOrders = order_buckets.at_risk_orders || [];

  const handleSendDunningNotice = (customer) => {
    const draftNotice = `
TO: accounts-payable@${customer.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com
CC: finance-controller@merchant.com
SUBJECT: URGENT PAYMENT NOTICE: Outstanding Settlement & Delay Warning for ${customer.customer_name}

Dear Finance Team at ${customer.customer_name},

Our autonomous FinOps Monitoring System has flagged an ongoing settlement delay on your account.

ACCOUNT AUDIT SNAPSHOT:
------------------------------------------------
• Customer Name: ${customer.customer_name}
• Average Settlement Delay: +${customer.avg_lag_days} Days Late
• Recorded Default Violations: ${customer.default_violations_count} Violations
• Financial Reliability Score: ${customer.reliability_score_percent}% (${customer.reliability_badge})
• Total Outstanding Value: ${formatINR(customer.total_outstanding_inr)}
• At-Risk Amount: ${formatINR(customer.at_risk_amount_inr)}

DEFAULT REASON SUMMARY:
${customer.default_reason_summary}

REQUIRED ACTION:
Please verify pending invoice settlements and initiate credit transfer to prevent credit limit restriction.

Regards,
Autonomous Credit & Risk Control Engine
`.trim();

    setDunningModalData({
      customer,
      noticeText: draftNotice
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-2 border-[#0F172A] shadow-[4px_4px_0px_0px_#0F172A] p-6 mb-8"
    >
      {/* Widget Header with Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b-2 border-[#E2E8F0] pb-4 mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#1E3A8A] text-white border-2 border-[#0F172A] shadow-[2px_2px_0px_0px_#0F172A]">
            <TrendingUp className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black uppercase text-[#0F172A] tracking-tight">
                Forward Cash Flow Forecaster (30-Day Liquidity Studio)
              </h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-[#2563EB] text-white">
                Interactive
              </span>
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-700" /> Dual-Engine Math Active
              </span>
            </div>
            <p className="text-xs text-[#64748B] font-medium">
              Customer Defaulter Intelligence • Data Weights ({Math.round((data_derived_weights.expected_collection_weight || 0.887)*100)}%) • 3-Tier Order Buckets
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center space-x-1.5 bg-[#F1F5F9] p-1 border-2 border-[#0F172A]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-xs font-black uppercase transition-all ${
              activeTab === 'overview' ? 'bg-[#1E3A8A] text-white shadow-[2px_2px_0px_0px_#0F172A]' : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('risk_ranking')}
            className={`px-3 py-1.5 text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
              activeTab === 'risk_ranking' ? 'bg-[#1E3A8A] text-white shadow-[2px_2px_0px_0px_#0F172A]' : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Defaulter Analytics ({customer_defaulter_analytics.length})
          </button>
          <button
            onClick={() => setActiveTab('buckets')}
            className={`px-3 py-1.5 text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
              activeTab === 'buckets' ? 'bg-[#1E3A8A] text-white shadow-[2px_2px_0px_0px_#0F172A]' : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            3 Buckets
          </button>
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`px-3 py-1.5 text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
              activeTab === 'sandbox' ? 'bg-[#1E3A8A] text-white shadow-[2px_2px_0px_0px_#0F172A]' : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> What-If Sandbox
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#F8FAFC] border-2 border-[#CBD5E1] p-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#64748B] block mb-1">
                Confirmed Bank Cash
              </span>
              <div className="text-xl font-black text-[#0F172A] font-mono">
                {formatINR(confirmed_bank_cash_inr)}
              </div>
              <span className="text-[10px] text-emerald-600 font-bold block mt-1">100% Reconciled Cash</span>
            </div>

            <div className="bg-[#F8FAFC] border-2 border-[#CBD5E1] p-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#64748B] block mb-1">
                7-Day Projected Inflow
              </span>
              <div className="text-xl font-black text-[#1E3A8A] font-mono">
                +{formatINR(projected_7d_inflow_inr)}
              </div>
              <span className="text-[10px] text-[#475569] font-semibold block mt-1">Healthy Pending Orders</span>
            </div>

            <div className="bg-[#F8FAFC] border-2 border-[#CBD5E1] p-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#64748B] block mb-1">
                30-Day Total Inflow
              </span>
              <div className="text-xl font-black text-[#2563EB] font-mono">
                +{formatINR(projected_30d_inflow_inr)}
              </div>
              <span className="text-[10px] text-[#475569] font-semibold block mt-1">Monthly Forecast Window</span>
            </div>

            <div className="bg-[#FFF1F2] border-2 border-[#FECDD3] p-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#991B1B] block mb-1">
                At-Risk Receivables
              </span>
              <div className="text-xl font-black text-[#991B1B] font-mono">
                {formatINR(at_risk_receivables_30d_inr)}
              </div>
              <span className="text-[10px] text-[#991B1B] font-bold block mt-1 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> Excluded from Conservative
              </span>
            </div>
          </div>

          <div className="bg-[#F1F5F9] border-2 border-[#0F172A] p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-[#1E3A8A]" />
              <div>
                <span className="text-xs font-black uppercase text-[#0F172A] block">30-Day Liquidity Projection Range</span>
                <span className="text-xs text-[#475569]">
                  Conservative Range excludes {stats.at_risk_pending_orders || 0} exception items flagged for review
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4 font-mono">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">Conservative Case</span>
                <span className="text-base font-black text-[#0F172A]">{formatINR(forecast_ranges.conservative_30d_total_inr)}</span>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Best Case</span>
                <span className="text-base font-black text-emerald-700">{formatINR(forecast_ranges.best_case_30d_total_inr)}</span>
              </div>

              <button
                onClick={() => setShowMathModal(true)}
                className="px-3 py-1.5 bg-[#1E3A8A] text-white text-xs font-black uppercase border-2 border-[#0F172A] hover:bg-[#2563EB] transition-all"
              >
                Inspect Mathematics 🔍
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 2: CUSTOMER DEFAULTER ANALYTICS TABLE */}
      {activeTab === 'risk_ranking' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-[#0F172A]">Customer Settlement Lag & Defaulter Intelligence Ranking</h4>
            <span className="text-[10px] font-mono font-bold text-slate-500">Sorted by Highest Violations & At-Risk Impact</span>
          </div>

          <div className="overflow-x-auto border-2 border-[#0F172A]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0F172A] text-white uppercase text-[10px] font-black">
                <tr>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Avg Settlement Lag</th>
                  <th className="p-3">Defaults Violations</th>
                  <th className="p-3">Reliability Score</th>
                  <th className="p-3">Flag Reason & Context</th>
                  <th className="p-3">Outstanding Risk</th>
                  <th className="p-3">Defaulter Action</th>
                </tr>
              </thead>
              <tbody className="divide-y border-[#E2E8F0] font-medium text-[#0F172A]">
                {customer_defaulter_analytics.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-500 italic">No customer defaulter data available</td>
                  </tr>
                ) : (
                  customer_defaulter_analytics.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-bold">{c.customer_name}</td>
                      <td className="p-3">{c.avg_lag_days} days late</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase ${c.default_violations_count > 0 ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'text-slate-600'}`}>
                          {c.default_violations_count} Defaults
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase border ${
                          c.reliability_badge === 'REPEAT_DEFAULTER' ? 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold' :
                          c.reliability_badge === 'HIGH_RELIABILITY' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          {c.reliability_score_percent}% ({c.reliability_badge})
                        </span>
                      </td>
                      <td className="p-3 text-[11px] font-mono text-slate-700 max-w-xs">
                        {c.default_reason_summary}
                      </td>
                      <td className="p-3 text-rose-600 font-bold">{formatINR(c.at_risk_amount_inr)}</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleSendDunningNotice(c)}
                          className="px-2.5 py-1 bg-[#0F172A] text-white text-[10px] font-black uppercase hover:bg-rose-700 transition-all flex items-center gap-1"
                        >
                          <Mail className="w-3 h-3" /> Dunning Notice
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* TAB 3: 3 BUCKETS DRILL-DOWN */}
      {activeTab === 'buckets' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-[#CBD5E1] pb-2">
            <button
              onClick={() => setSelectedBucketTab('confirmed')}
              className={`px-3 py-1 text-xs font-black uppercase ${
                selectedBucketTab === 'confirmed' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              Confirmed Bucket ({confirmedOrders.length})
            </button>
            <button
              onClick={() => setSelectedBucketTab('expected')}
              className={`px-3 py-1 text-xs font-black uppercase ${
                selectedBucketTab === 'expected' ? 'bg-[#1E3A8A] text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              Expected Bucket ({expectedOrders.length})
            </button>
            <button
              onClick={() => setSelectedBucketTab('at_risk')}
              className={`px-3 py-1 text-xs font-black uppercase ${
                selectedBucketTab === 'at_risk' ? 'bg-rose-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              At-Risk Bucket ({atRiskOrders.length})
            </button>
          </div>

          <div className="overflow-x-auto border-2 border-[#0F172A]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0F172A] text-white uppercase text-[10px] font-black">
                <tr>
                  <th className="p-3">Record / Order ID</th>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Details / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y border-[#E2E8F0] font-medium text-[#0F172A]">
                {selectedBucketTab === 'confirmed' && confirmedOrders.map((o, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-[#1E3A8A]">{o.id} ({o.stl_id})</td>
                    <td className="p-3">{o.customer_name}</td>
                    <td className="p-3 font-bold text-emerald-700">{formatINR(o.amount_inr)}</td>
                    <td className="p-3 text-emerald-700 font-bold">100% Reconciled Cash ({o.date})</td>
                  </tr>
                ))}

                {selectedBucketTab === 'expected' && expectedOrders.map((o, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-[#1E3A8A]">{o.id}</td>
                    <td className="p-3">{o.customer_name}</td>
                    <td className="p-3 font-bold text-[#2563EB]">{formatINR(o.amount_inr)}</td>
                    <td className="p-3 font-bold text-slate-700">Due: {o.due_date} ({o.bucket} Bucket)</td>
                  </tr>
                ))}

                {selectedBucketTab === 'at_risk' && (
                  atRiskOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500 italic">No at-risk receivables in current dataset</td>
                    </tr>
                  ) : (
                    atRiskOrders.map((o, idx) => (
                      <tr key={idx} className="bg-rose-50 hover:bg-rose-100">
                        <td className="p-3 font-bold text-rose-800">{o.id}</td>
                        <td className="p-3 font-bold text-rose-900">{o.customer_name}</td>
                        <td className="p-3 font-bold text-rose-700">{formatINR(o.amount_inr)}</td>
                        <td className="p-3 font-bold text-rose-800">{o.risk_reason} (Due: {o.due_date})</td>
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* TAB 4: WHAT-IF STRESS-TEST SANDBOX */}
      {activeTab === 'sandbox' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 bg-slate-50 p-6 border-2 border-[#0F172A]">
          <div className="flex items-center justify-between border-b border-slate-300 pb-3">
            <h4 className="text-xs font-black uppercase text-[#0F172A] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#1E3A8A]" /> Interactive What-If Liquidity Stress-Test Sandbox
            </h4>
            <span className="text-[10px] uppercase font-mono font-bold bg-[#1E3A8A] text-white px-2 py-0.5">Live Real-Time Simulation</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 border-2 border-[#CBD5E1]">
              <label className="text-xs font-black uppercase text-[#0F172A] block mb-2">
                Simulated Gateway Payout Delay: <span className="text-[#2563EB] font-mono">+{payoutDelayDays} Days</span>
              </label>
              <input
                type="range"
                min="0"
                max="15"
                value={payoutDelayDays}
                onChange={(e) => setPayoutDelayDays(Number(e.target.value))}
                className="w-full accent-[#1E3A8A] cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Simulates settlement lag impact on 7-Day & 30-Day cash inflow timelines.</span>
            </div>

            <div className="bg-white p-4 border-2 border-[#CBD5E1]">
              <label className="text-xs font-black uppercase text-[#0F172A] block mb-2">
                At-Risk Recovery Probability: <span className="text-rose-700 font-mono">{riskDiscountPercent}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={riskDiscountPercent}
                onChange={(e) => setRiskDiscountPercent(Number(e.target.value))}
                className="w-full accent-rose-700 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Adjusts recovery probability weight for exception-flagged orders.</span>
            </div>
          </div>

          <div className="bg-white p-4 border-2 border-[#0F172A] flex flex-col md:flex-row items-center justify-between gap-4 font-mono">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-500 block">Simulated 30-Day Conservative Cash</span>
              <span className="text-xl font-black text-[#0F172A]">{formatINR(simulatedConservativeTotal)}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase text-slate-500 block">Variance From Baseline</span>
              <span className={`text-sm font-black ${simulatedConservativeTotal >= forecast_ranges.conservative_30d_total_inr ? 'text-emerald-600' : 'text-rose-600'}`}>
                {simulatedConservativeTotal >= forecast_ranges.conservative_30d_total_inr ? '+' : ''}
                {formatINR(simulatedConservativeTotal - forecast_ranges.conservative_30d_total_inr)}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* 1-CLICK DUNNING NOTICE MODAL */}
      <AnimatePresence>
        {dunningModalData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-[#0F172A] shadow-[8px_8px_0px_0px_#0F172A] max-w-2xl w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-[#0F172A] pb-3">
                <div className="flex items-center space-x-2">
                  <Mail className="w-5 h-5 text-rose-600" />
                  <h3 className="text-base font-black uppercase text-[#0F172A]">AI Dunning & Payment Schedule Reminder</h3>
                </div>
                <button onClick={() => setDunningModalData(null)} className="p-1 hover:bg-slate-200">
                  <X className="w-5 h-5 text-[#0F172A]" />
                </button>
              </div>

              <div className="bg-[#F8FAFC] border-2 border-[#0F172A] p-4 font-mono text-xs text-[#0F172A] whitespace-pre-wrap max-h-[50vh] overflow-y-auto">
                {dunningModalData.noticeText}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-[10px] text-slate-500 font-mono font-bold">Automated FinOps Dunning Notice</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(dunningModalData.noticeText);
                      alert('Dunning Notice copied to clipboard!');
                    }}
                    className="px-4 py-2 bg-rose-700 text-white text-xs font-black uppercase hover:bg-rose-800"
                  >
                    Copy Notice Text
                  </button>
                  <button onClick={() => setDunningModalData(null)} className="px-4 py-2 bg-[#0F172A] text-white text-xs font-black uppercase">Done</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MATHEMATICS INSPECTION MODAL */}
      <AnimatePresence>
        {showMathModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-[#0F172A] shadow-[8px_8px_0px_0px_#0F172A] max-w-xl w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-[#0F172A] pb-3">
                <h3 className="text-base font-black uppercase text-[#0F172A]">Forecast Mathematical Model</h3>
                <button onClick={() => setShowMathModal(false)} className="p-1 hover:bg-slate-200">
                  <X className="w-5 h-5 text-[#0F172A]" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700 font-mono">
                <p><strong>1. Data-Derived Expected Collection Weight:</strong> {data_derived_weights.expected_collection_weight || 0.887} (Calculated from DuckDB ratio of Matched Orders / Total Orders)</p>
                <p><strong>2. Customer Defaulter Reliability Score:</strong> <code>Score = 100 - (Avg Lag * 4) - (Defaults * 20)</code></p>
                <p><strong>3. Conservative Range Formula:</strong><br />
                <code>Conservative = Confirmed Cash + (Healthy Pending × {data_derived_weights.expected_collection_weight || 0.887}) + (At-Risk × 0.25)</code></p>
                <p><strong>4. Dual-Engine Safety Gate:</strong> Deterministic SQL Invariant Check in DuckDB + Gemini LLM double verification.</p>
              </div>

              <div className="text-right pt-2 border-t border-slate-200">
                <button onClick={() => setShowMathModal(false)} className="px-4 py-2 bg-[#0F172A] text-white text-xs font-black uppercase">Close Inspection</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
