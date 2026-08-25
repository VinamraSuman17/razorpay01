import pytest
import duckdb
from types import SimpleNamespace
from src.ingestion.loader import init_db
from src.matching.exact import run_exact_matching
from src.matching.tolerance import run_tolerance_matching

@pytest.fixture
def mock_settings():
    return SimpleNamespace(
        reconciliation=SimpleNamespace(
            amount_tolerance_paise=500,       # Rs. 5.00
            amount_tolerance_percent=1.0,     # 1.0%
            date_tolerance_days=3
        )
    )

@pytest.fixture
def db_conn():
    conn = duckdb.connect(":memory:")
    init_db(conn)
    return conn

def test_exact_matching_and_double_match_prevention(db_conn, mock_settings):
    # Insert raw records
    db_conn.execute("""
        INSERT INTO bank_settlements (settlement_id, date, amount, utr_reference, payer_account, fees_deducted, net_amount, description, currency)
        VALUES 
        ('STL001', '2026-07-02', 100000, 'REF100', 'Payer A', 0, 100000, 'Settlement for REF100', 'INR'),
        ('STL002', '2026-07-02', 100000, 'REF100', 'Payer A', 0, 100000, 'Duplicate Settlement for REF100', 'INR');
    """)
    db_conn.execute("""
        INSERT INTO internal_ledger (order_id, invoice_date, expected_amount, customer_name, customer_reference, expected_settlement_date, tax_amount, currency, status)
        VALUES 
        ('ORD001', '2026-07-01', 100000, 'Cust A', 'REF100', '2026-07-02', 0, 'INR', 'pending');
    """)
    
    consumed_settlements = set()
    consumed_orders = set()
    
    # Run exact matching
    matches = run_exact_matching(db_conn, consumed_settlements, consumed_orders, mock_settings)
    
    # Assert exactly 1 match occurred because ORD001 got consumed
    assert matches == 1
    assert "STL001" in consumed_settlements or "STL002" in consumed_settlements
    assert len(consumed_settlements) == 1
    assert "ORD001" in consumed_orders
    
    # Try running matching again, should not match any more
    matches_retry = run_exact_matching(db_conn, consumed_settlements, consumed_orders, mock_settings)
    assert matches_retry == 0

def test_fee_deduction_matching(db_conn, mock_settings):
    # Order expected amount: Rs. 1000.00 (100000 paise)
    # Fee: 2.36% of 100000 = 2360 paise (Rs. 23.60)
    # Net: 97640 paise (Rs. 976.40)
    db_conn.execute("""
        INSERT INTO bank_settlements (settlement_id, date, amount, utr_reference, payer_account, fees_deducted, net_amount, description, currency)
        VALUES 
        ('STL003', '2026-07-02', 100000, 'REF200', 'Payer B', 2360, 97640, 'Settlement for REF200', 'INR');
    """)
    db_conn.execute("""
        INSERT INTO internal_ledger (order_id, invoice_date, expected_amount, customer_name, customer_reference, expected_settlement_date, tax_amount, currency, status)
        VALUES 
        ('ORD002', '2026-07-01', 100000, 'Cust B', 'REF200', '2026-07-02', 0, 'INR', 'pending');
    """)
    
    consumed_settlements = set()
    consumed_orders = set()
    
    # First verify EXACT matching doesn't match it because amount difference (2360 paise) > absolute tolerance (500 paise)
    # and > percentage tolerance (1% of 100000 = 1000 paise)
    exact_matches = run_exact_matching(db_conn, consumed_settlements, consumed_orders, mock_settings)
    assert exact_matches == 0
    
    # Run tolerance matching, which should successfully identify the 2.36% fee deduction match
    tol_matches = run_tolerance_matching(db_conn, consumed_settlements, consumed_orders, mock_settings)
    assert tol_matches == 1
    assert "STL003" in consumed_settlements
    assert "ORD002" in consumed_orders

def test_out_of_tolerance_no_match(db_conn, mock_settings):
    # Settlement with date 2026-07-10 (differs from expected settlement date 2026-07-02 by 8 days, tolerance is 3 days)
    db_conn.execute("""
        INSERT INTO bank_settlements (settlement_id, date, amount, utr_reference, payer_account, fees_deducted, net_amount, description, currency)
        VALUES 
        ('STL004', '2026-07-10', 100000, 'REF300', 'Payer C', 0, 100000, 'Settlement for REF300', 'INR');
    """)
    # Settlement with amount off by Rs. 10.00 (1000 paise, tolerance is Rs. 5.00 / 500 paise)
    db_conn.execute("""
        INSERT INTO bank_settlements (settlement_id, date, amount, utr_reference, payer_account, fees_deducted, net_amount, description, currency)
        VALUES 
        ('STL005', '2026-07-02', 102000, 'REF400', 'Payer C', 0, 102000, 'Settlement for REF400', 'INR');
    """)
    db_conn.execute("""
        INSERT INTO internal_ledger (order_id, invoice_date, expected_amount, customer_name, customer_reference, expected_settlement_date, tax_amount, currency, status)
        VALUES 
        ('ORD003', '2026-07-01', 100000, 'Cust C', 'REF300', '2026-07-02', 0, 'INR', 'pending'),
        ('ORD004', '2026-07-01', 100000, 'Cust C', 'REF400', '2026-07-02', 0, 'INR', 'pending');
    """)
    
    consumed_settlements = set()
    consumed_orders = set()
    
    # Exact matcher should skip both due to date & amount tolerance violations
    assert run_exact_matching(db_conn, consumed_settlements, consumed_orders, mock_settings) == 0
    # Tolerance matcher should skip both because date limit is exceeded or rounding exceeds 500 paise limit
    assert run_tolerance_matching(db_conn, consumed_settlements, consumed_orders, mock_settings) == 0

def test_money_tolerance_boundaries(db_conn, mock_settings):
    from src.matching.tolerance import run_tolerance_matching
    # Settlement 1: Exactly 500 paise (Rs. 5.00) diff -> MATCHES
    # Settlement 2: Exactly 501 paise diff -> NO MATCH
    db_conn.execute("""
        INSERT INTO bank_settlements (settlement_id, date, amount, utr_reference, payer_account, fees_deducted, net_amount, description, currency)
        VALUES 
        ('STL_TOL_500', '2026-07-02', 100500, 'REF_500', 'Payer T1', 0, 100500, 'Exact 500 paise diff', 'INR'),
        ('STL_TOL_501', '2026-07-02', 100501, 'REF_501', 'Payer T2', 0, 100501, '501 paise diff', 'INR');
    """)
    db_conn.execute("""
        INSERT INTO internal_ledger (order_id, invoice_date, expected_amount, customer_name, customer_reference, expected_settlement_date, tax_amount, currency, status)
        VALUES 
        ('ORD_TOL_500', '2026-07-01', 100000, 'Cust T1', 'REF_500', '2026-07-02', 0, 'INR', 'pending'),
        ('ORD_TOL_501', '2026-07-01', 100000, 'Cust T2', 'REF_501', '2026-07-02', 0, 'INR', 'pending');
    """)
    
    # Run tolerance matching
    matched = run_tolerance_matching(db_conn, set(), set(), mock_settings)
    assert matched == 1
    
    # Check audit log
    matched_stls = [r[0] for r in db_conn.execute("SELECT settlement_id FROM audit_log").fetchall()]
    assert "STL_TOL_500" in matched_stls
    assert "STL_TOL_501" not in matched_stls

def test_partial_matcher_guards(db_conn, mock_settings):
    from src.matching.partial import run_partial_matching
    from src.audit.logger import init_audit_db
    init_audit_db(db_conn)
    # Settlement 1 & 2 (zero/neg): Group with zero/neg net amount -> REJECTED from shortfall match
    # Settlement 3 & 4 (partial group): Two partial settlements (30000 + 20000 = 50000 paise vs expected net ~97640 paise) -> ACCEPTED
    db_conn.execute("""
        INSERT INTO bank_settlements (settlement_id, date, amount, utr_reference, payer_account, fees_deducted, net_amount, description, currency)
        VALUES 
        ('STL_ZERO_1', '2026-07-02', 0, 'REF_ZERO', 'Payer Z', 0, 0, 'Zero amount 1', 'INR'),
        ('STL_ZERO_2', '2026-07-02', 0, 'REF_ZERO', 'Payer Z', 0, 0, 'Zero amount 2', 'INR'),
        ('STL_NEG_1', '2026-07-02', -2500, 'REF_NEG', 'Payer N', 0, -2500, 'Negative chargeback 1', 'INR'),
        ('STL_NEG_2', '2026-07-02', -2500, 'REF_NEG', 'Payer N', 0, -2500, 'Negative chargeback 2', 'INR'),
        ('STL_PARTIAL_1', '2026-07-02', 30000, 'REF_PARTIAL', 'Payer P', 0, 30000, 'Partial payment 1', 'INR'),
        ('STL_PARTIAL_2', '2026-07-02', 20000, 'REF_PARTIAL', 'Payer P', 0, 20000, 'Partial payment 2', 'INR');
    """)
    db_conn.execute("""
        INSERT INTO internal_ledger (order_id, invoice_date, expected_amount, customer_name, customer_reference, expected_settlement_date, tax_amount, currency, status)
        VALUES 
        ('ORD_ZERO', '2026-07-01', 100000, 'Cust Z', 'REF_ZERO', '2026-07-02', 0, 'INR', 'pending'),
        ('ORD_NEG', '2026-07-01', 100000, 'Cust N', 'REF_NEG', '2026-07-02', 0, 'INR', 'pending'),
        ('ORD_PARTIAL', '2026-07-01', 100000, 'Cust P', 'REF_PARTIAL', '2026-07-02', 0, 'INR', 'pending');
    """)
    
    run_partial_matching(db_conn, set(), set(), mock_settings)
    
    matched_stls = [r[0] for r in db_conn.execute("SELECT settlement_id FROM audit_log WHERE rule_applied = 'PARTIAL_SETTLEMENT_SHORTFALL'").fetchall()]
    assert "STL_PARTIAL_1" in matched_stls
    assert "STL_PARTIAL_2" in matched_stls
    assert "STL_ZERO_1" not in matched_stls
    assert "STL_NEG_1" not in matched_stls
