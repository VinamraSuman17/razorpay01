import os
import time
import logging
import traceback
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from contextlib import contextmanager
import duckdb
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError
import csv
import io
from datetime import datetime

from src.config_loader import get_settings, mask_api_key, reload_environment
from src.ingestion.loader import BankSettlementRecord, InternalLedgerRecord, ingest_bank_settlements, ingest_internal_ledger
from src.matching.exact import run_exact_matching
from src.matching.tolerance import run_tolerance_matching
from src.matching.partial import run_partial_matching
from src.matching.split import run_split_matching
from src.matching.advanced import run_advanced_matching
from src.matching.fuzzy import get_top_candidates
from src.agent.verifier import run_agent_verification, token_usage_tracker
from src.exceptions.classifier import classify_unmatched_record, ExceptionItem
from src.evaluation.evaluator import evaluate_reconciliation
from src.qa.settlement_qa import answer_settlement_question

logger = logging.getLogger(__name__)

# Ensure fresh .env reload on server startup
_loaded_files = reload_environment()
_startup_settings = get_settings()
_active_api_key = os.getenv("GEMINI_API_KEY") or getattr(_startup_settings, "gemini_api_key", None)
_masked_key = mask_api_key(_active_api_key)

startup_msg = f"[SERVER STARTUP] Gemini API Key loaded: {_masked_key} (active .env sources: {_loaded_files})"
logger.info(startup_msg)
print(startup_msg)

app = FastAPI(
    title="AI Finance Controller API",
    description="Fintech reconciliation engine with LLM verification and exception classification",
    version="1.0.0"
)

# CORS middleware with explicit origins from ALLOWED_ORIGINS env var or defaults
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174")
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@contextmanager
def db_connection(read_only: bool = False):
    base_dir = Path(__file__).resolve().parent.parent
    db_path = base_dir / "data" / "reconciliation.db"
    db_path.parent.mkdir(exist_ok=True, parents=True)
    
    conn = None
    for attempt in range(3):
        try:
            conn = duckdb.connect(str(db_path), read_only=read_only)
            break
        except duckdb.IOException:
            if read_only:
                try:
                    conn = duckdb.connect(str(db_path), read_only=True)
                    break
                except duckdb.IOException:
                    pass
            time.sleep(0.2)
            
    if conn is None:
        try:
            conn = duckdb.connect(str(db_path), read_only=True)
        except duckdb.IOException:
            conn = duckdb.connect(":memory:")
            
    try:
        yield conn
    finally:
        if conn:
            conn.close()

def get_db():
    base_dir = Path(__file__).resolve().parent.parent
    db_path = base_dir / "data" / "reconciliation.db"
    db_path.parent.mkdir(exist_ok=True, parents=True)
    return duckdb.connect(str(db_path))

CURRENT_BATCH_DIR: Optional[Path] = None

def resolve_current_batch_dir() -> Optional[Path]:
    global CURRENT_BATCH_DIR
    if CURRENT_BATCH_DIR and CURRENT_BATCH_DIR.exists() and (CURRENT_BATCH_DIR / "bank_settlements.csv").exists() and (CURRENT_BATCH_DIR / "internal_ledger.csv").exists():
        return CURRENT_BATCH_DIR
    
    base_dir = Path(__file__).resolve().parent.parent
    uploads_dir = base_dir / "data" / "uploads"
    if uploads_dir.exists():
        matching_dirs = sorted(
            [
                d for d in uploads_dir.glob("batch_*")
                if d.is_dir() and (d / "bank_settlements.csv").exists() and (d / "internal_ledger.csv").exists()
            ],
            key=lambda d: d.name,
            reverse=True
        )
        if matching_dirs:
            CURRENT_BATCH_DIR = matching_dirs[0]
            return CURRENT_BATCH_DIR
            
    return None

# Pydantic Request / Response Models
class RunBatchResponse(BaseModel):
    total_bank_settlements: int
    matched_count: int
    match_rate_percent: float
    exception_count: int
    needs_review_count: int
    pending_verification_count: int = 0
    execution_time_seconds: float
    token_usage: Dict[str, int]
    precision_percent: float
    recall_percent: float

class MatchRecord(BaseModel):
    settlement_id: str
    order_id: str
    rule_applied: str
    confidence: float
    timestamp: str

class UploadBatchResponse(BaseModel):
    batch_id: str
    message: str
    bank_valid_records: int
    bank_invalid_records: int
    ledger_valid_records: int
    ledger_invalid_records: int
    validation_warnings: Optional[List[str]] = None
    summary: RunBatchResponse

class AskRequest(BaseModel):
    question: str

class AskResponse(BaseModel):
    answer: str
    sql_query: Optional[str] = None
    extracted_entity: Optional[Dict[str, Any]] = None
    data_found: bool = False

def validate_csv_content(csv_bytes: bytes, model_class, id_field: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Validates raw CSV bytes using Pydantic schemas line-by-line."""
    valid_records = []
    errors = []
    
    try:
        text_content = csv_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text_content = csv_bytes.decode("latin1")
        
    reader = csv.DictReader(io.StringIO(text_content))
    if not reader.fieldnames:
        return [], ["CSV file is completely empty or missing column headers."]
        
    for line_num, row in enumerate(reader, start=2):
        if not any(row.values()):
            continue
        try:
            record_obj = model_class(**row)
            valid_records.append(record_obj.model_dump())
        except ValidationError as ve:
            rec_id = row.get(id_field, f"Row {line_num}")
            err_details = "; ".join([f"{e['loc'][0]}: {e['msg']}" for e in ve.errors()])
            errors.append(f"Row {line_num} (ID: {rec_id}): {err_details}")
        except Exception as ex:
            errors.append(f"Row {line_num}: Unexpected parsing error: {str(ex)}")
            
    return valid_records, errors

def run_full_pipeline(bank_csv_path: Optional[Path] = None, ledger_csv_path: Optional[Path] = None) -> Dict[str, Any]:
    """Runs full end-to-end reconciliation pipeline."""
    start_time = time.time()
    settings = get_settings()
    base_dir = Path(__file__).resolve().parent.parent
    
    if not bank_csv_path or not ledger_csv_path:
        batch_dir = resolve_current_batch_dir()
        if not batch_dir:
            raise HTTPException(
                status_code=400,
                detail="No dataset uploaded yet. Please upload Bank Settlements and Internal Ledger CSV files first."
            )
        bank_csv_path = batch_dir / "bank_settlements.csv"
        ledger_csv_path = batch_dir / "internal_ledger.csv"
        
    if not bank_csv_path.exists() or not ledger_csv_path.exists():
        raise HTTPException(
            status_code=400,
            detail="Dataset CSV files do not exist. Please upload Bank Settlements and Internal Ledger CSV files."
        )

    with db_connection() as db_conn:
        # Re-initialize DuckDB tables
        db_conn.execute("DROP TABLE IF EXISTS bank_settlements")
        db_conn.execute("DROP TABLE IF EXISTS internal_ledger")
        db_conn.execute("DROP TABLE IF EXISTS audit_log")
        db_conn.execute("DROP TABLE IF EXISTS exceptions")

        ingest_bank_settlements(str(bank_csv_path), db_conn)
        ingest_internal_ledger(str(ledger_csv_path), db_conn)

        consumed_settlements = set()
        consumed_orders = set()

        # 1. Exact Reference Matcher
        run_exact_matching(db_conn, consumed_settlements, consumed_orders, settings)

        # 2. Tolerance Matcher
        run_tolerance_matching(db_conn, consumed_settlements, consumed_orders, settings)

        # 3. Partial Payment Matcher
        run_partial_matching(db_conn, consumed_settlements, consumed_orders, settings)

        # 4. Split Settlement Matcher
        run_split_matching(db_conn, consumed_settlements, consumed_orders, settings)

        # 5. Advanced Matching Suite (Fee deductions & FX currency)
        run_advanced_matching(db_conn, consumed_settlements, consumed_orders, settings)

        # Prepare unmatched records & candidates for Gemini verification agent
        matched_stls_rows = db_conn.execute("SELECT settlement_id FROM audit_log").fetchall()
        consumed_settlements = set(r[0] for r in matched_stls_rows)

        matched_ords_rows = db_conn.execute("SELECT order_id FROM audit_log").fetchall()
        consumed_orders = set(r[0] for r in matched_ords_rows)

        unmatched_stls_rows = db_conn.execute("""
            SELECT settlement_id, date, amount, utr_reference, payer_account, fees_deducted, net_amount, description, currency
            FROM bank_settlements
        """).fetchall()

        unmatched_stls = []
        for r in unmatched_stls_rows:
            if r[0] not in consumed_settlements:
                unmatched_stls.append({
                    "settlement_id": r[0], "date": r[1], "amount": r[2],
                    "utr_reference": r[3], "payer_account": r[4],
                    "fees_deducted": r[5], "net_amount": r[6],
                    "description": r[7], "currency": r[8]
                })

        unmatched_ords_rows = db_conn.execute("""
            SELECT order_id, invoice_date, expected_amount, customer_name, customer_reference, expected_settlement_date, tax_amount, currency, status
            FROM internal_ledger
        """).fetchall()

        candidate_ledger_pool = []
        for r in unmatched_ords_rows:
            if r[0] not in consumed_orders:
                candidate_ledger_pool.append({
                    "order_id": r[0], "invoice_date": r[1], "expected_amount": r[2],
                    "customer_name": r[3], "customer_reference": r[4],
                    "expected_settlement_date": r[5], "tax_amount": r[6],
                    "currency": r[7], "status": r[8]
                })

        candidate_pools_by_stl = {}
        for stl in unmatched_stls:
            candidates = get_top_candidates(stl, candidate_ledger_pool, top_k=3, min_score_threshold=0.35)
            candidate_pools_by_stl[stl["settlement_id"]] = candidates

        # Gemini Agent Verification Loop
        agent_stats = {"auto_matched": 0, "needs_review": 0, "exceptions": 0}
        api_key = os.getenv("GEMINI_API_KEY") or getattr(settings, "gemini_api_key", None)
        cache_path = base_dir / "data" / "llm_cache.json"
        if (api_key and api_key != "your_key_here") or cache_path.exists():
            agent_stats = run_agent_verification(
                db_conn, unmatched_stls, candidate_pools_by_stl,
                consumed_settlements, consumed_orders, settings
            )
            
        # 6. Exceptions Classification
        settled_utrs = set()
        try:
            matched_utr_rows = db_conn.execute("""
                SELECT utr_reference FROM bank_settlements WHERE settlement_id IN (SELECT settlement_id FROM audit_log)
            """).fetchall()
            for r in matched_utr_rows:
                if r[0]:
                    settled_utrs.add(r[0])
        except Exception:
            pass

        exception_items = []
        pending_verification_items = []
        for stl in unmatched_stls:
            stl_id = stl["settlement_id"]
            if stl_id not in consumed_settlements:
                cands = candidate_pools_by_stl.get(stl_id, [])
                exc = classify_unmatched_record(stl, cands, settled_references=settled_utrs)
                if exc.category == "PENDING_VERIFICATION" or not exc.is_exception:
                    pending_verification_items.append(exc)
                else:
                    exception_items.append(exc)
                    
        # Persist genuine exceptions into DuckDB exceptions table
        db_conn.execute("DROP TABLE IF EXISTS exceptions")
        db_conn.execute("""
            CREATE TABLE exceptions (
                record_id VARCHAR,
                source VARCHAR,
                category VARCHAR,
                reason VARCHAR,
                suggested_action VARCHAR,
                priority VARCHAR
            )
        """)
        for exc in exception_items:
            db_conn.execute("""
                INSERT INTO exceptions (record_id, source, category, reason, suggested_action, priority)
                VALUES (?, ?, ?, ?, ?, ?)
            """, [
                exc.record_id, exc.source, exc.category, exc.reason, exc.suggested_action, exc.priority
            ])

        # Persist pending verification records into DuckDB pending_verifications table
        db_conn.execute("DROP TABLE IF EXISTS pending_verifications")
        db_conn.execute("""
            CREATE TABLE pending_verifications (
                record_id VARCHAR,
                source VARCHAR,
                category VARCHAR,
                reason VARCHAR,
                suggested_action VARCHAR
            )
        """)
        for exc in pending_verification_items:
            db_conn.execute("""
                INSERT INTO pending_verifications (record_id, source, category, reason, suggested_action)
                VALUES (?, ?, ?, ?, ?)
            """, [
                exc.record_id, exc.source, exc.category, exc.reason, exc.suggested_action
            ])

        # 7. Evaluate metrics
        eval_stats = evaluate_reconciliation(db_conn)
        elapsed = time.time() - start_time
        
        return {
            "summary": RunBatchResponse(
                total_bank_settlements=eval_stats["total_settlements"],
                matched_count=eval_stats["system_matches_count"],
                match_rate_percent=round(eval_stats["match_rate"] * 100, 2),
                exception_count=len(exception_items),
                needs_review_count=agent_stats.get("needs_review", 0),
                pending_verification_count=len(pending_verification_items),
                execution_time_seconds=round(elapsed, 2),
                token_usage=token_usage_tracker,
                precision_percent=round(eval_stats["precision"] * 100, 2),
                recall_percent=round(eval_stats["recall"] * 100, 2)
            ),
            "exceptions": exception_items,
            "pending_verifications": pending_verification_items
        }

@app.get("/health")
def health_endpoint():
    return {"status": "ok"}

@app.post("/upload-batch", response_model=UploadBatchResponse)
def upload_batch_endpoint(
    bank_file: UploadFile = File(...),
    ledger_file: UploadFile = File(...)
):
    global CURRENT_BATCH_DIR
    req_id = f"req_{int(time.time()*1000)}"
    try:
        bank_name = (bank_file.filename or "").lower()
        ledger_name = (ledger_file.filename or "").lower()
        if not bank_name.endswith(".csv") or not ledger_name.endswith(".csv"):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. File must be a CSV (.csv)."
            )
            
        bank_bytes = bank_file.file.read()
        ledger_bytes = ledger_file.file.read()
        
        if len(bank_bytes) == 0 or len(ledger_bytes) == 0:
            raise HTTPException(
                status_code=400,
                detail="File is empty. Uploaded CSV files must contain data."
            )
            
        max_bytes = 10 * 1024 * 1024
        if len(bank_bytes) > max_bytes or len(ledger_bytes) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail="File too large. Maximum allowed size per file is 10 MB."
            )
        
        bank_valid, bank_errors = validate_csv_content(bank_bytes, BankSettlementRecord, "settlement_id")
        ledger_valid, ledger_errors = validate_csv_content(ledger_bytes, InternalLedgerRecord, "order_id")
        
        all_fatal_errors = []
        if len(bank_valid) == 0:
            err_msg = "\n".join(bank_errors) if bank_errors else "No valid records found in Bank Settlements CSV."
            all_fatal_errors.append(f"Bank Settlements CSV Validation Failed:\n{err_msg}")
        if len(ledger_valid) == 0:
            err_msg = "\n".join(ledger_errors) if ledger_errors else "No valid records found in Internal Ledger CSV."
            all_fatal_errors.append(f"Internal Ledger CSV Validation Failed:\n{err_msg}")
            
        if all_fatal_errors:
            raise HTTPException(
                status_code=400,
                detail="\n\n".join(all_fatal_errors)
            )
            
        batch_id = datetime.now().strftime("batch_%Y%m%d_%H%M%S")
        base_dir = Path(__file__).resolve().parent.parent
        batch_dir = base_dir / "data" / "uploads" / batch_id
        batch_dir.mkdir(parents=True, exist_ok=True)
        
        bank_path = batch_dir / "bank_settlements.csv"
        ledger_path = batch_dir / "internal_ledger.csv"
        
        if bank_valid:
            fieldnames = list(bank_valid[0].keys())
            with open(bank_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(bank_valid)
        else:
            with open(bank_path, "wb") as f:
                f.write(bank_bytes)
                
        if ledger_valid:
            fieldnames = list(ledger_valid[0].keys())
            with open(ledger_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(ledger_valid)
        else:
            with open(ledger_path, "wb") as f:
                f.write(ledger_bytes)
                
        CURRENT_BATCH_DIR = batch_dir
        pipeline_res = run_full_pipeline(bank_csv_path=bank_path, ledger_csv_path=ledger_path)
        
        warnings = []
        if bank_errors:
            warnings.extend([f"[Bank Settlements] {e}" for e in bank_errors])
        if ledger_errors:
            warnings.extend([f"[Internal Ledger] {e}" for e in ledger_errors])
            
        msg = f"Batch {batch_id} validated ({len(bank_valid)} bank rows, {len(ledger_valid)} ledger rows) and reconciled."
        if warnings:
            msg += f" {len(warnings)} row(s) were rejected due to validation errors."
            
        return UploadBatchResponse(
            batch_id=batch_id,
            message=msg,
            bank_valid_records=len(bank_valid),
            bank_invalid_records=len(bank_errors),
            ledger_valid_records=len(ledger_valid),
            ledger_invalid_records=len(ledger_errors),
            validation_warnings=warnings if warnings else None,
            summary=pipeline_res["summary"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[{req_id}] Internal server error during upload_batch_endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error. Check server logs. (Request ID: {req_id})"
        )

@app.post("/run-batch", response_model=RunBatchResponse)
def run_batch_endpoint():
    req_id = f"req_{int(time.time()*1000)}"
    try:
        batch_dir = resolve_current_batch_dir()
        if not batch_dir:
            raise HTTPException(
                status_code=400,
                detail="No dataset uploaded yet. Please upload Bank Settlements and Internal Ledger CSV files first."
            )
        bank_p = batch_dir / "bank_settlements.csv"
        ledger_p = batch_dir / "internal_ledger.csv"
        pipeline_res = run_full_pipeline(bank_csv_path=bank_p, ledger_csv_path=ledger_p)
        return pipeline_res["summary"]
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[{req_id}] Internal server error during run_batch_endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error. Check server logs. (Request ID: {req_id})"
        )

@app.get("/matches", response_model=List[MatchRecord])
def get_matches_endpoint():
    req_id = f"req_{int(time.time()*1000)}"
    try:
        with db_connection(read_only=True) as db_conn:
            table_exists = db_conn.execute("""
                SELECT count(*) FROM information_schema.tables WHERE table_name = 'audit_log'
            """).fetchone()[0]
            
            if table_exists == 0:
                return []
                
            rows = db_conn.execute("""
                SELECT settlement_id, order_id, rule_applied, confidence, timestamp 
                FROM audit_log ORDER BY timestamp DESC
            """).fetchall()
            
            return [
                MatchRecord(
                    settlement_id=r[0],
                    order_id=r[1],
                    rule_applied=r[2],
                    confidence=r[3],
                    timestamp=r[4]
                )
                for r in rows
            ]
    except Exception as e:
        logger.exception(f"[{req_id}] Internal server error during get_matches_endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error. Check server logs. (Request ID: {req_id})"
        )

@app.get("/exceptions", response_model=List[ExceptionItem])
def get_exceptions_endpoint():
    req_id = f"req_{int(time.time()*1000)}"
    try:
        with db_connection(read_only=True) as db_conn:
            table_exists = db_conn.execute("""
                SELECT count(*) FROM information_schema.tables WHERE table_name = 'exceptions'
            """).fetchone()[0]
            
            if table_exists > 0:
                rows = db_conn.execute("""
                    SELECT record_id, source, category, reason, suggested_action, priority
                    FROM exceptions
                """).fetchall()
                return [
                    ExceptionItem(
                        record_id=r[0],
                        source=r[1],
                        category=r[2],
                        reason=r[3],
                        suggested_action=r[4],
                        priority=r[5],
                        is_exception=True
                    )
                    for r in rows
                ]
                
            # Fallback if exceptions table is missing
            bank_table_exists = db_conn.execute("""
                SELECT count(*) FROM information_schema.tables WHERE table_name = 'bank_settlements'
            """).fetchone()[0]
            if bank_table_exists == 0:
                return []
                
            matched_stls = set()
            settled_utrs = set()
            audit_exists = db_conn.execute("""
                SELECT count(*) FROM information_schema.tables WHERE table_name = 'audit_log'
            """).fetchone()[0]
            if audit_exists > 0:
                matched_stls = set(r[0] for r in db_conn.execute("SELECT settlement_id FROM audit_log").fetchall())
                utr_rows = db_conn.execute("""
                    SELECT utr_reference FROM bank_settlements WHERE settlement_id IN (SELECT settlement_id FROM audit_log)
                """).fetchall()
                for r in utr_rows:
                    if r[0]:
                        settled_utrs.add(r[0])
                
            unmatched_rows = db_conn.execute("""
                SELECT settlement_id, date, amount, utr_reference, payer_account, fees_deducted, net_amount, description, currency
                FROM bank_settlements
            """).fetchall()
            
            exceptions = []
            for r in unmatched_rows:
                stl_id = r[0]
                if stl_id not in matched_stls:
                    stl_dict = {
                        "settlement_id": r[0], "date": r[1], "amount": r[2],
                        "utr_reference": r[3], "payer_account": r[4],
                        "fees_deducted": r[5], "net_amount": r[6],
                        "description": r[7], "currency": r[8]
                    }
                    exc = classify_unmatched_record(stl_dict, [], settled_references=settled_utrs)
                    if exc.is_exception:
                        exceptions.append(exc)
                        
            return exceptions
    except Exception as e:
        logger.exception(f"[{req_id}] Internal server error during get_exceptions_endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error. Check server logs. (Request ID: {req_id})"
        )

@app.post("/ask", response_model=AskResponse)
def ask_question_endpoint(req: AskRequest):
    req_id = f"req_{int(time.time()*1000)}"
    try:
        settings = get_settings()
        with db_connection(read_only=True) as db_conn:
            res = answer_settlement_question(req.question, db_conn, settings)
            return AskResponse(
                answer=res["answer"],
                sql_query=res.get("sql_query"),
                extracted_entity=res.get("extracted_entity"),
                data_found=res.get("data_found", False)
            )
    except Exception as e:
        logger.exception(f"[{req_id}] Internal server error during ask_question_endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error. Check server logs. (Request ID: {req_id})"
        )
