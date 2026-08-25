import pytest
from src.exceptions.classifier import classify_unmatched_record

def test_quota_exhausted_record_classified_as_pending_verification():
    record = {
        "settlement_id": "STL9999",
        "date": "2026-07-31",
        "amount": 10000,
        "net_amount": 10000,
        "utr_reference": "UTR9999",
        "quota_exhausted_reason": "Gemini verification unavailable — quota exhausted, flagged for manual review"
    }
    
    exc = classify_unmatched_record(record, candidates=[])
    
    assert exc.category == "PENDING_VERIFICATION"
    assert exc.priority == "LOW"
    assert exc.is_exception is False
    assert "Awaiting AI verification capacity" in exc.suggested_action
