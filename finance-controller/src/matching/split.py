import re
import duckdb
from typing import Set, Dict, List
from src.audit.logger import log_match

def run_split_matching(
    db_conn: duckdb.DuckDBPyConnection,
    consumed_settlements: Set[str],
    consumed_orders: Set[str],
    settings
) -> int:
    """
    Reconciles split/batch settlements where a single bank settlement covers multiple ledger orders.
    """
    settlement_rows = db_conn.execute("""
        SELECT settlement_id, date, net_amount, utr_reference, payer_account, description 
        FROM bank_settlements
        ORDER BY date ASC, settlement_id ASC
    """).fetchall()
    
    ledger_rows = db_conn.execute("""
        SELECT order_id, expected_settlement_date, expected_amount, customer_name, customer_reference 
        FROM internal_ledger
    """).fetchall()
    
    # Filter unmatched entries
    unmatched_stls = [s for s in settlement_rows if s[0] not in consumed_settlements]
    unmatched_ledger = [l for l in ledger_rows if l[0] not in consumed_orders]
    
    if not unmatched_stls or not unmatched_ledger:
        return 0
        
    tol_paise = settings.reconciliation.amount_tolerance_paise
    match_count = 0
    
    # Group unmatched ledger orders by customer_name / customer_reference
    ledger_by_cust: Dict[str, List[tuple]] = {}
    for l in unmatched_ledger:
        cust = (l[3] or "").strip().upper()
        if cust:
            ledger_by_cust.setdefault(cust, []).append(l)
            
    for stl in unmatched_stls:
        stl_id = stl[0]
        if stl_id in consumed_settlements:
            continue
            
        payer = (stl[4] or "").strip().upper()
        net_amt = stl[2]
        
        # Check against grouped customer ledger entries
        orders_for_cust = ledger_by_cust.get(payer, [])
        if len(orders_for_cust) >= 2:
            unconsumed_cust_orders = [o for o in orders_for_cust if o[0] not in consumed_orders]
            if len(unconsumed_cust_orders) >= 2:
                total_expected = sum(o[2] for o in unconsumed_cust_orders)
                mdr_fee_paise = round(total_expected * 0.02)
                gst_fee_paise = round(mdr_fee_paise * 0.18)
                total_expected_net = total_expected - mdr_fee_paise - gst_fee_paise
                
                strict_tol_paise = min(tol_paise, 500)
                
                if abs(net_amt - total_expected) <= strict_tol_paise or abs(net_amt - total_expected_net) <= strict_tol_paise:
                    consumed_settlements.add(stl_id)
                    for o in unconsumed_cust_orders:
                        order_id = o[0]
                        consumed_orders.add(order_id)
                        log_match(
                            db_conn, stl_id, order_id, 
                            "SPLIT_COMBINED_SETTLEMENT_MATCH", 
                            confidence=1.0,
                            reason=f"Split Batch Settlement Verified: Settlement {stl_id} (Net ₹{net_amt/100:.2f}) matched batch orders for Payer '{payer}' (Total Gross ₹{total_expected/100:.2f}, Expected Net ₹{total_expected_net/100:.2f})"
                        )
                        match_count += 1
                        
    return match_count
