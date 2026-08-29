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
              className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[500px] bg-[#FAFAFA] border-l-4 border-[#1E3A8A] shadow-[-10px_0px_0px_0px_#0F172A] p-6 overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b-2 border-[#1E3A8A]">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-[#1D4ED8] text-white border-2 border-[#2563EB] shadow-[2px_2px_0px_0px_#0F172A]">
                      <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-base font-black uppercase text-[#0F172A]">Exception Record Context</h4>
                      <p className="text-xs font-mono font-bold text-[#1D4ED8]">
                        Record ID: {selectedException.record_id}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedException(null)}
                    className="p-1.5 bg-slate-200 text-[#0F172A] hover:bg-red-500 hover:text-white border-2 border-[#1E3A8A] shadow-[2px_2px_0px_0px_#0F172A] font-black cursor-pointer transition-colors"
                  >
                    <X className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>

                {/* Priority & Category Banner */}
                <div className="p-4 bg-[#0F172A] text-white border-2 border-[#2563EB] shadow-[3px_3px_0px_0px_#0F172A] flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] uppercase font-mono tracking-wider text-blue-300">Category</span>
                    <span className="text-sm font-black font-mono text-white uppercase">
                      {(selectedException.category || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-mono tracking-wider text-blue-300">Priority Level</span>
                    <span className="text-xs font-black font-mono text-white uppercase px-2 py-0.5 bg-[#1D4ED8] border border-[#2563EB]">
                      {selectedException.priority}
                    </span>
                  </div>
                </div>

                {/* PROMINENT TOP FEATURE: Collaborative Resolution & Analyst Handoff Queue */}
                <div className="bg-white p-4 border-2 border-[#1E3A8A] shadow-[4px_4px_0px_0px_#0F172A] font-mono text-xs space-y-3">
                  <div className="flex items-center justify-between border-b-2 border-[#1E3A8A] pb-2">
                    <span className="text-xs font-black uppercase text-[#1D4ED8] flex items-center gap-1.5">
                      👥 Analyst Action & Resolution Thread
                    </span>
                    <span className="text-[10px] bg-[#1D4ED8] text-white font-black px-2.5 py-0.5 border border-[#2563EB]">
                      Active Owner: {selectedOwner}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-[#0F172A] block">Assign Reviewer / Owner:</label>
                    <select
                      value={selectedOwner}
                      onChange={(e) => {
                        setSelectedOwner(e.target.value);
                        alert(`Assigned exception ${selectedException.record_id} to ${e.target.value}`);
                      }}
                      className="w-full text-xs font-bold p-2 border-2 border-[#0F172A] bg-slate-50 cursor-pointer"
                    >
                      <option value="Rahul (Senior Analyst)">Rahul (Senior Analyst)</option>
                      <option value="Priya (FinOps Manager)">Priya (FinOps Manager)</option>
                      <option value="Amit (Settlement Specialist)">Amit (Settlement Specialist)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-black uppercase text-[#0F172A] block">Post Resolution Comment / Note:</label>
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
                              analyst_name: selectedOwner || 'Rahul (FinOps)',
                              comment_text: commentInput.trim(),
                              timestamp: new Date().toISOString()
                            };
                            setCommentsList([newComment, ...commentsList]);
                            setPostSuccessMsg('✓ Comment Posted Successfully!');
                            const textToPost = commentInput.trim();
                            setCommentInput('');
                            setTimeout(() => setPostSuccessMsg(''), 3000);

                            try {
                              await fetch('/add-comment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ record_id: selectedException.record_id, analyst_name: selectedOwner || 'Rahul (FinOps)', comment_text: textToPost })
                              });
                              fetchComments(selectedException.record_id);
                            } catch (e) {
                              console.error(e);
                            }
                          }
                        }}
                        className="px-4 py-2 bg-[#1E3A8A] text-white font-black uppercase text-xs border-2 border-[#0F172A] hover:bg-[#2563EB] cursor-pointer shadow-[2px_2px_0px_0px_#0F172A]"
                      >
                        Post Note
                      </button>
                    </div>

                    {postSuccessMsg && (
                      <div className="text-[11px] font-black text-emerald-800 bg-emerald-100 border-2 border-emerald-400 p-2 shadow-[2px_2px_0px_0px_#0F172A]">
                        {postSuccessMsg}
                      </div>
                    )}

                    {/* Active Posted Comments Thread - Highlighted */}
                    <div className="space-y-2 pt-2">
                      <span className="text-[11px] font-black uppercase text-[#0F172A] block border-b border-slate-200 pb-1">
                        📜 Resolution History Thread ({commentsList.length}):
                      </span>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {commentsList.length === 0 ? (
                          <div className="p-3 bg-amber-50 border border-amber-300 text-[11px] text-amber-900 font-bold">
                            ⚠️ No resolution notes posted yet. Add a note above to record your investigation.
                          </div>
                        ) : (
                          commentsList.map((c, i) => (
                            <div key={i} className="p-3 bg-[#0F172A] text-white border-2 border-[#1E3A8A] shadow-[2px_2px_0px_0px_#0F172A] font-mono text-xs space-y-1">
                              <div className="flex justify-between font-black text-[#60A5FA] border-b border-slate-700 pb-1">
                                <span>👤 {c.analyst_name}</span>
                                <span className="text-[10px] text-slate-300">{new Date(c.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-slate-100 font-medium pt-1 leading-relaxed">{c.comment_text}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Classification Details */}
                <div className="bg-[#FAFAFA] p-4 border-2 border-[#1E3A8A] shadow-[2px_2px_0px_0px_#0F172A]">
                  <h5 className="text-xs font-black uppercase text-[#1D4ED8] border-b border-[#1E3A8A]/20 pb-2 mb-3">
                    Record Provenance
                  </h5>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Record ID:</span>
                      <span className="font-bold text-[#0F172A]">{selectedException.record_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Source System:</span>
                      <span className="font-bold text-[#1D4ED8] capitalize">{(selectedException.source || '').replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Exception Category:</span>
                      <span className="font-extrabold text-[#0F172A] uppercase">{selectedException.category}</span>
                    </div>
                  </div>
                </div>

                {/* Recommended Resolution Action */}
                <div className="bg-[#FAFAFA] p-4 border-2 border-[#1E3A8A] shadow-[2px_2px_0px_0px_#0F172A]">
                  <h5 className="text-xs font-black uppercase text-[#1D4ED8] border-b border-[#1E3A8A]/20 pb-2 mb-3">
                    Recommended Resolution Action
                  </h5>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="text-[#0F172A] font-extrabold text-xs leading-snug">
                      {selectedException.suggested_action}
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed pt-1">
                      Follow standard finance operations protocol for {(selectedException.category || '').toLowerCase().replace(/_/g, ' ')}.
                    </p>
                  </div>
                </div>

                {/* Complete Reason Explanation */}
                <div className="bg-[#0F172A] text-white p-4 border-2 border-[#2563EB] shadow-[3px_3px_0px_0px_#0F172A]">
                  <div className="text-xs font-black uppercase text-[#60A5FA] mb-1.5">
                    Complete Discrepancy & Root Cause Analysis:
                  </div>
                  <p className="text-xs leading-relaxed font-medium text-slate-100">
                    {selectedException.reason || 'No discrepancy details provided.'}
                  </p>
                </div>
              </div>

              {/* Close Footer Button */}
              <div className="pt-6 border-t-2 border-[#1E3A8A]">
                <button
                  onClick={() => setSelectedException(null)}
                  className="w-full py-3 brutal-btn-black text-xs font-black uppercase tracking-wider cursor-pointer"
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
