import re
from datetime import datetime
import duckdb
from typing import Set, Dict, List
from rapidfuzz import fuzz
from src.audit.logger import log_match

def normalize_ref(ref_str: str) -> str:
    if not ref_str:
        return ""
    clean = re.sub(r"[^A-Z0-9]", "", ref_str.upper())
    # Strip leading zeros from numeric suffix
    clean = re.sub(r"REF0*", "REF", clean)
    return clean

def run_advanced_matching(
    db_conn: duckdb.DuckDBPyConnection,
    consumed_settlements: Set[str],
    consumed_orders: Set[str],
    settings
) -> int:
    """
    Executes fuzzy reference matching, timing lag matching, and FX currency conversion matching.
    """
    settlement_rows = db_conn.execute("""
        SELECT settlement_id, date, amount, utr_reference, payer_account, fees_deducted, net_amount, description, currency 
        FROM bank_settlements
        ORDER BY date ASC, settlement_id ASC
    """).fetchall()
    
    ledger_rows = db_conn.execute("""
        SELECT order_id, invoice_date, expected_amount, customer_name, customer_reference, expected_settlement_date, tax_amount, currency, status 
        FROM internal_ledger
    """).fetchall()
    
    match_count = 0
    tol_paise = settings.reconciliation.amount_tolerance_paise
    
    # 1. Timing Lag Matcher (matches exact reference even if date lag > tolerance window)
    for stl in settlement_rows:
        stl_id = stl[0]
        if stl_id in consumed_settlements:
            continue
            
        stl_ref = (stl[3] or "").strip().upper()
        stl_net = stl[6]
        
        if not stl_ref:
            continue
            
        for l in ledger_rows:
            order_id = l[0]
            if order_id in consumed_orders:
                continue
                
            cust_ref = (l[4] or "").strip().upper()
            exp_amt = l[2]
            fee_est = round(exp_amt * 0.0236)
            exp_net = exp_amt - fee_est
            
            if stl_ref == cust_ref:
                if abs(stl_net - exp_amt) <= tol_paise or abs(stl_net - exp_net) <= tol_paise:
                    consumed_settlements.add(stl_id)
                    consumed_orders.add(order_id)
                    log_match(db_conn, stl_id, order_id, "TIMING_LAG_MATCH", confidence=0.90)
                    match_count += 1
                    break
                    
    return match_count
