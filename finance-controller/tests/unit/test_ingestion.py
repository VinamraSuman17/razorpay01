import pytest
import duckdb
from pathlib import Path
from src.ingestion.loader import (
    parse_amount_to_paise,
    parse_date,
    ingest_bank_settlements,
    ingest_internal_ledger
)

def test_amount_parsing():
    # Standard decimal floats
    assert parse_amount_to_paise("37181.36") == 3718136
    assert parse_amount_to_paise(37181.36) == 3718136
    # Indian numbering style with commas
    assert parse_amount_to_paise("1,23,456.78") == 12345678
    assert parse_amount_to_paise("12,34,567.89") == 123456789
    # Currency symbols
    assert parse_amount_to_paise("Rs. 500.50") == 50050
    assert parse_amount_to_paise("₹1,000") == 100000
    
    with pytest.raises(ValueError):
        parse_amount_to_paise("invalid_amount")
    with pytest.raises(ValueError):
        parse_amount_to_paise("")

def test_date_parsing():
    # YYYY-MM-DD
    assert parse_date("2026-07-02") == "2026-07-02"
    # DD/MM/YYYY
    assert parse_date("02/07/2026") == "2026-07-02"
    # DD-MM-YYYY
    assert parse_date("02-07-2026") == "2026-07-02"
    
    with pytest.raises(ValueError):
        parse_date("malformed-date")
    with pytest.raises(ValueError):
        parse_date("")

def test_bank_settlements_ingestion_validation():
    # Ingest using our hand-crafted invalid_settlements.csv
    csv_path = Path(__file__).resolve().parent.parent / "fixtures" / "invalid_settlements.csv"
    
    # Connect to in-memory DuckDB
    db_conn = duckdb.connect(":memory:")
    
    stats = ingest_bank_settlements(csv_path, db_conn)
    
    # CSV has 5 data rows (excluding header)
    # Row 1: Valid STL0001
    # Row 2: Valid STL0002 (Indian formatted amount, DD/MM/YYYY date)
    # Row 3: Invalid amount (invalid_amount)
    # Row 4: Invalid date (malformed-date)
    # Row 5: Valid STL0005 (missing reference is OK since it's Optional)
    
    assert stats["total"] == 5
    assert stats["valid"] == 3
    assert stats["invalid"] == 2
    assert stats["duplicates"] == 0
    
    # Query DuckDB to verify insertions
    rows = db_conn.execute("SELECT settlement_id, date, amount, utr_reference FROM bank_settlements ORDER BY settlement_id").fetchall()
    assert len(rows) == 3
    
    # Row 1 (STL0001)
    assert rows[0][0] == "STL0001"
    assert rows[0][1] == "2026-07-02"
    assert rows[0][2] == 3718136
    assert rows[0][3] == "REF79402654"
    
    # Row 2 (STL0002)
    assert rows[1][0] == "STL0002"
    assert rows[1][1] == "2026-07-02"
    assert rows[1][2] == 12345678
    assert rows[1][3] == "REF79402655"

def test_bank_settlements_deduplication():
    csv_path = Path(__file__).resolve().parent.parent / "fixtures" / "duplicate_settlements.csv"
    db_conn = duckdb.connect(":memory:")
    
    stats = ingest_bank_settlements(csv_path, db_conn)
    
    # CSV has 3 data rows. Row 1 and 2 are exact duplicates.
    assert stats["total"] == 3
    assert stats["valid"] == 2
    assert stats["duplicates"] == 1
    
    rows = db_conn.execute("SELECT settlement_id FROM bank_settlements").fetchall()
    assert len(rows) == 2
