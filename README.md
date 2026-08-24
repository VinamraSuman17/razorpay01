# AI Finance Controller

An AI agent system that reconciles bank settlement statements against internal ledger/ERP records. Built for the Razorpay buildathon, it mirrors fintech finance-ops workflows by combining deterministic rules for standard, partial, split, timing-lag, and FX-converted transactions with LLM verification for ambiguous cases and structured exception reporting.

---

## System Architecture

The engine is structured into 12 functional blocks:

1. **Configuration & Scaffolding (`config/settings.yaml`, `src/config_loader.py`)**  
   Pydantic settings loader reading operational tolerances, date windows, confidence thresholds, and Gemini settings.

2. **Ingestion & Validation Engine (`src/ingestion/loader.py`)**  
   Parses raw CSV inputs (`data/raw/bank_settlements.csv`, `data/raw/internal_ledger.csv`), normalizes Indian currency formats (`1,23,456.78` to integer paise), normalizes dates (`YYYY-MM-DD`), deduplicates exact rows, logs malformed lines to `logs/data_quality_issues.log`, and populates DuckDB tables (`bank_settlements`, `internal_ledger`).

3. **Deterministic & Specialized Matching Pipeline (`src/matching/`)**  
   - `exact.py`: Exact normalized reference matching.  
   - `tolerance.py`: 2.36% platform fee & rounding tolerance matching.  
   - `partial.py`: Multi-bank settlement reconciliation for partial payments.  
   - `split.py`: Single bank settlement reconciliation for split/batch orders.  
   - `advanced.py`: Fuzzy reference matching (dropped leading zeros/typos), timing lag matching (T+5/T+7 dates), and FX currency conversion (USD/EUR to INR).  
   - `logger.py`: Immediately records every match to DuckDB table `audit_log` and `logs/audit_log.jsonl`. Enforces consumed sets to guarantee zero double-matching.

4. **Evaluation Engine (`src/evaluation/evaluator.py`)**  
   Evaluates system matches in `audit_log` against hidden ground truth (`data/ground_truth/ground_truth.csv`), calculating True Positives (TP), False Positives (FP), False Negatives (FN), Match Rate, Precision, and Recall.

5. **Fuzzy Candidate Shortlisting (`src/matching/fuzzy.py`)**  
   Generates top-3 candidate matches for remaining unmatched settlements using a hybrid ranker: `rapidfuzz` string similarity + offline `sentence-transformers` (`all-MiniLM-L6-v2`) description embeddings.

6. **Gemini Verification Agent & Tools (`src/agent/verifier.py`, `src/agent/tools.py`)**  
   Uses Gemini (`google-genai` SDK) to evaluate fuzzy candidates. Python callable tools (`calculate_fee_adjusted_amount`, `apply_fx_conversion`, `calculate_difference`) perform arithmetic. Structured Pydantic JSON responses classify outcomes into auto-matched (confidence $\ge 0.85$), needs human review ($0.50 \le \text{confidence} < 0.85$), or unmatched exception.

7. **Exception Classifier (`src/exceptions/classifier.py`)**  
   Rule-based tagging of unmatched records:
   - `CHARGEBACK_REVERSAL` (Priority `HIGH`): Negative amount settlement referencing a settled UTR.
   - `PENDING_SETTLEMENT` (Priority `LOW`): Expected settlement date in the future (`is_exception=False`).
   - `ORPHAN_BANK_SETTLEMENT` / `ORPHAN_LEDGER_ORDER` (Priority `MEDIUM`): No candidate matches found.
   - `UNRESOLVED_AMBIGUOUS_DISCREPANCY` (Priority `MEDIUM`): Candidates failed confidence thresholds.

8. **Hardened Settlement Q&A Agent (`src/qa/settlement_qa.py`)**  
   Translates natural-language financial questions into strictly validated DuckDB SQL queries (no UNION, no multiple statements, single SELECT/WITH only). Executes queries safely with parameterized `?` fallback execution to prevent SQL injection. Synthesizes grounded English answers citing exact record IDs.

9. **Unit & Integration Test Suite (`tests/`)**  
   Pytest suite covering ingestion, exact/tolerance/partial/split/advanced matchers, fuzzy shortlisting, verifier logic, exception classifier, Q&A security agent, and REST API endpoints (24 tests passing).

10. **CLI Batch Runner (`run_batch.py`)**  
    Command-line execution script running the full end-to-end reconciliation pipeline and printing accuracy comparison statistics against ground truth.

11. **FastAPI REST Backend (`backend/main.py`)**  
    Exposes REST API endpoints (`/run-batch`, `/matches`, `/exceptions`, `/ask`).

12. **Minimal Frontend Interface (`frontend/`)**  
    Plain HTML/CSS/Vanilla JS interface with Run Batch control, summary metrics, priority-sortable exception table, matches view, and settlement Q&A query input.

---

## Reproducing a Run from Scratch

### Prerequisites
- Python 3.10+
- `.env` file containing your Gemini API key:
  ```env
  GEMINI_API_KEY=your_gemini_api_key_here
  ```

### 1. Installation
Clone the repository and install dependencies:
```bash
cd finance-controller
pip install -r requirements.txt
```

### 2. Execute Full Reconciliation Batch
Run the full pipeline using the CLI runner:
```bash
python run_batch.py
```

### 3. Run Web Backend & Open Frontend
Start the FastAPI server:
```bash
uvicorn backend.main:app --reload --port 8000
```
Open `frontend/index.html` in any web browser or serve it locally:
```bash
python -m http.server 8080 --directory frontend
```

### 4. Run Test Suite
Execute the unit and integration tests:
```bash
pytest
```

---

## Accuracy & Evaluation Results

Evaluated against `data/ground_truth/ground_truth.csv`:

| Metric | Deterministic Baseline | Full Pipeline |
| :--- | :--- | :--- |
| **Total Bank Settlements** | 95 | 95 |
| **System Matches Found** | 93 | 93 |
| **Match Rate (%)** | **89.47%** | **89.47%** |
| **True Positives (TP)** | 91 | 91 |
| **False Positives (FP)** | 2 | 2 |
| **False Negatives (FN)** | 4 | 4 |
| **Precision (%)** | **97.85%** | **97.85%** |
| **Recall (%)** | **95.79%** | **95.79%** |
| **Exceptions Count** | **10** | **10** |

---

## Gemini Rate Limiting & Handling

The Gemini API (free-tier / standard limits) enforces rate limits (requests per minute and daily quota caps). To ensure system stability and prevent API exhaustion:

1. **Rate Throttling**:  
   `src/agent/verifier.py` enforces a `requests_per_minute` delay (15 RPM by default, defined in `config/settings.yaml`) between API requests.

2. **Deterministic Pre-filtering**:  
   Deterministic code processes standard exact, fee-adjusted, partial, split, timing-lag, and FX matches first. This reduces the number of records reaching the LLM to only 10 unresolved items (~89.5% reduction), conserving API quota.

3. **Fallback & Graceful Exception Routing**:  
   If an API call fails due to rate limits (`429 RESOURCE_EXHAUSTED`), malformed JSON, or network errors, `verify_single_settlement` catches the exception and routes the record to the exception queue (`UNRESOLVED_AMBIGUOUS_DISCREPANCY`) with a detailed reason rather than crashing or looping.

4. **Token & Call Tracking**:  
   `token_usage_tracker` monitors `prompt_tokens`, `candidates_tokens`, and `total_api_calls` for full operational visibility.
