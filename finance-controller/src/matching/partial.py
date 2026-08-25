import re
import duckdb
from typing import Set, Dict, List
from src.audit.logger import log_match

def extract_reference(text: str) -> str:
    if not text:
        return ""
    text = text.strip().upper()
    # Match pattern REF followed by numbers
    match = re.search(r"REF\d+", text)
    if match:
        return match.group(0)
    return text

def run_partial_matching(
    db_conn: duckdb.DuckDBPyConnection,
    consumed_settlements: Set[str],
    consumed_orders: Set[str],
    settings
) -> int:
    """
    Reconciles partial payments where multiple bank settlements sum to one ledger order.
    """
    # Fetch unmatched bank settlements
    settlement_rows = db_conn.execute("""
        SELECT settlement_id, date, net_amount, utr_reference, description 
        FROM bank_settlements
        ORDER BY date ASC, settlement_id ASC
    """).fetchall()
    
    # Fetch unmatched ledger entries
    ledger_rows = db_conn.execute("""
        SELECT order_id, expected_settlement_date, expected_amount, customer_reference, customer_name
        FROM internal_ledger
    """).fetchall()
    
    ledger_by_ref = {}
    for entry in ledger_rows:
        order_id = entry[0]
        if order_id in consumed_orders:
            continue
        ref = extract_reference(entry[3]) or extract_reference(entry[0])
        if ref:
            ledger_by_ref[ref] = entry
            
    # Group unmatched settlements by extracted reference
    stl_groups: Dict[str, List[tuple]] = {}
    for stl in settlement_rows:
        stl_id = stl[0]
        if stl_id in consumed_settlements:
            continue
        ref = extract_reference(stl[3]) or extract_reference(stl[4])
        if stl[4] and "REF" in stl[4].upper():
            ref = extract_reference(stl[4])
        elif stl[3] and "REF" in stl[3].upper():
            ref = extract_reference(stl[3])
            
        if ref:
            stl_groups.setdefault(ref, []).append(stl)
            
    match_count = 0
    tol_paise = settings.reconciliation.amount_tolerance_paise
    
    for ref, stl_list in stl_groups.items():
        if len(stl_list) < 2:
            continue  # Needs multiple settlements to be a partial payment group
            
        ledger_entry = ledger_by_ref.get(ref)
        if not ledger_entry:
            continue
            
        order_id = ledger_entry[0]
        if order_id in consumed_orders:
            continue
            
        expected_amt = ledger_entry[2]
        total_bank_net = sum(s[2] for s in stl_list)
        
        # Calculate expected net after 2.36% platform fee if applicable
        fee_est = round(expected_amt * 0.0236)
        expected_fee_net = expected_amt - fee_est
        
        # Check if total bank net matches expected amount or fee-adjusted expected amount
        if abs(total_bank_net - expected_amt) <= tol_paise or abs(total_bank_net - expected_fee_net) <= tol_paise:
            # Full match for partial bank settlements to this single order
            for stl in stl_list:
                stl_id = stl[0]
                consumed_settlements.add(stl_id)
                log_match(db_conn, stl_id, order_id, "PARTIAL_SETTLEMENT_MATCH", confidence=1.0)
                match_count += 1
            consumed_orders.add(order_id)
        elif total_bank_net > 0 and (expected_fee_net - total_bank_net) < expected_fee_net:
            # Short partial payment match with explicit underpayment flag!
            underpaid_paise = expected_fee_net - total_bank_net
            underpaid_inr = underpaid_paise / 100.0
            for stl in stl_list:
                stl_id = stl[0]
                consumed_settlements.add(stl_id)
                log_match(
                    db_conn, stl_id, order_id, 
                    "PARTIAL_SETTLEMENT_SHORTFALL", 
                    confidence=0.95,
                    reason=f"Partial settlement group underpaid by ₹{underpaid_inr:.2f} (total bank net ₹{total_bank_net/100.0:.2f} vs expected net ₹{expected_fee_net/100.0:.2f})"
                )
                match_count += 1
            consumed_orders.add(order_id)
            
    return match_count
