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
