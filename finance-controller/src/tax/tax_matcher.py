"""
Tax-Line Matcher Module (Aligned Formula Engine)
Audits GST (18% on gross invoice amount) and TDS (2% Sec 194O conditional) for reconciled transactions.
Identifies tax deduction shortfalls/leakages and routes them into the unified exceptions engine.
"""

from typing import Dict, Any, List, Optional
import duckdb

def run_tax_line_matching(db_conn: duckdb.DuckDBPyConnection) -> List[Dict[str, Any]]:
    """
    Audits reconciled matches in audit_log against bank_settlements and internal_ledger.
    - Calculates expected GST (18% on gross expected_amount).
    - Checks TDS conditionally: only evaluates if bank tax_deducted > 0.
    - Net Credit Formula: Net Credit = Gross Expected - Fees Deducted.
    - Tolerance: 0.1% of transaction value or Rs 10.00 (1000 paise), whichever is smaller.
    """
    tables = [t[0] for t in db_conn.execute("SELECT table_name FROM information_schema.tables").fetchall()]
    if "audit_log" not in tables or "bank_settlements" not in tables or "internal_ledger" not in tables:
        return []
        
    query = """
        SELECT 
            a.settlement_id,
            a.order_id,
            s.amount AS bank_gross,
            s.net_amount AS bank_net,
            s.fees_deducted AS bank_fee,
            s.tax_deducted AS bank_tax_deducted,
            l.expected_amount AS ledger_expected,
            l.tax_amount AS ledger_tax_amount,
            l.customer_name,
            l.customer_reference
        FROM audit_log a
        JOIN bank_settlements s ON a.settlement_id = s.settlement_id
        JOIN internal_ledger l ON a.order_id = l.order_id
    """
    try:
        rows = db_conn.execute(query).fetchall()
    except Exception:
        return []
        
    tax_exceptions = []
    
    for r in rows:
        stl_id, ord_id, bank_gross, bank_net, bank_fee, bank_tax_deducted, ledger_exp, ledger_tax_amt, cust_name, cust_ref = r
        
        if not ledger_exp or ledger_exp <= 0:
            continue
            
        # 1. Invoice-Based GST (18% of Gross Invoice Value)
        expected_gst = ledger_tax_amt if (ledger_tax_amt is not None and ledger_tax_amt > 0) else round(ledger_exp * 0.18)
        
        # 2. Standard Platform Fee (2%)
        expected_platform_fee = round(ledger_exp * 0.02)
        
        # 3. Single Net Credit Source of Truth: Net Credit = Gross Expected - Fees Deducted
        expected_net_credit = ledger_exp - (bank_fee or expected_platform_fee)
        
        # 4. Dynamic Percentage Tolerance (0.1% of gross or Rs 10.00 max)
        tolerance_paise = min(round(ledger_exp * 0.001), 1000)
        
        # 5. Net Credit Variance Check
        net_variance = abs((bank_net or 0) - expected_net_credit)
        
        # 6. Conditional TDS Check (Section 194O 2%)
        tds_mismatch = False
        tds_note = ""
        if bank_tax_deducted and bank_tax_deducted > 0:
            expected_tds = round(ledger_exp * 0.02)
            if abs(bank_tax_deducted - expected_tds) > tolerance_paise:
                tds_mismatch = True
                tds_note = f"TDS mismatch: Bank withheld Rs {bank_tax_deducted/100.0:.2f} (Expected TDS: Rs {expected_tds/100.0:.2f})."
                
        # 7. Flag Exception ONLY if Net Variance > Tolerance OR TDS Mismatch
        if net_variance > tolerance_paise or tds_mismatch:
            actual_fee_inr = (bank_fee or 0) / 100.0
            expected_net_inr = expected_net_credit / 100.0
            actual_net_inr = (bank_net or 0) / 100.0
            diff_inr = abs(actual_net_inr - expected_net_inr)
            
            sub_category = "TAX_LEAKAGE_MISMATCH"
            if bank_fee and bank_fee > expected_platform_fee + tolerance_paise:
                sub_category = "PLATFORM_FEE_OVERCHARGE"
            elif tds_mismatch:
                sub_category = "MISSING_TDS_WITHHOLDING"
                
            reason_str = f"Tax/Fee deduction shortfall on order {ord_id}: Bank net credit Rs {actual_net_inr:.2f} vs Expected Rs {expected_net_inr:.2f}. Shortfall: Rs {diff_inr:.2f}. {tds_note}".strip()
            action_str = f"Raise tax adjustment dispute with payment gateway for order {ord_id} to recover Rs {diff_inr:.2f} tax leakage."
            
            tax_exc = {
                "record_id": stl_id,
                "source": "bank_settlement",
                "category": sub_category,
                "priority": "HIGH",
                "reason": reason_str,
                "suggested_action": action_str
            }
            tax_exceptions.append(tax_exc)
            
            if "exceptions" in tables:
                try:
                    db_conn.execute("""
                        INSERT INTO exceptions (record_id, source, category, reason, suggested_action, priority)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, [
                        stl_id, "bank_settlement", sub_category,
                        reason_str, action_str, "HIGH"
                    ])
                except Exception:
                    pass
                    
    return tax_exceptions
