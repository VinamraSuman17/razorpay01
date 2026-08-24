import pytest
import duckdb
from src.config_loader import get_settings
from src.ingestion.loader import ingest_bank_settlements, ingest_internal_ledger
from src.qa.settlement_qa import (
    extract_entity_and_intent,
    answer_settlement_question
)

SAMPLE_BANK_CSV = """settlement_id,date,amount,utr_reference,payer_account,fees_deducted,net_amount,description,currency
STL0003,2026-07-02,500.00,REF0003,Gamma Inc,11.80,488.20,Payment for ORD0003,INR
STL0068,2026-07-15,1250.00,REF_FUZZY_999,Test User,29.50,1220.50,Payment for ORD0068,INR
STL0093,2026-07-20,3000.00,REF999,Duplicate User,70.80,2929.20,Duplicate Payment for REF999,INR
"""

SAMPLE_LEDGER_CSV = """order_id,invoice_date,expected_amount,customer_name,customer_reference,expected_settlement_date,tax_amount,currency,status
ORD0003,2026-07-02,500.00,Gamma Inc,REF0003,2026-07-02,90.00,INR,unsettled
ORD0068,2026-07-15,1250.00,Test User,REF_FUZZY_999_EXACT,2026-07-15,225.00,INR,unsettled
ORD0093,2026-07-20,3000.00,Duplicate User,REF999,2026-07-20,540.00,INR,unsettled
"""

@pytest.fixture
def db_conn(tmp_path):
    import src.qa.settlement_qa as qa_mod
    qa_mod._qa_cache = {}
    
    bank_path = tmp_path / "bank.csv"
    ledger_path = tmp_path / "ledger.csv"
    bank_path.write_text(SAMPLE_BANK_CSV, encoding="utf-8")
    ledger_path.write_text(SAMPLE_LEDGER_CSV, encoding="utf-8")

    conn = duckdb.connect(str(tmp_path / "test.db"))
    ingest_bank_settlements(str(bank_path), conn)
    ingest_internal_ledger(str(ledger_path), conn)
    
    # Create exceptions table for testing exception joins
    conn.execute("""
        CREATE TABLE IF NOT EXISTS exceptions (
            record_id VARCHAR,
            source VARCHAR,
            category VARCHAR,
            reason VARCHAR,
            suggested_action VARCHAR,
            priority VARCHAR
        )
    """)
    conn.execute("""
        INSERT INTO exceptions VALUES (
            'STL0093', 'bank_settlement', 'DUPLICATE_SETTLEMENT',
            'Bank settlement STL0093 is a duplicate entry for UTR REF999.',
            'Flag settlement STL0093 as duplicate entry', 'HIGH'
        )
    """)
    yield conn
    conn.close()

@pytest.fixture
def settings():
    return get_settings()

def test_extract_entity_and_intent():
    res = extract_entity_and_intent("Show me details for settlement STL0003", get_settings())
    assert isinstance(res, dict)
    assert res["filter_type"] == "settlement_id"
    assert res["value"] == "STL0003"

def test_qa_natural_language_question_settlement(db_conn, settings):
    res = answer_settlement_question("Show me details for settlement STL0003", db_conn, settings)
    assert isinstance(res, dict)
    assert res["data_found"] is True

def test_qa_sql_injection_attempt_handled_safely(db_conn, settings):
    injection_question = "Show settlement STL0003; DROP TABLE bank_settlements; --"
    res = answer_settlement_question(injection_question, db_conn, settings)
    assert isinstance(res, dict)
    
    check_conn = db_conn.execute("SELECT count(*) FROM bank_settlements").fetchone()
    assert check_conn[0] > 0
    
    if res.get("data_found"):
        assert res.get("row_count", 0) < 95

def test_qa_sql_injection_union_handled_safely(db_conn, settings):
    union_payload = "' UNION SELECT * FROM information_schema.tables --"
    res = answer_settlement_question(union_payload, db_conn, settings)
    
    assert isinstance(res, dict)
    assert "information_schema" not in res.get("sql_query", "") or res.get("row_count", 0) == 0

def test_qa_settlement_joins_internal_ledger(db_conn, settings):
    # Populate dummy audit entry
    db_conn.execute("CREATE TABLE IF NOT EXISTS audit_log (settlement_id VARCHAR, order_id VARCHAR, rule_applied VARCHAR, confidence DOUBLE, timestamp VARCHAR)")
    db_conn.execute("INSERT INTO audit_log VALUES ('STL0003', 'ORD0003', 'EXACT_REFERENCE_MATCH', 1.0, '2026-08-23T00:00:00Z')")
    
    res = answer_settlement_question("Show ledger joined details for settlement STL0003", db_conn, settings)
    assert isinstance(res, dict)
    assert res["data_found"] is True
    sql_query = res.get("sql_query", "")
    assert "LEFT JOIN internal_ledger" in sql_query
    assert "customer_reference" in sql_query
    assert "expected_amount" in sql_query
    assert "invoice_date" in sql_query
    assert "expected_settlement_date" in sql_query


