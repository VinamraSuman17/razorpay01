import re
from datetime import datetime
import duckdb
from src.audit.logger import log_match

def run_tolerance_matching(db_conn: duckdb.DuckDBPyConnection, consumed_settlements: set, consumed_orders: set, settings) -> int:
    """
    Matches bank settlements to ledger entries based on reference ID where:
      1. net_amount = expected_amount - platform_fee (2.36%)
      2. Or the amounts differ by a small rounding tolerance (amount_tolerance_paise).
    """
    # Fetch unmatched bank settlements
    settlements = db_conn.execute("""
        SELECT settlement_id, date, amount, utr_reference, fees_deducted, net_amount, description 
        FROM bank_settlements
        ORDER BY date ASC, settlement_id ASC
    """).fetchall()
    
    # Fetch unmatched ledger entries
    ledger_entries = db_conn.execute("""
        SELECT order_id, expected_settlement_date, expected_amount, customer_reference 
        FROM internal_ledger
    """).fetchall()
    
    # Map ledger entries by normalized customer_reference
    ledger_by_ref = {}
    for entry in ledger_entries:
        order_id = entry[0]
        if order_id in consumed_orders:
            continue
        cust_ref = entry[3]
        if cust_ref:
            norm_ref = cust_ref.strip().upper()
            ledger_by_ref.setdefault(norm_ref, []).append(entry)
            
    match_count = 0
    date_tol_days = settings.reconciliation.date_tolerance_days
    amount_tol_paise = settings.reconciliation.amount_tolerance_paise

    for stl in settlements:
        stl_id = stl[0]
        if stl_id in consumed_settlements:
            continue
            
        utr_ref = stl[3]
        
        # Extract REFxxxxx from description if missing in utr_reference
        if not utr_ref:
            desc = stl[6] or ""
            match = re.search(r'\b(REF\d+)\b', desc, re.IGNORECASE)
            if match:
                utr_ref = match.group(1)
                
        if not utr_ref:
            continue
            
        norm_ref = utr_ref.strip().upper()
        if norm_ref in ledger_by_ref:
            for entry in ledger_by_ref[norm_ref]:
                order_id = entry[0]
                if order_id in consumed_orders:
                    continue
                
                # Check date tolerance
                b_date_str = stl[1]
                l_date_str = entry[1]
                try:
                    b_dt = datetime.strptime(b_date_str, "%Y-%m-%d")
                    l_dt = datetime.strptime(l_date_str, "%Y-%m-%d")
                    days_diff = abs((b_dt - l_dt).days)
                except Exception:
                    continue
                    
                if days_diff > date_tol_days:
                    continue
                    
                b_net = stl[5]
                b_fees = stl[4]
                l_expected = entry[2]
                
                # Rule 1: Net Amount = Expected Amount - Fee (either formula 2.36% or explicit bank fees_deducted)
                expected_fee = round(l_expected * 0.0236)
                expected_net = l_expected - expected_fee
                
                passes_fee = (b_net == expected_net) or (b_fees > 0 and b_net == l_expected - b_fees)
                passes_rounding = abs(b_net - l_expected) <= amount_tol_paise
                
                if passes_fee:
                    consumed_settlements.add(stl_id)
                    consumed_orders.add(order_id)
                    log_match(db_conn, stl_id, order_id, "FEE_DEDUCTED_MATCH", confidence=1.0)
                    match_count += 1
                    break
                elif passes_rounding:
                    consumed_settlements.add(stl_id)
                    consumed_orders.add(order_id)
                    log_match(db_conn, stl_id, order_id, "ROUNDING_TOLERANCE_MATCH", confidence=1.0)
                    match_count += 1
                    break
                    
    return match_count
