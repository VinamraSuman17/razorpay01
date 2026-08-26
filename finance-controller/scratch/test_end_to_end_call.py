import os
import sys
import json
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from src.agent.verifier import verify_single_settlement
from src.config_loader import get_settings

def test_live_verifier_call():
    print("\n=== Running Live End-to-End Verifier Call ===", flush=True)
    settings = get_settings()
    
    test_settlement = {
        "settlement_id": "STL_LIVE_TEST_001",
        "date": "2026-08-25",
        "amount": 5400.0,
        "utr_reference": "UTR987654321",
        "payer_account": "ACC_MERCHANT_99",
        "fees_deducted": 108.0,
        "net_amount": 5292.0,
        "description": "SETTLEMENT FOR ORDER ORD_LIVE_99",
        "currency": "INR"
    }

    test_candidates = [
        {
            "order_id": "ORD_LIVE_99",
            "settlement_id": "STL_LIVE_TEST_001",
            "amount": 5400.0,
            "status": "pending",
            "utr_reference": "UTR987654321",
            "merchant_id": "MERCH_01"
        }
    ]

    result = verify_single_settlement(
        settlement=test_settlement,
        candidates=test_candidates,
        settings=settings,
        use_cache=False  # Force live API call to test candidate model ladder
    )

    print("\n=== Live Verifier Response Output ===", flush=True)
    print(f"Decision: {result.decision}", flush=True)
    print(f"Confidence: {result.confidence}", flush=True)
    print(f"Rule Category: {result.rule_category}", flush=True)
    print(f"Matched Order ID: {result.matched_order_id}", flush=True)
    print(f"Reasoning: {result.reasoning}", flush=True)
    
    assert result.decision in ["match", "exact_match", "fuzzy_match", "no_match"]
    print("\nSUCCESS: Verification Call Completed Successfully!", flush=True)

if __name__ == "__main__":
    test_live_verifier_call()
