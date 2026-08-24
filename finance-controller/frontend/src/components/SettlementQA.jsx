import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Sparkles } from 'lucide-react';

export function SettlementQA({ onAskQuestion }) {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const sampleQuestions = [
    "Why was STL0068 matched?",
    "Why was STL0078 matched via fuzzy reference?",
    "What action is needed for chargeback settlement STL0093?",
    "Compare settlement STL0068 and STL0093"
  ];

  const handleSend = async (qText) => {
    const query = qText || question;
    if (!query.trim() || loading) return;

    const userMsg = { role: 'user', content: query };
    setChatHistory(prev => [...prev, userMsg]);
    if (!qText) setQuestion('');
    setLoading(true);

    try {
      const res = await onAskQuestion(query);
      const botMsg = {
        role: 'assistant',
        content: res.answer,
        sqlQuery: res.sql_query,
        extractedEntity: res.extracted_entity
      };
      setChatHistory(prev => [...prev, botMsg]);
    } catch (err) {
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', content: `Error processing question: ${err.message}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs mb-6 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-100 bg-[#0B1F3A] text-white flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-[#2563EB]" />
          <div>
            <h3 className="text-base font-bold">Settlement Audit Q&A Assistant</h3>
            <p className="text-xs text-slate-300">Grounded NL query engine using DuckDB audit trail & Gemini 3.5 synthesis</p>
          </div>
        </div>
        <span className="text-xs font-mono-tabular bg-white/10 px-2.5 py-1 rounded text-slate-200">
          Model: gemini-3.5-flash-lite
        </span>
      </div>

      {/* Suggested Quick Questions */}
      <div className="p-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-2 items-center">
        <span className="text-[11px] font-semibold text-slate-500 flex items-center space-x-1">
          <Sparkles className="w-3 h-3 text-[#2563EB]" />
          <span>Quick Ask:</span>
        </span>
        {sampleQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="text-xs px-2.5 py-1 bg-white hover:bg-slate-100 text-[#0B1F3A] rounded border border-slate-200 shadow-2xs transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Conversation Thread */}
      <div className="p-4 min-h-[220px] max-h-[360px] overflow-y-auto space-y-4 bg-slate-50/50">
        {chatHistory.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            Ask any question about bank settlements, matching logic, platform fee deductions, or exception recommendations.
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="p-1.5 rounded-lg bg-[#0B1F3A] text-white shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`p-3.5 rounded-xl text-xs max-w-2xl leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#2563EB] text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200 shadow-xs rounded-tl-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <p>{msg.content}</p>
                ) : (
                  <div className="prose prose-xs max-w-none text-slate-800">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {msg.sqlQuery && (
                      <details className="mt-2 text-[10px] bg-slate-900 text-slate-300 p-2 rounded font-mono-tabular">
                        <summary className="cursor-pointer text-slate-400 font-semibold mb-1">Generated SQL Query</summary>
                        <code>{msg.sqlQuery}</code>
                      </details>
                    )}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="p-1.5 rounded-lg bg-[#2563EB] text-white shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center space-x-2 text-slate-400 text-xs py-2">
            <Bot className="w-4 h-4 animate-spin text-[#2563EB]" />
            <span>Analyzing reconciliation database and synthesizing response...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="p-3 border-t border-slate-100 flex items-center space-x-2 bg-white"
      >
        <input
          type="text"
          placeholder="Ask a question about a settlement (e.g. 'Why was STL0068 matched?')..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-50 transition-colors"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
