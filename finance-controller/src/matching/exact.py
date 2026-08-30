import re
from datetime import datetime
import duckdb
from src.audit.logger import log_match

def run_exact_matching(db_conn: duckdb.DuckDBPyConnection, consumed_settlements: set, consumed_orders: set, settings) -> int:
    """
    Matches bank settlements to ledger entries based on exact normalized reference ID,
    subject to date and amount tolerance thresholds.
    """
    # Fetch bank settlements (selecting net_amount for cash reconciliation check)
    settlements = db_conn.execute("""
        SELECT settlement_id, date, net_amount, utr_reference, description 
        FROM bank_settlements
        ORDER BY date ASC, settlement_id ASC
    """).fetchall()
    
    # Fetch ledger entries
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
    amount_tol_paise = settings.reconciliation.amount_tolerance_paise
    amount_tol_pct = settings.reconciliation.amount_tolerance_percent
    date_tol_days = settings.reconciliation.date_tolerance_days

    for stl in settlements:
        stl_id = stl[0]
        if stl_id in consumed_settlements:
            continue
            
        utr_ref = stl[3]
        
        # If utr_reference is missing, try extracting REFxxxxx from description
        if not utr_ref:
            desc = stl[4] or ""
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
                    
                # Check amount tolerance (integer paise check against net_amount or gross invoice)
                b_net = stl[2]
                l_amt = entry[2]
                
                abs_diff = abs(b_net - l_amt)
                
                # Strict absolute tolerance check in integer paise (<= 500 paise / ₹5.00)
                strict_tol_paise = min(amount_tol_paise, 500)
                passes_abs = abs_diff <= strict_tol_paise
                
                if passes_abs:
                    # Match found!
                    consumed_settlements.add(stl_id)
                    consumed_orders.add(order_id)
                    log_match(
                        db_conn, stl_id, order_id, 
                        "EXACT_REFERENCE_MATCH", 
                        confidence=1.0,
                        reason=f"Exact Reference Verified: Settlement {stl_id} (Ref: '{utr_ref}') matched Order {order_id} (Ref: '{norm_ref}') within {abs_diff} paise variance."
                    )
                    match_count += 1
                    break
                    
    return match_count
