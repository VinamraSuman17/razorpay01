import asyncio
from src.agent.solari_investigator import investigate_disputed_utr, create_live_vnc_stream

def test_solari_investigate_fallback():
    result = asyncio.run(investigate_disputed_utr(utr_number="STL0068_TEST", target_amount=50000.0))
    assert result["utr"] == "STL0068_TEST"
    assert "mock_portal_url" in result
    assert result["gross_amount"] == 50000.0

def test_solari_create_live_vnc_stream():
    result = asyncio.run(create_live_vnc_stream())
    assert "streamUrl" in result
    assert result["streamUrl"] is not None
