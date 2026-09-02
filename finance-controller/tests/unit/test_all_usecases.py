import asyncio
import os
from pathlib import Path
from src.agent.solari_investigator import (
    investigate_disputed_utr,
    create_live_vnc_stream,
    post_reconciled_ledger_to_erp,
    download_session_replay
)

def test_usecase_1_evidence_screenshot_capture():
    """Use Case 1: Solari Cloud Browser evidence capture & PIL PNG receipt generation."""
    res = asyncio.run(investigate_disputed_utr(utr_number="STL6051_TEST", target_amount=100000.0))
    assert res["utr"] == "STL6051_TEST"
    assert "screenshot_url" in res
    
    # Verify physical PNG file exists on disk
    screenshot_file = Path(__file__).resolve().parent.parent.parent / "data" / "audit_screenshots" / "STL6051_TEST.png"
    assert screenshot_file.exists()
    assert screenshot_file.stat().st_size > 0

def test_usecase_2_live_vnc_stream():
    """Use Case 2: Solari Desktop Live VNC Stream generation for HITL supervision."""
    res = asyncio.run(create_live_vnc_stream())
    assert "streamUrl" in res
    assert res["streamUrl"] is not None

def test_usecase_3_automated_erp_ledger_posting():
    """Use Case 3: Solari Desktop Agent automated journal entry posting to Tally/ERP."""
    res = asyncio.run(post_reconciled_ledger_to_erp(utr_number="STL6051_TEST", amount=100000.0))
    assert res["status"] == "POSTED_TO_TALLY_ERP"
    assert res["utr_reference"] == "STL6051_TEST"
    assert "HDFC Bank Nodal Account" in res["debit_ledger_1"]

def test_usecase_4_audit_trail_session_replay():
    """Use Case 4: Solari Session Replay (rrweb) download & storage."""
    res = asyncio.run(download_session_replay(session_id="session_stl6051_test"))
    assert "replay_file" in res
    
    replay_file = Path(res["replay_file"])
    assert replay_file.exists()
    assert replay_file.stat().st_size > 0

def test_hitl_approval_saves_to_matched_audit_log():
    """Verifies that clicking Approve & Reconcile logs record to DuckDB audit_log as HUMAN_RECONCILED_SOLARI."""
    import duckdb
    from src.audit.logger import log_match, init_audit_db
    
    conn = duckdb.connect(":memory:")
    init_audit_db(conn)
    log_match(
        conn,
        settlement_id="STL6051_TEST",
        order_id="ORD9982_TEST",
        rule_applied="HUMAN_RECONCILED_SOLARI",
        confidence=1.0,
        reason="Approved via Solari Stream"
    )
    
    rows = conn.execute("SELECT settlement_id, order_id, rule_applied, confidence FROM audit_log WHERE settlement_id = 'STL6051_TEST'").fetchall()
    assert len(rows) == 1
    assert rows[0][0] == "STL6051_TEST"
    assert rows[0][2] == "HUMAN_RECONCILED_SOLARI"
    assert rows[0][3] == 1.0

def test_dynamic_amount_calculations():
    """Verifies that gross, fee (2.36%), and net amounts calculate dynamically for various transaction amounts."""
    res = asyncio.run(investigate_disputed_utr(utr_number="DYNAMIC_50K", target_amount=50000.0))
    assert res["gross_amount"] == 50000.0
    assert res["fee"] == 1180.0
    assert res["net_payout"] == 48820.0

    res_large = asyncio.run(investigate_disputed_utr(utr_number="DYNAMIC_250K", target_amount=250000.0))
    assert res_large["gross_amount"] == 250000.0
    assert res_large["fee"] == 5900.0
    assert res_large["net_payout"] == 244100.0
