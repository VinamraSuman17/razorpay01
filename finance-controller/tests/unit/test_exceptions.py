import pytest
from src.exceptions.classifier import classify_unmatched_record

def test_chargeback_reversal_classification():
    settlement = {
        "settlement_id": "STL0093",
        "date": "2026-07-23",
        "amount": -3636084,
        "net_amount": -3636084,
        "utr_reference": "REF16934060",
        "description": "Chargeback reversal of REF16934060",
        "payer_account": "Yohannan, Hegde and Patla"
    }
    
    candidates = []
    settled_refs = {"REF16934060"}
    
    exc = classify_unmatched_record(
        settlement,
        candidates,
        current_date_str="2026-07-25",
        settled_references=settled_refs
    )
    
    assert exc.is_exception is True
    assert exc.category == "CHARGEBACK_REVERSAL"
    assert exc.priority == "HIGH"
    assert "STL0093" in exc.reason
    assert "₹36360.84" in exc.reason
    assert "REF16934060" in exc.reason

def test_duplicate_settlement_classification():
    settlement = {
        "settlement_id": "STL0099",
        "date": "2026-07-24",
        "amount": 100000,
        "net_amount": 100000,
        "utr_reference": "REF28708317",
        "description": "Duplicate payment",
        "payer_account": "Test Merchant"
    }
    
    settled_refs = {"REF28708317"}
    
    exc = classify_unmatched_record(
        settlement,
        candidates=[],
        settled_references=settled_refs
    )
    
    assert exc.is_exception is True
    assert exc.category == "DUPLICATE_SETTLEMENT"
    assert exc.priority == "HIGH"
    assert "duplicate" in exc.reason.lower()
    assert "REF28708317" in exc.reason

def test_future_pending_settlement_not_an_exception():
    ledger_order = {
        "order_id": "ORD0099",
        "invoice_date": "2026-07-25",
        "expected_amount": 500000,
        "customer_name": "Future Client Corp",
        "customer_reference": "REF999999",
        "expected_settlement_date": "2026-08-05"
    }
    
    exc = classify_unmatched_record(
        ledger_order,
        candidates=[],
        current_date_str="2026-07-28"
    )
    
    assert exc.is_exception is False
    assert exc.category == "PENDING_SETTLEMENT"
    assert exc.priority == "LOW"
    assert "ORD0099" in exc.reason
    assert "2026-08-05" in exc.reason

def test_orphan_record_classification():
    settlement = {
        "settlement_id": "STL0091",
        "date": "2026-07-01",
        "amount": 825337,
        "net_amount": 825337,
        "utr_reference": "MISC467737",
        "description": "Unidentified inward transfer",
        "payer_account": "Dhillon, Rajagopal and Halder"
    }
    
    exc = classify_unmatched_record(
        settlement,
        candidates=[],
        current_date_str="2026-07-28"
    )
    
    assert exc.is_exception is True
    assert exc.category == "ORPHAN_BANK_SETTLEMENT"
    assert exc.priority == "MEDIUM"
    assert "STL0091" in exc.reason
    assert "MISC467737" in exc.reason
    assert "₹8253.37" in exc.reason
