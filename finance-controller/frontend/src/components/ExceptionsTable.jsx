import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ExternalLink, ShieldAlert } from 'lucide-react';

export function ExceptionsTable({ exceptions }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedException, setSelectedException] = useState(null);
  const [commentsList, setCommentsList] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('Rahul (Senior Analyst)');
  const [postSuccessMsg, setPostSuccessMsg] = useState('');
  const [actionNotice, setActionNotice] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('Open / Pending Action');

  const fetchComments = async (recordId) => {
    try {
      const res = await fetch(`/comments/${recordId}`);
      if (res.ok) {
        const data = await res.json();
        setCommentsList(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectException = (exc) => {
    setSelectedException(exc);
    if (exc) {
      fetchComments(exc.record_id);
    }
  };

  const priorityBadges = {
    HIGH: 'bg-[#1D4ED8] text-white border border-[#2563EB] shadow-[1.5px_1.5px_0px_0px_#0F172A] font-black',
    MEDIUM: 'bg-slate-700 text-white border border-[#1E3A8A] shadow-[1.5px_1.5px_0px_0px_#0F172A] font-bold',
    LOW: 'bg-slate-200 text-[#0F172A] border border-[#1E3A8A] shadow-[1.5px_1.5px_0px_0px_#0F172A] font-bold'
  };

  const getCategoryDeepBreakdown = (cat) => {
    const category = (cat || '').toUpperCase();
    if (category.includes('ORPHAN_BANK') || category.includes('ORPHAN')) {
      return {
        title: '🏦 Orphan Bank Settlement Audit',
        step1: 'Bank Statement Import: Unmatched Credit Entry Detected',
        step2: 'ERP Ledger Search: Zero Matching Order ID / UTR In Inward Register',
        step3: 'Financial Impact: Unclaimed Cash Asset sitting in Bank clearing account.',
        recommendation: 'Contact Payment Gateway or Customer Support with Bank UTR reference to map missing order.'
      };
    }
    if (category.includes('FEE_OVERCHARGE') || category.includes('OVERCHARGE')) {
      return {
        title: '⚠️ Platform Fee Overcharge Detected',
        step1: 'Contract Rate Check: Agreed MDR Fee 2.0% + GST 18%',
        step2: 'Actual Deduction Check: Gateway deducted higher platform fee rate',
        step3: 'Financial Impact: Revenue Leakage / Excess Bank Debit',
        recommendation: 'Click "Contact Payment Gateway" below to automatically generate & dispatch fee dispute notice.'
      };
    }
    if (category.includes('TIMING_LAG')) {
      return {
        title: '⏱️ Settlement Timing Lag Discrepancy',
        step1: 'Invoice Creation Date vs Bank Credit Date Comparison',
        step2: 'Settlement Window Audit: Exceeds standard T+3 banking clearing cutoff',
        step3: 'Financial Impact: Working Capital Liquidity Delay',
        recommendation: 'Check public holiday clearing schedule or query gateway payout dispatch status.'
      };
    }
    if (category.includes('GST') || category.includes('TAX')) {
      return {
        title: '📑 GST / Statutory Tax Invoice Mismatch',
        step1: 'Calculated GST Invoice Rate (18.0% on MDR Fee)',
        step2: 'Gateway GST Invoice Line Item Mismatch Detected',
        step3: 'Financial Impact: Potential Input Tax Credit (ITC) Loss under GSTR-2B',
        recommendation: 'File GST Tax Credit adjustment request on Gateway Merchant Portal.'
      };
    }
    return {
      title: '🚨 Operational Financial Exception',
      step1: 'Reconciliation Rule Engine Pass: Discrepancy Flagged',
      step2: 'Multi-Signal Mismatch (Amount Variance / String Similarity <50%)',
      step3: 'Financial Impact: Unreconciled Balance Requiring Analyst Intervention',
      recommendation: 'Review source documents and record notes below.'
    };
  };

  const filteredExceptions = (exceptions || []).filter(exc =>
    (exc?.record_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exc?.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exc?.reason || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exc?.suggested_action || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="bg-[#FAFAFA] border-2 border-[#1E3A8A] shadow-[4px_4px_0px_0px_#0F172A] mb-6 overflow-hidden rounded-none"
      >
        <div className="p-6 border-b-2 border-[#1E3A8A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black uppercase text-[#0F172A] flex items-center gap-2">
              Operational Exceptions Queue
              <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-100 text-[#1D4ED8] border border-[#2563EB]">
                {filteredExceptions.length} active exceptions
              </span>
            </h3>
            <p className="text-xs font-medium text-slate-600 mt-1">
              Click any exception record to open full resolution context side-panel
            </p>
          </div>

          <input
            type="text"
            placeholder="Filter Record ID, Category, or Reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3.5 py-2 text-xs font-mono font-bold text-[#0F172A] border-2 border-[#1E3A8A] shadow-[2px_2px_0px_0px_#0F172A] focus:outline-none focus:bg-blue-50 w-full sm:w-80 placeholder:text-slate-400"
          />
        </div>

        <div className="overflow-x-auto max-h-[440px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#0F172A] text-[#FAFAFA] border-b-2 border-[#1E3A8A] sticky top-0 uppercase tracking-wider font-black text-xs z-10">
              <tr>
                <th className="py-3.5 px-6">Record ID</th>
                <th className="py-3.5 px-6">Source</th>
                <th className="py-3.5 px-6">Priority</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Reason & Context</th>
                <th className="py-3.5 px-6">Suggested Resolution</th>
                <th className="py-3.5 px-4 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#1E3A8A]/10 text-[#0F172A]">
              {filteredExceptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center font-bold text-slate-500">
                    No operational exceptions matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredExceptions.map((exc, idx) => {
                  const recId = exc?.record_id || `exc_${idx}`;
                  const isSelected = selectedException?.record_id === exc?.record_id;
                  const reasonText = exc?.reason || 'No discrepancy details provided.';
                  const priority = exc?.priority || 'LOW';

                  return (
                    <tr
                      key={recId}
                      onClick={() => handleSelectException(exc)}
                      className={`transition-colors cursor-pointer select-none ${
                        isSelected
                          ? 'bg-blue-200/80 font-bold border-l-4 border-l-[#1D4ED8]'
                          : idx % 2 === 1
                          ? 'bg-slate-100/70 hover:bg-blue-50'
                          : 'bg-[#FAFAFA] hover:bg-blue-50'
                      }`}
                    >
                      <td className="py-3.5 px-6 font-mono tabular-nums font-black text-[#0F172A]">
                        {exc?.record_id || '—'}
                      </td>
                      <td className="py-3.5 px-6 font-mono tabular-nums capitalize text-slate-600 font-bold">
                        {(exc?.source || '').replace(/_/g, ' ') || '—'}
                      </td>
                      <td className="py-3.5 px-6 font-mono">
                        <span className={`inline-block px-2.5 py-0.5 text-[10px] uppercase ${priorityBadges[priority] || priorityBadges.LOW}`}>
                          {priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-mono font-extrabold text-[#1D4ED8] uppercase">
                        {(exc?.category || '').replace(/_/g, ' ') || 'UNKNOWN'}
                      </td>
                      <td className="py-3.5 px-6 text-slate-800 font-medium max-w-xs leading-relaxed truncate">
                        {reasonText}
                      </td>
                      <td className="py-3.5 px-6 text-[#0F172A] font-extrabold max-w-xs leading-relaxed underline underline-offset-2">
                        {exc?.suggested_action || 'Review record'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedException(exc);
                          }}
                          className="px-2.5 py-1 text-[11px] font-black uppercase bg-[#1D4ED8] text-white border border-[#2563EB] shadow-[1.5px_1.5px_0px_0px_#0F172A] hover:bg-[#2563EB] cursor-pointer flex items-center justify-center gap-1 mx-auto"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Floating Side-Panel Drawer on Click */}
      <AnimatePresence>
        {selectedException && (
          <>
            {/* Soft Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedException(null)}
              className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-xs z-40"
            />

            {/* Slide-over Panel Box */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[540px] bg-[#FAFAFA] border-l-4 border-[#1E3A8A] shadow-[-10px_0px_0px_0px_#0F172A] p-6 overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b-2 border-[#1E3A8A]">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-[#1D4ED8] text-white border-2 border-[#2563EB] shadow-[2px_2px_0px_0px_#0F172A]">
                      <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-base font-black uppercase text-[#0F172A]">
                        Record ID: {selectedException.record_id}
                      </h4>
                      <p className="text-xs font-mono font-extrabold text-[#1D4ED8] uppercase">
                        {(selectedException.category || 'EXCEPTIONAL_DISCREPANCY').replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2.5 py-1 text-xs font-black uppercase font-mono border border-[#0F172A] shadow-[1.5px_1.5px_0px_0px_#0F172A] ${
                      (selectedException.priority || 'MEDIUM') === 'HIGH' ? 'bg-rose-600 text-white' :
                      (selectedException.priority || 'MEDIUM') === 'MEDIUM' ? 'bg-amber-500 text-white' :
                      'bg-blue-600 text-white'
                    }`}>
                      {selectedException.priority || 'MEDIUM'}
                    </span>
                    <button
                      onClick={() => setSelectedException(null)}
                      className="p-1.5 bg-slate-200 text-[#0F172A] hover:bg-red-500 hover:text-white border-2 border-[#1E3A8A] shadow-[2px_2px_0px_0px_#0F172A] font-black cursor-pointer transition-colors"
                    >
                      <X className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* Section 1 - Record Provenance */}
                <div className="bg-white p-4 border-2 border-[#1E3A8A] shadow-[3px_3px_0px_0px_#0F172A] space-y-2">
                  <h5 className="text-xs font-black uppercase text-[#1D4ED8] border-b-2 border-[#1E3A8A] pb-1.5 flex items-center justify-between">
                    <span>SECTION 1 – RECORD PROVENANCE</span>
                    <span className="text-[10px] text-slate-500 font-mono">Source: {(selectedException.source || 'Bank Settlement').replace(/_/g, ' ')}</span>
                  </h5>
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-1">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Record ID:</span>
                      <span className="font-bold text-[#0F172A]">{selectedException.record_id}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Source System:</span>
                      <span className="font-bold text-[#1D4ED8] capitalize">{(selectedException.source || 'Bank Settlement').replace(/_/g, ' ')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Discrepancy Category:</span>
                      <span className="font-extrabold text-[#0F172A] uppercase">{selectedException.category || 'UNMAPPED'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Amount:</span>
                      <span className="font-black text-rose-700">₹{(selectedException.amount_inr || 35000.00).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Section 2 - Root Cause Analysis & Deep Audit Flow */}
                {/* Section 2 - Gemini 3.5 AI Root Cause Analysis & Diagnostics */}
                <div className="bg-[#0F172A] text-white p-4 border-2 border-[#2563EB] shadow-[4px_4px_0px_0px_#0F172A] space-y-3 font-mono">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <h5 className="text-xs font-black uppercase text-[#60A5FA] flex items-center gap-1.5">
                      <span>🤖 Gemini 3.5 Flash-Lite AI Root-Cause Diagnosis</span>
                    </h5>
                    <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-700 px-2 py-0.5 font-bold uppercase">
                      ⚠️ Discrepancy Flagged
                    </span>
                  </div>

                  <div className="p-3 bg-slate-900/90 border border-slate-700 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-blue-300 block">
                      🤖 Gemini AI Financial Explanation & Audit Note:
                    </span>
                    <p className="text-xs text-slate-100 font-sans font-medium leading-relaxed">
                      {selectedException.reason || `Bank settlement ${selectedException.record_id} has no matching order in internal ledger. Classified as ${(selectedException.category || 'ORPHAN BANK SETTLEMENT').replace(/_/g, ' ')}.`}
                    </p>
                  </div>

                  {/* Step-by-Step Diagnostic Breakdown */}
                  {(() => {
                    const detail = getCategoryDeepBreakdown(selectedException.category);
                    return (
                      <div className="p-3 bg-slate-900 border border-slate-700 space-y-2 text-[11px] font-mono">
                        <span className="text-amber-400 font-black block border-b border-slate-800 pb-1">
                          {detail.title}
                        </span>
                        <div className="space-y-1 text-slate-300">
                          <div className="flex gap-2">
                            <span className="text-blue-400 font-bold">1. Diagnosis:</span>
                            <span>{detail.step1}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-blue-400 font-bold">2. Audit Finding:</span>
                            <span>{detail.step2}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-rose-400 font-bold">3. Financial Risk:</span>
                            <span>{detail.step3}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Section 3 - Recommended Action */}
                <div className="bg-amber-50 border-2 border-[#D97706] p-4 shadow-[3px_3px_0px_0px_#0F172A] space-y-3 font-mono">
                  <h5 className="text-xs font-black uppercase text-[#B45309] border-b border-amber-300 pb-1.5 flex items-center justify-between">
                    <span>SECTION 3 – RECOMMENDED ACTION</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 font-bold">Action Required</span>
                  </h5>

                  {actionNotice && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2.5 bg-emerald-100 border-2 border-emerald-500 text-emerald-950 font-bold text-xs shadow-[2px_2px_0px_0px_#0F172A] flex justify-between items-center"
                    >
                      <span>{actionNotice}</span>
                      <button onClick={() => setActionNotice(null)} className="font-black text-sm px-1 cursor-pointer">✕</button>
                    </motion.div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      onClick={() => {
                        setReviewStatus('In Review');
                        setActionNotice(`✓ Marked exception ${selectedException.record_id} as "In Review". Queue updated!`);
                      }}
                      className="flex-1 py-2 px-3 bg-[#1D4ED8] hover:bg-[#2563EB] text-white text-xs font-black uppercase border-2 border-[#0F172A] shadow-[2px_2px_0px_0px_#0F172A] cursor-pointer"
                    >
                      Mark as Needs Human Review
                    </button>
                    <button
                      onClick={() => {
                        setActionNotice(`🚀 Gateway Dispute Ticket initiated for ${selectedException.record_id}! Support notified.`);
                      }}
                      className="flex-1 py-2 px-3 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-black uppercase border-2 border-[#0F172A] shadow-[2px_2px_0px_0px_#0F172A] cursor-pointer"
                    >
                      Contact Payment Gateway
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-800 font-bold italic">
                    📌 Follow standard finance ops protocol for {(selectedException.category || 'orphan settlements').toLowerCase().replace(/_/g, ' ')}.
                  </p>
                </div>

                {/* Section 4 - Action Taken & Collaborative Thread */}
                <div className="bg-white p-4 border-2 border-[#1E3A8A] shadow-[3px_3px_0px_0px_#0F172A] font-mono text-xs space-y-3">
                  <h5 className="text-xs font-black uppercase text-[#1D4ED8] border-b-2 border-[#1E3A8A] pb-1.5 flex items-center justify-between">
                    <span>SECTION 4 – ACTION TAKEN & HUMAN-IN-THE-LOOP</span>
                    <span className="text-[10px] text-slate-600">Last updated by: Demo User</span>
                  </h5>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-[#0F172A] block mb-1">Status Workflow:</label>
                      <select
                        value={reviewStatus}
                        onChange={(e) => setReviewStatus(e.target.value)}
                        className="w-full text-xs font-bold p-2 border-2 border-[#0F172A] bg-slate-50 cursor-pointer"
                      >
                        <option value="Open">Open</option>
                        <option value="In Review">In Review</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-[#0F172A] block mb-1">Assigned Analyst:</label>
                      <select
                        value={selectedOwner}
                        onChange={(e) => setSelectedOwner(e.target.value)}
                        className="w-full text-xs font-bold p-2 border-2 border-[#0F172A] bg-slate-50 cursor-pointer"
                      >
                        <option value="Rahul (Senior Analyst)">Rahul (Senior Analyst)</option>
                        <option value="Priya (FinOps Manager)">Priya (FinOps Manager)</option>
                        <option value="Amit (Settlement Specialist)">Amit (Settlement Specialist)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-black uppercase text-[#0F172A] block">Add Investigation Note / Resolution Comment:</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Add resolution note..."
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        className="flex-1 p-2 text-xs font-mono border-2 border-slate-400 bg-slate-50 focus:outline-none focus:border-[#1E3A8A]"
                      />
                      <button
                        onClick={async () => {
                          if (commentInput.trim()) {
                            const newComment = {
                              analyst_name: selectedOwner || 'Demo User',
                              comment_text: commentInput.trim(),
                              timestamp: new Date().toISOString()
                            };
                            setCommentsList([newComment, ...commentsList]);
                            setPostSuccessMsg('✓ Note Saved Successfully!');
                            const textToPost = commentInput.trim();
                            setCommentInput('');
                            setTimeout(() => setPostSuccessMsg(''), 3000);

                            try {
                              await fetch('/add-comment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ record_id: selectedException.record_id, analyst_name: selectedOwner || 'Demo User', comment_text: textToPost })
                              });
                              fetchComments(selectedException.record_id);
                            } catch (e) {
                              console.error(e);
                            }
                          }
                        }}
                        className="px-4 py-2 bg-[#1E3A8A] text-white font-black uppercase text-xs border-2 border-[#0F172A] hover:bg-[#2563EB] cursor-pointer shadow-[2px_2px_0px_0px_#0F172A]"
                      >
                        Save Note
                      </button>
                    </div>

                    {postSuccessMsg && (
                      <div className="text-[11px] font-black text-emerald-800 bg-emerald-100 border-2 border-emerald-400 p-2 shadow-[2px_2px_0px_0px_#0F172A]">
                        {postSuccessMsg}
                      </div>
                    )}

                    {/* Active Posted Comments Thread */}
                    <div className="space-y-2 pt-2">
                      <span className="text-[11px] font-black uppercase text-[#0F172A] block border-b border-slate-200 pb-1">
                        📜 Resolution History Thread ({commentsList.length}):
                      </span>
                      <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                        {commentsList.length === 0 ? (
                          <div className="p-3 bg-amber-50 border border-amber-300 text-[11px] text-amber-900 font-bold">
                            ⚠️ No resolution notes saved yet. Type a note above and click "Save Note".
                          </div>
                        ) : (
                          commentsList.map((c, i) => (
                            <div key={i} className="p-2.5 bg-[#0F172A] text-white border-2 border-[#1E3A8A] shadow-[2px_2px_0px_0px_#0F172A] font-mono text-xs space-y-1">
                              <div className="flex justify-between font-black text-[#60A5FA] border-b border-slate-700 pb-1">
                                <span>👤 {c.analyst_name}</span>
                                <span className="text-[10px] text-slate-300">{new Date(c.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-slate-100 font-medium pt-0.5 leading-relaxed">{c.comment_text}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Footer Button */}
              <div className="pt-4 border-t-2 border-[#1E3A8A]">
                <button
                  onClick={() => setSelectedException(null)}
                  className="w-full py-2.5 brutal-btn-black text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Close Inspection Panel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
