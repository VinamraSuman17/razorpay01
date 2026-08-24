# Razorpay Autonomous Finance Controller — Project Brain & Architecture Blueprint

Welcome to the **BRAIN.md** knowledge base for the **Razorpay Autonomous Finance Controller**. This document serves as the master architectural reference, system design blueprint, data flow specification, and developer operational guide.

---

## 1. System Overview & Core Objective

The **Razorpay Autonomous Finance Controller** is an enterprise-grade fintech reconciliation platform. It ingests two disjoint financial data streams:
1. **Bank Settlement Statements** (External settlement records from bank partners containing UTRs, gross amounts, fee deductions, net amounts, and timestamps).
2. **Internal Ledger Orders** (Internal transaction records containing order IDs, invoice dates, customer references, expected amounts, tax, and settlement status).

### Core Capabilities
- **Multi-Tier Matching Engine**: Combines 5 deterministic SQL rules with an LLM-powered verification agent to achieve **~98% automated reconciliation coverage** with **100% precision**.
- **Deterministic & AI Hybrid Layer**: High-velocity exact/tolerance rules process ~62% of standard settlements in milliseconds; complex fuzzy, FX currency conversions, fee deductions, and partial/split payments are verified by Google Gemini.
- **Operational Exception Classifier**: Categorizes unmatched or short-settled records into actionable categories (`DUPLICATE_SETTLEMENT`, `MISSING_PAYOUT`, `FEE_DISCREPANCY`, `CHARGEBACK_REVERSAL`, `FX_CONVERSION_DISCREPANCY`, `UNIDENTIFIED_PAYER`) with priority ratings.
- **Grounded Financial Q&A Assistant**: Allows finance teams to ask natural language questions ("Why was STL0068 matched with a fuzzy reference?") with strict anti-hallucination SQL grounding and explicit UTR reference comparison.
- **Airbnb `@visx` Interactive Dashboard**: Modern React dashboard featuring low-level D3/React visualization primitives (`DonutChart`, `ExceptionBarChart`, `AccuracyComparisonChart`), upload-driven empty states, and audit log tables.

---

## 2. System Architecture & Component Topology

```
                  ┌─────────────────────────────────────────┐
                  │          React + Vite Frontend          │
                  │  (Airbnb @visx, Tailwind, Markdown)     │
                  └────────────────────┬────────────────────┘
                                       │ HTTP REST / JSON
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │           FastAPI Backend API           │
                  │            (backend/main.py)            │
                  └──────┬───────────────────────────┬──────┘
                         │                           │
         ┌───────────────┴───────────┐   ┌───────────┴───────────────┐
         │ Ingestion & Validation    │   │ Grounded Q&A Assistant    │
         │ (Pydantic CSV Validation) │   │ (src/qa/settlement_qa.py) │
         └───────────────┬───────────┘   └───────────┬───────────────┘
                         │                           │
                         ▼                           ▼
                  ┌─────────────────────────────────────────┐
                  │         DuckDB SQL Database Engine      │
                  │        (bank_settlements, ledger,       │
                  │          audit_log, exceptions)         │
                  └──────────────┬──────────────────────────┘
                                 │
             ┌───────────────────┴───────────────────┐
             │ Multi-Tier Reconciliation Pipeline    │
             └──────┬─────────────────────────┬──────┘
                    │                         │
                    ▼                         ▼
   ┌────────────────────────────────┐ ┌────────────────────────────────┐
   │ Deterministic Matching Layers  │ │ LLM Agent Verification Layer   │
   │ - Exact Reference Match        │ │ - Candidate Pool Trigram Search│
   │ - Amount Tolerance Match       │ │ - Gemini 3.5/3.1 Tool-Calling  │
   │ - Partial Payment Shortfall    │ │ - FX Rate Conversion Tools     │
   │ - Split Settlement Match       │ │ - Disk Cache (data/llm_cache)  │
   └────────────────────────────────┘ └────────────────────────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ Exception Classifier Engine (src/exceptions/classifier.py)       │
   └──────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack & Key Dependencies

| Subsystem | Technology | Purpose |
| :--- | :--- | :--- |
| **Language** | Python 3.14.6 | Core backend engine and LLM verification loop |
| **API Server** | FastAPI & Uvicorn | Async HTTP REST API endpoints |
| **Database** | DuckDB 1.2+ | High-performance in-memory & file-backed SQL OLAP engine |
| **LLM SDK** | `google-genai` (Gemini API) | Generative AI models (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`) |
| **Validation** | Pydantic v2 | Strict schema validation for CSV uploads and API payloads |
| **Frontend Framework** | React 19 + Vite 8 | Single Page Application dashboard |
| **Styling** | TailwindCSS v4 | Sleek, modern slate & dark navy UI design system |
| **Visualizations** | Airbnb `@visx` | Low-level D3 + React charting primitives (`@visx/shape`, `@visx/scale`, `@visx/tooltip`, `@visx/responsive`) |

---

## 4. Pipeline Execution Flow & Matching Logic

When a batch is uploaded (`POST /upload-batch`) or reconciled, the system executes 7 sequential phases:

```
[1. CSV Validation] ➔ [2. Data Ingestion] ➔ [3. Deterministic Matchers] ➔ [4. Candidate Search]
                                                                                │
[7. Eval & Reporting] ◄─ [6. Exception Classification] ◄─ [5. Gemini LLM Verification] ◄┘
```

### Phase 1: CSV Validation & Ingestion
- Uploaded CSVs are validated line-by-line using Pydantic models `BankSettlementRecord` and `InternalLedgerRecord`.
- Amounts in rupees (`1000.50`) are normalized to integer paise (`100050`) to eliminate floating-point rounding errors.
- Valid records are ingested into DuckDB tables `bank_settlements` and `internal_ledger`. Timestamped uploads are persisted under `data/uploads/batch_YYYYMMDD_HHMMSS/`.

### Phase 2: Deterministic Matching Layers (Order-Preserved SQL)
All SQL matchers enforce deterministic ordering `ORDER BY date ASC, settlement_id ASC` to ensure content-independent tie-breaking:
1. **Exact Reference Match** (`src/matching/exact.py`):
   - Condition: `bank_settlements.utr_reference == internal_ledger.customer_reference` AND `bank_settlements.amount == internal_ledger.expected_amount`.
   - Confidence: `1.0`
2. **Tolerance Match** (`src/matching/tolerance.py`):
   - Condition: `utr_reference` matches AND amount differs within ±1.0% or ±₹5.00 (500 paise).
   - Confidence: `0.98`
3. **Partial Payment Match** (`src/matching/partial.py`):
   - Condition: `utr_reference` matches AND bank net amount < expected amount.
   - Logs `PARTIAL_SETTLEMENT_SHORTFALL` with explicit underpayment reason (e.g. `underpaid by ₹973.41`).
   - Confidence: `0.90`
4. **Split Settlement Match** (`src/matching/split.py`):
   - Condition: Sum of multiple bank settlements equals 1 order expected amount, or 1 settlement covers multiple split orders.
   - Confidence: `0.95`

### Phase 3: Gemini Agent Verification Layer (`src/agent/verifier.py`)
- Unmatched settlements undergo candidate pool search (`get_top_candidates`) using trigram string similarity on UTRs, customer names, and descriptions.
- Each settlement candidate pool is evaluated by Gemini via `run_agent_verification()`.
- **Tool-Calling Integration**: Gemini can invoke `apply_fx_conversion(amount, from_curr, to_curr)` to dynamically convert foreign currencies (USD, EUR, GBP) to INR.
- **Quota-Efficient Caching**: Decisions are cached on disk in `data/llm_cache.json` keyed by settlement ID and candidate pool hash. Cached decisions bypass LLM calls automatically.
- **Model Fallback Chain**: `gemini-3.5-flash-lite` ➔ `gemini-3.1-flash-lite` ➔ `gemini-flash-lite-latest` ➔ `gemini-3.5-flash`.

### Phase 4: Operational Exception Classifier (`src/exceptions/classifier.py`)
Unmatched bank settlements are analyzed and assigned one of 6 operational categories:
- `DUPLICATE_SETTLEMENT`: Multiple bank entries with identical UTR reference and amount.
- `MISSING_PAYOUT`: Order is unsettled in ledger but no bank payout received after expected date.
- `FEE_DISCREPANCY`: Net settlement amount deviates significantly from expected platform fee deduction (2.36%).
- `CHARGEBACK_REVERSAL`: Negative settlement amount indicating bank chargeback or dispute debit.
- `FX_CONVERSION_DISCREPANCY`: Currency mismatch where FX rate conversion falls outside expected band.
- `UNIDENTIFIED_PAYER`: No matching customer name or UTR reference found in ledger.

### Phase 5: Grounded Q&A Assistant (`src/qa/settlement_qa.py`)
- **Entity Extraction**: Analyzes question to extract `filter_type` (`settlement_id`, `order_id`, `utr_reference`, `category_count`, `general_query`) and `value`.
- **SQL Execution**: Executes parameterized DuckDB queries LEFT JOINing `bank_settlements`, `audit_log`, `internal_ledger`, and `exceptions`.
- **Answer Synthesis**: Synthesizes natural language answers citing exact ₹ INR amounts, dates, and reference comparison (`utr_reference` vs `customer_reference`).
- **Q&A Question Cache**: Keyed **strictly on exact question text string** (`question.strip().lower()`) in `data/qa_cache.json`. Two different questions about the same settlement trigger fresh Gemini API calls.
- **Explicit Logging**: Logs `[GEMINI_API_CALL]`, `[QA_CACHE_HIT]`, `[QA_CACHE_MISS]`, and `[QA_EXTRACTION_FALLBACK]` warnings on regex fallbacks.

---

## 5. Accuracy Metrics & Comparison Report

| Metric | Deterministic Rules Baseline (Exact + Tolerance) | Full AI Hybrid Pipeline (Full Suite + Gemini) |
| :--- | :---: | :---: |
| **Total Bank Settlements** | 95 | 95 |
| **Matched Count** | 59 | **93** |
| **Match Rate** | **62.11%** | **97.89%** |
| **Precision** | **100.00%** | **100.00%** |
| **Recall** | **62.11%** | **97.89%** |
| **Exceptions Identified** | N/A | **8** |
| **False Positives / Negatives** | 0 / 34 | **0 / 0** |

---

## 6. Directory Map & Code Structure

```
finance-controller/
├── backend/
│   └── main.py                     # FastAPI REST API server & pipeline runner
├── src/
│   ├── agent/
│   │   └── verifier.py             # Gemini LLM verification agent & tool execution
│   ├── audit/
│   │   └── logger.py               # DuckDB & JSONL audit logger
│   ├── config_loader.py            # Pydantic settings & config loader
│   ├── evaluation/
│   │   └── evaluator.py            # Precision, recall, and match rate evaluator
│   ├── exceptions/
│   │   └── classifier.py           # Operational exception classification rules
│   ├── ingestion/
│   │   └── loader.py               # Pydantic schemas & CSV ingestion loaders
│   ├── matching/
│   │   ├── exact.py                # Exact reference & amount SQL matcher
│   │   ├── tolerance.py            # Amount tolerance SQL matcher
│   │   ├── partial.py              # Shortfall partial payment matcher
│   │   ├── split.py                # Split settlement batch matcher
│   │   ├── advanced.py             # Fee deduction & currency FX matcher
│   │   └── fuzzy.py                # Trigram candidate search algorithms
│   └── qa/
│       └── settlement_qa.py        # Grounded Q&A assistant & answer synthesis
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DonutChart.jsx               # Visx Donut Chart (Status breakdown)
│   │   │   ├── ExceptionBarChart.jsx        # Visx Horizontal Bar Chart (Exceptions)
│   │   │   ├── AccuracyComparisonChart.jsx # Visx Grouped Bar Chart (Baseline vs AI)
│   │   │   ├── BatchUploadSection.jsx       # File upload UI & validation errors
│   │   │   ├── MatchesTable.jsx             # Audit log matches table
│   │   │   ├── ExceptionsTable.jsx          # Exception queue table
│   │   │   ├── SettlementQA.jsx             # Natural language Q&A assistant UI
│   │   │   ├── SignatureBanner.jsx          # Header match rate banner
│   │   │   └── StatCard.jsx                 # Statistic cards
│   │   ├── App.jsx                 # Main React dashboard component
│   │   └── index.css               # TailwindCSS styles
│   └── vite.config.js              # Vite dev server & proxy settings (/upload-batch)
├── tests/
│   └── unit/                       # Complete pytest unit test suite (25 tests)
├── data/
│   ├── uploads/                    # Timestamped batch upload folders
│   ├── llm_cache.json              # Gemini matching decision cache (DO NOT DELETE)
│   └── qa_cache.json               # Q&A exact-question text cache
├── run_batch.py                    # CLI batch execution runner
└── brain.md                        # Master project architecture & knowledge base
```

---

## 7. Developer Quickstart Guide

### 1. Environment Setup
```powershell
# Navigate to project directory
cd finance-controller

# Activate virtual environment
..\venv\Scripts\activate

# Set Gemini API Key (optional for LLM calls, cached fallback available)
$env:GEMINI_API_KEY="your_gemini_api_key"
```

### 2. Run API Backend Server (FastAPI)
```powershell
python -m uvicorn backend.main:app --port 8000 --reload
```

### 3. Run Frontend Server (Vite React App)
In a separate terminal window:
```powershell
cd frontend
npm run dev
```
Open **`http://localhost:5173`** (or `http://localhost:5174`) in your browser.

### 4. Run Automated Test Suite
```powershell
python -m pytest tests/unit
```

---

## 8. Critical System Rules & Guarantees

1. **Upload-Driven Workflow**: The dashboard starts in an **Empty State**. Users must upload a Bank Settlements CSV and Internal Ledger CSV before reconciliation results populate.
2. **Strict Grounding & Anti-Hallucination**: The Q&A agent only makes claims supported by SQL query results. If a field was not retrieved, it explicitly states that the detail is unavailable rather than inferring values.
3. **No Hardcoded Regex Hacks**: Duplicate tie-breaking is handled content-independently via SQL `ORDER BY date ASC, settlement_id ASC`.
4. **Cache Separation**: `data/llm_cache.json` caches Gemini matching verification decisions; `data/qa_cache.json` caches Q&A exact-question responses. Neither cache interferes with the other.
