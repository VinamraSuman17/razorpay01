from typing import Literal, Optional, Dict, Any, List, Set
from datetime import datetime
from pydantic import BaseModel

class ExceptionItem(BaseModel):
    record_id: str
    source: Literal["bank_settlement", "internal_ledger", "tax_line_matcher"]
    category: str
    reason: str
    suggested_action: str
    priority: Literal["HIGH", "MEDIUM", "LOW"]
    is_exception: bool = True

def classify_unmatched_record(
    record: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    current_date_str: str = "2026-07-31",
    settled_references: Optional[Set[str]] = None
) -> ExceptionItem:
    """
    Classifies an unmatched record using context-aware resolution logic,
    producing dynamic, record-specific reasons citing amounts, dates, references,
    candidate discrepancies, and duplicate UTR statuses.
    """
    settled_refs = settled_references or set()
    
    is_bank = "settlement_id" in record
    source_type = "bank_settlement" if is_bank else "internal_ledger"
    rec_id = record.get("settlement_id") if is_bank else record.get("order_id")
    
    # -------------------------------------------------------------
    # Rule 0: Quota Exhausted / Manual Review Flag (Pending Verification)
    # -------------------------------------------------------------
    if record.get("quota_exhausted_reason"):
        return ExceptionItem(
            record_id=rec_id,
            source=source_type,
            category="PENDING_VERIFICATION",
            reason=record["quota_exhausted_reason"],
            suggested_action="Awaiting AI verification capacity. Will resolve automatically on next run.",
            priority="LOW",
            is_exception=False
        )

    # -------------------------------------------------------------
    # Rule 1: Chargeback / Reversal
    # -------------------------------------------------------------
    net_amt_paise = record.get("net_amount", record.get("amount", 0))
    if is_bank and net_amt_paise < 0:
        utr = record.get("utr_reference") or ""
        date = record.get("date") or "N/A"
        desc = record.get("description") or ""
        amt_inr = abs(net_amt_paise) / 100.0
        
        reason = f"Bank settlement {rec_id} on {date} has a negative amount of -₹{amt_inr:.2f} (UTR: '{utr}'), indicating a chargeback or reversal."
        if utr in settled_refs or "Chargeback" in desc or "reversal" in desc.lower():
            reason += f" Transaction references previously settled UTR '{utr or desc}'."
            
        return ExceptionItem(
            record_id=rec_id,
            source=source_type,
            category="CHARGEBACK_REVERSAL",
            reason=reason,
            suggested_action=f"Debit merchant ledger account or file chargeback dispute with acquirer bank for UTR '{utr}'.",
            priority="HIGH",
            is_exception=True
        )

    # -------------------------------------------------------------
    # Rule 2: Duplicate Settlement Entry
    # -------------------------------------------------------------
    utr_ref = record.get("utr_reference") if is_bank else record.get("customer_reference")
    if is_bank and utr_ref and utr_ref in settled_refs:
        date = record.get("date") or "N/A"
        amt_inr = net_amt_paise / 100.0
        return ExceptionItem(
            record_id=rec_id,
            source=source_type,
            category="DUPLICATE_SETTLEMENT",
            reason=f"Bank settlement {rec_id} (₹{amt_inr:.2f}, UTR: '{utr_ref}', Date: {date}) is a duplicate entry for UTR '{utr_ref}' which was already reconciled to an existing order.",
            suggested_action=f"Flag settlement {rec_id} as duplicate entry and reverse duplicate credit in bank reconciliation journal.",
            priority="HIGH",
            is_exception=True
        )

    # -------------------------------------------------------------
    # Rule 3: Future Pending Settlement (Not an exception!)
    # -------------------------------------------------------------
    if not is_bank:
        exp_date_str = record.get("expected_settlement_date")
        exp_amt_paise = record.get("expected_amount", 0)
        exp_amt_inr = exp_amt_paise / 100.0
        cust_ref = record.get("customer_reference") or "N/A"
        
        if exp_date_str:
            try:
                exp_dt = datetime.strptime(exp_date_str, "%Y-%m-%d")
                curr_dt = datetime.strptime(current_date_str, "%Y-%m-%d")
                if exp_dt > curr_dt:
                    return ExceptionItem(
                        record_id=rec_id,
                        source=source_type,
                        category="PENDING_SETTLEMENT",
                        reason=f"Internal order {rec_id} (₹{exp_amt_inr:.2f}, Ref: '{cust_ref}') expected settlement date ({exp_date_str}) is in the future relative to batch date ({current_date_str}).",
                        suggested_action=f"No action required for order {rec_id}. Awaiting expected settlement window ({exp_date_str}).",
                        priority="LOW",
                        is_exception=False
                    )
            except Exception:
                pass

    # -------------------------------------------------------------
    # Rule 4: Ambiguous / Discrepancy with Candidates
    # -------------------------------------------------------------
    if candidates:
        top_cand = candidates[0]
        cand_rec = top_cand.get("record", top_cand)
        
        if is_bank:
            stl_date = record.get("date") or "N/A"
            stl_utr = record.get("utr_reference") or "N/A"
            stl_net_inr = net_amt_paise / 100.0
            bank_fee_paise = record.get("fees_deducted", 0)
            tds_paise = record.get("tax_deducted", 0)
            
            cand_id = cand_rec.get("order_id") or "N/A"
            exp_amt_paise = cand_rec.get("expected_amount", 0)
            exp_amt_inr = exp_amt_paise / 100.0
            fee_est_paise = round(exp_amt_paise * 0.02)
            exp_net_inr = (exp_amt_paise - fee_est_paise) / 100.0
            diff_inr = abs(net_amt_paise - (exp_amt_paise - fee_est_paise)) / 100.0
            
            category = "UNRESOLVED_AMBIGUOUS_DISCREPANCY"
            priority = "MEDIUM"
            
            if bank_fee_paise and bank_fee_paise > fee_est_paise + 500:
                category = "PLATFORM_FEE_OVERCHARGE"
                priority = "HIGH"
                reason = (
                    f"Platform fee overcharge detected on settlement {rec_id} (Order: {cand_id}). "
                    f"Deducted fee ₹{bank_fee_paise/100.0:.2f} exceeds 2.0% contract rate ₹{fee_est_paise/100.0:.2f}."
                )
                action = f"File fee overcharge dispute with payment gateway to recover ₹{(bank_fee_paise - fee_est_paise)/100.0:.2f}."
            elif tds_paise and tds_paise > 0:
                category = "MISSING_TDS_WITHHOLDING"
                priority = "HIGH"
                reason = (
                    f"Sec 194O TDS withholding mismatch on settlement {rec_id} (Order: {cand_id}). "
                    f"Bank tax withheld ₹{tds_paise/100.0:.2f} vs expected ₹{round(exp_amt_paise * 0.02)/100.0:.2f}."
                )
                action = f"Issue revised TDS certificate / tax adjustment note to gateway for order {cand_id}."
            elif "ORPHAN" in stl_utr or "MISSING" in stl_utr:
                category = "MISSING_BANK_CREDIT"
                priority = "HIGH"
                reason = f"Bank settlement {rec_id} on {stl_date} (₹{stl_net_inr:.2f}) has unmapped UTR reference '{stl_utr}'."
                action = f"Contact gateway team to map orphan settlement {rec_id} to internal ERP order."
            else:
                reason = (
                    f"Bank settlement {rec_id} on {stl_date} (net ₹{stl_net_inr:.2f}, UTR: '{stl_utr}') "
                    f"reference matches candidate order {cand_id} (expected ₹{exp_amt_inr:.2f}), "
                    f"but amount differs by ₹{diff_inr:.2f} (expected net after 2% fee ₹{exp_net_inr:.2f})."
                )
                action = f"Review fee agreement or check for unrecorded partial refund/adjustment on order {cand_id}."
        else:
            ord_date = record.get("invoice_date") or "N/A"
            cust_ref = record.get("customer_reference") or "N/A"
            exp_amt_inr = record.get("expected_amount", 0) / 100.0
            
            cand_id = cand_rec.get("settlement_id") or "N/A"
            cand_net_inr = cand_rec.get("net_amount", 0) / 100.0
            diff_inr = abs(record.get("expected_amount", 0) - cand_rec.get("net_amount", 0)) / 100.0
            
            category = "UNRESOLVED_AMBIGUOUS_DISCREPANCY"
            priority = "MEDIUM"
            reason = (
                f"Internal order {rec_id} on {ord_date} (₹{exp_amt_inr:.2f}, Ref: '{cust_ref}') "
                f"partially matches candidate settlement {cand_id} (net ₹{cand_net_inr:.2f}), "
                f"but net amount differs by ₹{diff_inr:.2f}."
            )
            action = f"Verify if candidate settlement {cand_id} included unauthorized fee deductions or partial payment."

        return ExceptionItem(
            record_id=rec_id,
            source=source_type,
            category=category,
            reason=reason,
            suggested_action=action,
            priority=priority,
            is_exception=True
        )

    # -------------------------------------------------------------
    # Rule 5: Orphan Record (No candidates found)
    # -------------------------------------------------------------
    if is_bank:
        stl_date = record.get("date") or "N/A"
        stl_utr = record.get("utr_reference") or record.get("description") or "N/A"
        payer = record.get("payer_account") or "N/A"
        stl_net_inr = net_amt_paise / 100.0
        
        return ExceptionItem(
            record_id=rec_id,
            source=source_type,
            category="ORPHAN_BANK_SETTLEMENT",
            reason=f"Bank settlement {rec_id} on {stl_date} (net ₹{stl_net_inr:.2f}, UTR: '{stl_utr}', Payer: '{payer}') has no matching candidate in internal ledger for reference '{stl_utr}' or amount ₹{stl_net_inr:.2f}.",
            suggested_action=f"Contact payment gateway team to verify if order entry for UTR '{stl_utr}' was omitted from internal ledger.",
            priority="MEDIUM",
            is_exception=True
        )
    else:
        ord_date = record.get("invoice_date") or "N/A"
        cust_name = record.get("customer_name") or "N/A"
        cust_ref = record.get("customer_reference") or "N/A"
        exp_amt_inr = record.get("expected_amount", 0) / 100.0
        
        return ExceptionItem(
            record_id=rec_id,
            source=source_type,
            category="ORPHAN_LEDGER_ORDER",
            reason=f"Internal order {rec_id} created on {ord_date} (expected ₹{exp_amt_inr:.2f}, Customer: '{cust_name}', Ref: '{cust_ref}') has no matching bank settlement for reference '{cust_ref}' or amount ₹{exp_amt_inr:.2f}.",
            suggested_action=f"Verify if customer payment for order {rec_id} failed, was refunded, or was settled under an alternate UTR.",
            priority="MEDIUM",
            is_exception=True
        )
