#!/usr/bin/env python3
"""
CLI runner for the AI Finance Controller reconciliation engine.
Runs ingestion, deterministic matchers, partial payment matchers, split settlement matchers,
advanced fuzzy/FX matchers, Gemini agent verifier, and exception classifier,
then evaluates results against ground truth.
"""
import os
import sys
import time
from pathlib import Path
import duckdb

from src.config_loader import get_settings
from src.ingestion.loader import ingest_bank_settlements, ingest_internal_ledger
from src.matching.exact import run_exact_matching
from src.matching.tolerance import run_tolerance_matching
from src.matching.partial import run_partial_matching
from src.matching.split import run_split_matching
from src.matching.advanced import run_advanced_matching
from src.matching.fuzzy import get_top_candidates
from src.agent.verifier import run_agent_verification, token_usage_tracker
from src.exceptions.classifier import classify_unmatched_record
from src.evaluation.evaluator import evaluate_reconciliation

def main():
    print("=" * 60)
    print("  AI FINANCE CONTROLLER - FULL RECONCILIATION PIPELINE")
    print("=" * 60)
    
    try:
        settings = get_settings()
        print("Configuration successfully loaded.")
    except Exception as e:
        print(f"Error loading configuration: {e}")
        sys.exit(1)
        
    base_dir = Path(__file__).resolve().parent
    db_path = base_dir / "data" / "reconciliation.db"
    db_path.parent.mkdir(exist_ok=True, parents=True)
    
    db_conn = duckdb.connect(str(db_path))
    
    # 1. Clear database audit log & jsonl file
    db_conn.execute("DROP TABLE IF EXISTS audit_log;")
    jsonl_log = base_dir / "logs" / "audit_log.jsonl"
    if jsonl_log.exists():
        jsonl_log.unlink()
        
    # 2. Ingest
    print("\n[Phase 1] Ingesting & Validating Datasets...")
    bank_csv = base_dir / "data" / "raw" / "bank_settlements.csv"
    ledger_csv = base_dir / "data" / "raw" / "internal_ledger.csv"
    
    bank_stats = ingest_bank_settlements(bank_csv, db_conn)
    ledger_stats = ingest_internal_ledger(ledger_csv, db_conn)
    print(f"  - Bank Settlements: {bank_stats['valid']} valid records")
    print(f"  - Internal Ledger:  {ledger_stats['valid']} valid records")
    
    consumed_settlements = set()
    consumed_orders = set()
    
    # 3. Deterministic Matching Pipeline
    print("\n[Phase 2] Running Deterministic Matchers...")
    exact_matches = run_exact_matching(db_conn, consumed_settlements, consumed_orders, settings)
    print(f"  - Exact Reference Matches:   {exact_matches}")
    
    tol_matches = run_tolerance_matching(db_conn, consumed_settlements, consumed_orders, settings)
    print(f"  - Fee & Rounding Matches:     {tol_matches}")
    
    # Evaluate basic deterministic rule layer (Exact + Fee/Rounding Tolerance)
    plain_rules_eval = evaluate_reconciliation(db_conn)
    
    partial_matches = run_partial_matching(db_conn, consumed_settlements, consumed_orders, settings)
    print(f"  - Partial Payment Matches:   {partial_matches}")
    
    split_matches = run_split_matching(db_conn, consumed_settlements, consumed_orders, settings)
    print(f"  - Split/Batch Matches:       {split_matches}")
    
    advanced_matches = run_advanced_matching(db_conn, consumed_settlements, consumed_orders, settings)
    print(f"  - Advanced (Fuzzy/Lag/FX):   {advanced_matches}")
    
    # 4. Fuzzy Shortlisting
    print("\n[Phase 3] Shortlisting Fuzzy Candidates...")
    unmatched_stl_rows = db_conn.execute("""
        SELECT settlement_id, date, amount, utr_reference, payer_account, fees_deducted, net_amount, description, currency
        FROM bank_settlements
    """).fetchall()
    
    unmatched_ledger_rows = db_conn.execute("""
        SELECT order_id, invoice_date, expected_amount, customer_name, customer_reference, expected_settlement_date, tax_amount, currency, status
        FROM internal_ledger
    """).fetchall()
    
    ledger_pool = []
    for r in unmatched_ledger_rows:
        if r[0] not in consumed_orders:
            ledger_pool.append({
                "order_id": r[0], "invoice_date": r[1], "expected_amount": r[2],
                "customer_name": r[3], "customer_reference": r[4],
                "expected_settlement_date": r[5], "tax_amount": r[6],
                "currency": r[7], "status": r[8]
            })
            
    unmatched_stls = []
    candidate_pools_by_stl = {}
    
    for r in unmatched_stl_rows:
        stl_id = r[0]
        if stl_id not in consumed_settlements:
            stl_dict = {
                "settlement_id": r[0], "date": r[1], "amount": r[2],
                "utr_reference": r[3], "payer_account": r[4],
                "fees_deducted": r[5], "net_amount": r[6],
                "description": r[7], "currency": r[8]
            }
            unmatched_stls.append(stl_dict)
            cands = get_top_candidates(stl_dict, ledger_pool, top_k=3)
            candidate_pools_by_stl[stl_id] = cands
            
    print(f"  - Generated candidate shortlists for {len(unmatched_stls)} unmatched settlements.")
    
    # 5. Gemini Agent Verification
    print("\n[Phase 4] Gemini Agent Verification...")
    api_key = os.getenv("GEMINI_API_KEY") or getattr(settings, "gemini_api_key", None)
    cache_path = base_dir / "data" / "llm_cache.json"
    
    agent_stats = {"auto_matched": 0, "needs_review": 0, "exceptions": 0}
    if (api_key and api_key != "your_key_here") or cache_path.exists():
        agent_stats = run_agent_verification(
            db_conn, unmatched_stls, candidate_pools_by_stl,
            consumed_settlements, consumed_orders, settings
        )
        print(f"  - LLM Auto-Matches:       {agent_stats['auto_matched']}")
        print(f"  - LLM Needs Review:      {agent_stats['needs_review']}")
    else:
        print("  - GEMINI_API_KEY missing or set to placeholder. Skipping LLM verification phase.")

    # 6. Exception Classification
    print("\n[Phase 5] Classifying Exceptions...")
    settled_utrs = set()
    try:
        matched_utr_rows = db_conn.execute("""
            SELECT utr_reference FROM bank_settlements WHERE settlement_id IN (SELECT settlement_id FROM audit_log)
        """).fetchall()
        for r in matched_utr_rows:
            if r[0]:
                settled_utrs.add(r[0])
    except Exception:
        pass

    exception_items = []
    for stl in unmatched_stls:
        stl_id = stl["settlement_id"]
        if stl_id not in consumed_settlements:
            cands = candidate_pools_by_stl.get(stl_id, [])
            exc = classify_unmatched_record(stl, cands, settled_references=settled_utrs)
            if exc.is_exception:
                exception_items.append(exc)
                
    print(f"  - Categorized {len(exception_items)} exceptions with reasons and actions.")
    
    # 7. Final Evaluation
    full_eval = evaluate_reconciliation(db_conn)
    
    print("\n" + "=" * 70)
    print("                ACCURACY COMPARISON REPORT")
    print("=" * 70)
    print(f"{'Metric':<30} | {'Plain Rules (Exact/Tol)':<23} | {'Full Pipeline':<15}")
    print("-" * 75)
    print(f"{'Total Bank Settlements':<30} | {plain_rules_eval['total_settlements']:<23} | {full_eval['total_settlements']:<15}")
    print(f"{'System Matches Found':<30} | {plain_rules_eval['system_matches_count']:<23} | {full_eval['system_matches_count']:<15}")
    print(f"{'Match Rate (%)':<30} | {plain_rules_eval['match_rate']*100:<22.2f}% | {full_eval['match_rate']*100:<14.2f}%")
    print(f"{'True Positives (TP)':<30} | {plain_rules_eval['tp']:<23} | {full_eval['tp']:<15}")
    print(f"{'False Positives (FP)':<30} | {plain_rules_eval['fp']:<23} | {full_eval['fp']:<15}")
    print(f"{'False Negatives (FN)':<30} | {plain_rules_eval['fn']:<23} | {full_eval['fn']:<15}")
    print(f"{'Precision (%)':<30} | {plain_rules_eval['precision']*100:<22.2f}% | {full_eval['precision']*100:<14.2f}%")
    print(f"{'Recall (%)':<30} | {plain_rules_eval['recall']*100:<22.2f}% | {full_eval['recall']*100:<14.2f}%")
    print("=" * 70)
    
    if api_key and api_key != "your_key_here":
        print("\nToken Usage Summary:")
        print(f"  - Total API Calls:     {token_usage_tracker['total_api_calls']}")
        print(f"  - Prompt Tokens:       {token_usage_tracker['prompt_tokens']}")
        print(f"  - Candidate Tokens:    {token_usage_tracker['candidates_tokens']}")
        print(f"  - Total Token Usage:   {token_usage_tracker['total_tokens']}")
        print("=" * 60)

    db_conn.close()

if __name__ == "__main__":
    main()
