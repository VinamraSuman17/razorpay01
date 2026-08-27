# SINGLE CONTINUOUS FINANCE-OPS LOOP DESIGN SPECIFICATION
**Project**: Razorpay Autonomous Finance Controller  
**Goal**: Integrate Reconciliation, Tax Auditing, Customer-Aware Forecasting, and Exception Resolution into One Seamless Loop.

---

## 1. Executive Summary & Vision

The core thesis of the 2026 AI Finance Controller Buildathon is:
> **"Verification capacity, not generation speed, is the bottleneck."**

Finance teams do not trust AI systems that output unverified single-point estimates. This specification defines an enterprise-grade architecture that:
1. Reconciles multi-source transactions with mathematical rigour.
2. Audits Tax Line items (separating TDS Sec 194O from GST 18%).
3. Generates Customer-Aware Cash Forecasts (accounting for payer lag & uncertainty).
4. Routes all unresolved discrepancies into a Single, Honest Exceptions Engine.

---

## 2. Deep Domain Enhancements

### A. Tax-Line Matcher Layer (Deep Compliance)
- **TDS vs GST Separation**:
  - **TDS (Sec 194O 2%)**: Withheld by payer on gross invoice amount.
  - **GST (18%)**: Charged on platform service fee component.
- **Sub-Categorization**:
  - `TAX_RATE_SLAB_MISMATCH` (Wrong GST % applied)
  - `MISSING_TDS_WITHHOLDING` (TDS omitted)
  - `PLATFORM_FEE_OVERCHARGE` (Gateway fee higher than agreed rate)
- **Quantified Impact**:
  - Reports Total Rupee Leakage across transactions.
- **Rounding Defense**:
  - Variances $\le \text{₹5.00}$ are auto-classified as `ROUNDING_DIFFERENCE` (no false alarms).

### B. Forward Cash Forecaster (Customer-Aware Liquidity)
- **Customer Payer Lag Profiling**:
  - Calculates historical payment lag per customer (`Acme Corp` vs `Beta LLC`).
  - Classifies customers into **High Reliability** vs **Erratic Payers**.
- **3-Tier Probability Weighting**:
  - **Confirmed Cash (100% Weight)**: Reconciled bank credits.
  - **Expected Inflow (85% Weight)**: Future due orders from reliable payers.
  - **At-Risk Receivables (30% Weight)**: Overdue orders or items linked to exceptions.
- **Unhedged FX Exposure**:
  - Isolates USD/EUR receivables into a separate FX volatility note.
- **Transparent Range**:
  - Outputs **Best Case** vs **Conservative (At-Risk Deducted)** bounds.

---

## 3. Unified Execution Pipeline

```
                       [ CSV Dataset Upload ]
                                  │
                                  ▼
                ┌───────────────────────────────────┐
                │  1. Multi-Tier Reconciliation     │
                │  (Rules + Gemini 3.5 Verification)│
                └─────────────────┬─────────────────┘
                                  │
                                  ▼
                ┌───────────────────────────────────┐
                │  2. Tax-Line Audit Engine         │
                │  - Distinct TDS (2%) vs GST (18%) │
                │  - Sub-Categorization & Leakage   │
                └─────────────────┬─────────────────┘
                                  │
                                  ▼
                ┌───────────────────────────────────┐
                │  3. Customer-Aware Forecaster     │
                │  - Customer Payer Reliability     │
                │  - 3-Tier Probability Bucketing   │
                │  - Currency FX Exposure Tracking  │
                └─────────────────┬─────────────────┘
                                  │
                                  ▼
                ┌───────────────────────────────────┐
                │  4. Unified Single Exception DB   │
                │  (Single Source of Truth DuckDB)  │
                └─────────────────┬─────────────────┘
                                  │
                                  ▼
                ┌───────────────────────────────────┐
                │  5. Executive UI & Grounded Q&A   │
                │  - Single Pipeline Flow View      │
                │  - Customer Lag & Tax Breakdown   │
                │  - 1-Click AI Bank Dispute Email  │
                └───────────────────────────────────┘
```

---

## 4. Implementation Roadmap

1. **Phase 1**: Upgrade Tax Matcher (`src/tax/tax_matcher.py`) with TDS/GST split & sub-categories.
2. **Phase 2**: Upgrade Forecaster (`src/forecasting/cash_forecaster.py`) with customer lag & probability weighting.
3. **Phase 3**: Add AI Bank Dispute Generator (`src/agent/dispute_agent.py`).
4. **Phase 4**: Wire full pipeline into FastAPI (`backend/main.py`) & React UI (`frontend/src/App.jsx`).
