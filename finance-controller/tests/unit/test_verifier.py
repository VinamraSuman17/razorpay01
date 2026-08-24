import pytest
from unittest.mock import MagicMock
from types import SimpleNamespace
from src.agent.verifier import verify_single_settlement, VerificationResult

@pytest.fixture
def mock_settings():
    return SimpleNamespace(
        reconciliation=SimpleNamespace(
            amount_tolerance_paise=500,
            amount_tolerance_percent=1.0,
            date_tolerance_days=3
        ),
        thresholds=SimpleNamespace(
            auto_match_confidence=0.85,
            needs_review_confidence=0.50
        ),
        gemini=SimpleNamespace(
            model_name="gemini-2.5-flash",
            requests_per_minute=1000  # High RPM for fast unit testing
        ),
        gemini_api_key="mock_key"
    )

def test_malformed_json_recovery_and_graceful_fallback(mock_settings):
    mock_client = MagicMock()
    
    # First response is malformed text, second response is also malformed
    mock_resp1 = MagicMock()
    mock_resp1.text = "This is invalid non-JSON output!"
    mock_resp1.usage_metadata = None
    
    mock_client.models.generate_content.side_effect = [mock_resp1, mock_resp1]
    
    settlement = {"settlement_id": "STL001", "amount": 10000}
    candidates = [{"order_id": "ORD001", "expected_amount": 10000}]
    
    res = verify_single_settlement(settlement, candidates, mock_settings, client=mock_client)
    
    # Should not crash, returns a no_match result with exception category
    assert res.decision == "no_match"
    assert res.confidence == 0.0
    assert "Failed to parse LLM response" in res.reasoning
    assert res.rule_category == "UNMATCHED_EXCEPTION"
    # Assert it retried once (2 calls total)
    assert mock_client.models.generate_content.call_count == 2

def test_fx_currency_mismatch_tool_calling(mock_settings):
    mock_client = MagicMock()
    
    mock_resp = MagicMock()
    mock_resp.text = '''{
        "decision": "match",
        "matched_order_id": "ORD090",
        "confidence": 0.95,
        "reasoning": "Converted USD $4,000.00 using apply_fx_conversion rate 84.07 to match INR 3,36,286.23",
        "rule_category": "FX_CONVERSION"
    }'''
    mock_resp.usage_metadata = None
    mock_client.models.generate_content.return_value = mock_resp
    
    settlement = {
        "settlement_id": "STL090",
        "amount": 33628623,
        "currency": "INR",
        "description": "UPI/ICIC1855256552/Settlement for REF86131712 (FX converted)"
    }
    candidates = [
        {
            "order_id": "ORD090",
            "customer_reference": "REF86131712",
            "expected_amount": 400000,
            "currency": "USD"
        }
    ]
    
    res = verify_single_settlement(settlement, candidates, mock_settings, client=mock_client)
    
    assert res.decision == "match"
    assert res.matched_order_id == "ORD090"
    assert res.rule_category == "FX_CONVERSION"
    
    # Verify tool registration in client config call
    call_args = mock_client.models.generate_content.call_args
    config = call_args.kwargs["config"]
    assert config.tools is not None
    tool_names = [t.__name__ for t in config.tools]
    assert "apply_fx_conversion" in tool_names
    assert "calculate_fee_adjusted_amount" in tool_names
