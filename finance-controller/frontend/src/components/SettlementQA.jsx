import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export function SettlementQA({ onAskQuestion, onAsk }) {
  const askFn = onAskQuestion || onAsk;
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
      if (typeof askFn !== 'function') {
        throw new Error('Question handler (onAskQuestion) is not connected.');
      }
      const res = await askFn(query);
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 overflow-hidden flex flex-col rounded-none"
    >
      <div className="p-4 border-b-2 border-black bg-black text-white flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-white text-black border-2 border-white">
            <Bot className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-black uppercase">Settlement Audit Q&A Assistant</h3>
            <p className="text-xs text-zinc-300 font-medium">Grounded NL query engine using DuckDB audit trail & Gemini 3.5 synthesis</p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold bg-zinc-800 border-1.5 border-white px-3 py-1 text-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.4)]">
          Model: gemini-3.5-flash-lite
        </span>
      </div>

      {/* Suggested Quick Questions */}
      <div className="p-4 bg-zinc-100 border-b-2 border-black flex flex-wrap gap-2 items-center">
        <span className="text-xs font-black uppercase tracking-wider text-black flex items-center space-x-1">
          <Sparkles className="w-4 h-4 text-black" />
          <span>Quick Ask:</span>
        </span>
        {sampleQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="text-xs font-extrabold px-3 py-1.5 bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Conversation Thread */}
      <div className="p-5 min-h-[220px] max-h-[360px] overflow-y-auto space-y-4 bg-zinc-50 border-b-2 border-black">
        {chatHistory.length === 0 ? (
          <div className="text-center py-10 text-zinc-600 font-bold text-xs">
            Ask any question about bank settlements, matching logic, platform fee deductions, or exception recommendations.
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="p-1.5 bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`p-4 text-xs max-w-2xl leading-relaxed border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                  msg.role === 'user'
                    ? 'bg-black text-white font-bold'
                    : 'bg-white text-black font-medium'
                }`}
              >
                {msg.role === 'user' ? (
                  <p>{msg.content}</p>
                ) : (
                  <div className="prose prose-xs max-w-none text-black">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {msg.sqlQuery && (
                      <details className="mt-3 text-[11px] bg-black text-white p-3 border-2 border-black font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <summary className="cursor-pointer text-zinc-300 font-black uppercase mb-1">Generated SQL Query</summary>
                        <code>{msg.sqlQuery}</code>
                      </details>
                    )}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="p-1.5 bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center space-x-2 text-black font-bold text-xs py-2">
            <Bot className="w-4 h-4 animate-spin text-black" />
            <span>Analyzing reconciliation database and synthesizing response...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="p-4 flex items-center space-x-3 bg-white"
      >
        <input
          type="text"
          placeholder="Ask a question about a settlement (e.g. 'Why was STL0068 matched?')..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="flex-1 px-4 py-2.5 text-xs font-bold text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:bg-zinc-50"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-5 py-2.5 brutal-btn-black text-xs font-black uppercase tracking-wider flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </form>
    </motion.div>
  );
}
