import os
import csv
import logging
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any
from datetime import datetime
import duckdb
from pydantic import BaseModel, Field, field_validator, ValidationError

# Create logs directory if it doesn't exist
logs_dir = Path(__file__).resolve().parent.parent.parent / "logs"
logs_dir.mkdir(exist_ok=True)

# Set up data quality logger
dq_logger = logging.getLogger("data_quality")
dq_logger.setLevel(logging.WARNING)
dq_handler = logging.FileHandler(logs_dir / "data_quality_issues.log", encoding="utf-8")
dq_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
dq_logger.addHandler(dq_handler)

def parse_amount_to_paise(val: Any) -> int:
    if val is None or str(val).strip() == "":
        raise ValueError("Amount cannot be null or empty")
        
    # If already an integer paise representation (e.g. 18500000)
    if isinstance(val, int):
        return val
        
    s = str(val).strip().replace("Rs.", "").replace("Rs", "").replace("₹", "").replace("INR", "").replace(",", "")
    if not s:
        raise ValueError("Amount cannot be null or empty")
    
    try:
        if "." in s:
            f = float(s)
            return round(f * 100)
        else:
            i = int(s)
            # If input is a large integer like 18500000, it is already stored in paise
            if i > 100000 or i < -100000:
                return i
            return i * 100
    except ValueError:
        raise ValueError(f"Invalid amount format: {val}")

def parse_date(val: Any) -> str:
    if not val or str(val).strip() == "":
        raise ValueError("Date cannot be null or empty")
    
    s = str(val).strip()
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    raise ValueError(f"Invalid date format: {val}")

class BankSettlementRecord(BaseModel):
    settlement_id: str
    date: str
    amount: int  # stored in paise
    utr_reference: Optional[str] = None
    payer_account: str
    fees_deducted: int  # stored in paise
    tax_deducted: Optional[int] = 0  # stored in paise
    net_amount: int  # stored in paise
    description: str
    currency: str

    @field_validator("date", mode="before")
    @classmethod
    def validate_date(cls, v):
        return parse_date(v)

    @field_validator("amount", "fees_deducted", "net_amount", mode="before")
    @classmethod
    def validate_amount(cls, v):
        return parse_amount_to_paise(v)

    @field_validator("tax_deducted", mode="before")
    @classmethod
    def validate_tax(cls, v):
        if v is None or str(v).strip() == "":
            return 0
        return parse_amount_to_paise(v)

    @field_validator("utr_reference", mode="before")
    @classmethod
    def validate_reference(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None

class InternalLedgerRecord(BaseModel):
    order_id: str
    invoice_date: str
    expected_amount: int  # stored in paise
    customer_name: str
    customer_reference: Optional[str] = None
    expected_settlement_date: str
    tax_amount: int  # stored in paise
    currency: str
    status: str

    @field_validator("invoice_date", "expected_settlement_date", mode="before")
    @classmethod
    def validate_date(cls, v):
        return parse_date(v)

    @field_validator("expected_amount", "tax_amount", mode="before")
    @classmethod
    def validate_amount(cls, v):
        return parse_amount_to_paise(v)

    @field_validator("customer_reference", mode="before")
    @classmethod
    def validate_reference(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None

def init_db(db_conn: duckdb.DuckDBPyConnection):
    """Initializes schema in DuckDB."""
    db_conn.execute("""
        CREATE TABLE IF NOT EXISTS bank_settlements (
            settlement_id VARCHAR PRIMARY KEY,
            date VARCHAR,
            amount BIGINT,
            utr_reference VARCHAR,
            payer_account VARCHAR,
            fees_deducted BIGINT,
            tax_deducted BIGINT DEFAULT 0,
            net_amount BIGINT,
            description VARCHAR,
            currency VARCHAR
        );
    """)
    db_conn.execute("""
        CREATE TABLE IF NOT EXISTS internal_ledger (
            order_id VARCHAR PRIMARY KEY,
            invoice_date VARCHAR,
            expected_amount BIGINT,
            customer_name VARCHAR,
            customer_reference VARCHAR,
            expected_settlement_date VARCHAR,
            tax_amount BIGINT,
            currency VARCHAR,
            status VARCHAR
        );
    """)

def ingest_bank_settlements(csv_path: str | Path, db_conn: duckdb.DuckDBPyConnection) -> Dict[str, int]:
    """
    Ingests bank settlements from CSV, validates, deduplicates, and saves to DuckDB.
    """
    init_db(db_conn)
    
    total_records = 0
    valid_records = 0
    invalid_records = 0
    duplicate_records = 0
    
    seen_rows = set()
    valid_rows_to_insert = []
    
    # For reporting duplicates of settlement_id
    seen_settlement_ids = set()

    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=1):
            total_records += 1
            
            # Form standard row tuple representation to find exact duplicates, handling None keys from CSV issues
            row_tuple = tuple(sorted((str(k) if k is not None else "", str(v).strip()) for k, v in row.items()))
            if row_tuple in seen_rows:
                duplicate_records += 1
                dq_logger.warning(f"Row {idx} in bank_settlements is an exact duplicate and was skipped.")
                continue
            seen_rows.add(row_tuple)
            
            try:
                # Validate using Pydantic, filtering out None or non-string keys that can occur on malformed lines
                clean_row = {k: v for k, v in row.items() if isinstance(k, str)}
                record = BankSettlementRecord(**clean_row)
                
                # Check for duplicate settlement_id keys
                if record.settlement_id in seen_settlement_ids:
                    invalid_records += 1
                    dq_logger.warning(f"Row {idx} failed validation: duplicate settlement_id {record.settlement_id}")
                    continue
                seen_settlement_ids.add(record.settlement_id)
                
                valid_rows_to_insert.append(record)
                valid_records += 1
            except ValidationError as e:
                invalid_records += 1
                dq_logger.warning(f"Row {idx} failed validation: {e.errors()}")
            except Exception as e:
                invalid_records += 1
                dq_logger.warning(f"Row {idx} failed validation: {str(e)}")
                
    # Insert valid records to database
    if valid_rows_to_insert:
        db_conn.execute("BEGIN TRANSACTION;")
        for record in valid_rows_to_insert:
            db_conn.execute("""
                INSERT OR REPLACE INTO bank_settlements 
                (settlement_id, date, amount, utr_reference, payer_account, fees_deducted, tax_deducted, net_amount, description, currency)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                record.settlement_id, record.date, record.amount, record.utr_reference,
                record.payer_account, record.fees_deducted, getattr(record, 'tax_deducted', 0) or 0,
                record.net_amount, record.description, record.currency
            ))
        db_conn.execute("COMMIT;")
        
    return {
        "total": total_records,
        "valid": valid_records,
        "invalid": invalid_records,
        "duplicates": duplicate_records
    }

def ingest_internal_ledger(csv_path: str | Path, db_conn: duckdb.DuckDBPyConnection) -> Dict[str, int]:
    """
    Ingests internal ledger orders from CSV, validates, deduplicates, and saves to DuckDB.
    """
    init_db(db_conn)
    
    total_records = 0
    valid_records = 0
    invalid_records = 0
    duplicate_records = 0
    
    seen_rows = set()
    valid_rows_to_insert = []
    
    # For reporting duplicates of order_id
    seen_order_ids = set()

    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=1):
            total_records += 1
            
            # Form standard row tuple representation to find exact duplicates, handling None keys from CSV issues
            row_tuple = tuple(sorted((str(k) if k is not None else "", str(v).strip()) for k, v in row.items()))
            if row_tuple in seen_rows:
                duplicate_records += 1
                dq_logger.warning(f"Row {idx} in internal_ledger is an exact duplicate and was skipped.")
                continue
            seen_rows.add(row_tuple)
            
            try:
                # Validate using Pydantic, filtering out None or non-string keys that can occur on malformed lines
                clean_row = {k: v for k, v in row.items() if isinstance(k, str)}
                record = InternalLedgerRecord(**clean_row)
                
                # Check for duplicate order_id keys
                if record.order_id in seen_order_ids:
                    invalid_records += 1
                    dq_logger.warning(f"Row {idx} failed validation: duplicate order_id {record.order_id}")
                    continue
                seen_order_ids.add(record.order_id)
                
                valid_rows_to_insert.append(record)
                valid_records += 1
            except ValidationError as e:
                invalid_records += 1
                dq_logger.warning(f"Row {idx} failed validation: {e.errors()}")
            except Exception as e:
                invalid_records += 1
                dq_logger.warning(f"Row {idx} failed validation: {str(e)}")
                
    # Insert valid records to database
    if valid_rows_to_insert:
        db_conn.execute("BEGIN TRANSACTION;")
        for record in valid_rows_to_insert:
            db_conn.execute("""
                INSERT OR REPLACE INTO internal_ledger 
                (order_id, invoice_date, expected_amount, customer_name, customer_reference, expected_settlement_date, tax_amount, currency, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                record.order_id, record.invoice_date, record.expected_amount, record.customer_name,
                record.customer_reference, record.expected_settlement_date, record.tax_amount,
                record.currency, record.status
            ))
        db_conn.execute("COMMIT;")
        
    return {
        "total": total_records,
        "valid": valid_records,
        "invalid": invalid_records,
        "duplicates": duplicate_records
    }
