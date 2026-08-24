import pytest
import duckdb
from src.config_loader import get_settings
from src.ingestion.loader import ingest_bank_settlements, ingest_internal_ledger
from src.matching.exact import run_exact_matching
from src.matching.tolerance import run_tolerance_matching
from src.matching.partial import run_partial_matching
from src.matching.split import run_split_matching
from src.matching.advanced import run_advanced_matching

SAMPLE_BANK_CSV = """settlement_id,date,amount,utr_reference,payer_account,fees_deducted,net_amount,description,currency
STL0001,2026-07-01,1000.00,REF0001,Acme Corp,0.00,1000.00,Payment for ORD0001,INR
STL0002,2026-07-01,1500.00,REF0002,Beta LLC,0.00,1500.00,Payment for ORD0002,INR
STL0003,2026-07-02,500.00,REF0003,Gamma Inc,0.00,500.00,Payment for ORD0003,INR
STL0004,2026-07-02,2000.00,REF0004,Delta Co,0.00,2000.00,Payment for ORD0004,INR
"""

SAMPLE_LEDGER_CSV = """order_id,invoice_date,expected_amount,customer_name,customer_reference,expected_settlement_date,tax_amount,currency,status
ORD0001,2026-07-01,1000.00,Acme Corp,REF0001,2026-07-01,180.00,INR,unsettled
ORD0002,2026-07-01,1500.00,Beta LLC,REF0002,2026-07-01,270.00,INR,unsettled
ORD0003,2026-07-02,500.00,Gamma Inc,REF0003,2026-07-02,90.00,INR,unsettled
ORD0004,2026-07-02,2000.00,Delta Co,REF0004,2026-07-02,360.00,INR,unsettled
"""

@pytest.fixture
def db_conn(tmp_path):
    bank_path = tmp_path / "bank.csv"
    ledger_path = tmp_path / "ledger.csv"
    bank_path.write_text(SAMPLE_BANK_CSV, encoding="utf-8")
    ledger_path.write_text(SAMPLE_LEDGER_CSV, encoding="utf-8")

    conn = duckdb.connect(str(tmp_path / "test.db"))
    ingest_bank_settlements(str(bank_path), conn)
    ingest_internal_ledger(str(ledger_path), conn)
    yield conn
    conn.close()

@pytest.fixture
def settings():
    return get_settings()

def test_full_reconciliation_pipeline(db_conn, settings):
    cs = set()
    co = set()

    exact_count = run_exact_matching(db_conn, cs, co, settings)
    tol_count = run_tolerance_matching(db_conn, cs, co, settings)
    partial_count = run_partial_matching(db_conn, cs, co, settings)
    split_count = run_split_matching(db_conn, cs, co, settings)
    advanced_count = run_advanced_matching(db_conn, cs, co, settings)

    total_matched = len(cs)

    assert exact_count == 4
    assert total_matched == 4
