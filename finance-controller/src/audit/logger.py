import json
from datetime import datetime, timezone
from pathlib import Path
import duckdb

from typing import Optional

def init_audit_db(db_conn: duckdb.DuckDBPyConnection):
    """Creates audit_log table in DuckDB if it does not exist."""
    db_conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            settlement_id VARCHAR,
            order_id VARCHAR,
            rule_applied VARCHAR,
            confidence DOUBLE,
            timestamp VARCHAR,
            reason VARCHAR
        );
    """)

def log_match(
    db_conn: duckdb.DuckDBPyConnection,
    settlement_id: str,
    order_id: str,
    rule_applied: str,
    confidence: float = 1.0,
    reason: Optional[str] = None
):
    """
    Records a match immediately to both DuckDB audit_log table and local JSONL audit trail file.
    """
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    # 1. Insert into DuckDB
    init_audit_db(db_conn)
    db_conn.execute("""
        INSERT INTO audit_log (settlement_id, order_id, rule_applied, confidence, timestamp, reason)
        VALUES (?, ?, ?, ?, ?, ?);
    """, (settlement_id, order_id, rule_applied, confidence, timestamp, reason))
    
    # 2. Append to logs/audit_log.jsonl
    logs_dir = Path(__file__).resolve().parent.parent.parent / "logs"
    logs_dir.mkdir(exist_ok=True)
    log_file = logs_dir / "audit_log.jsonl"
    
    record = {
        "settlement_id": settlement_id,
        "order_id": order_id,
        "rule_applied": rule_applied,
        "confidence": confidence,
        "timestamp": timestamp,
        "reason": reason
    }
    
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
