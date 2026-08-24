import os
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import duckdb
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError
import csv
import io
from datetime import datetime
from src.config_loader import get_settings
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

app = FastAPI(
    title="AI Finance Controller API",
    description="Fintech reconciliation engine with LLM verification and exception classification",
    version="1.0.0"
)

# CORS middleware for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    base_dir = Path(__file__).resolve().parent.parent
    db_path = base_dir / "data" / "reconciliation.db"
    db_path.parent.mkdir(exist_ok=True, parents=True)
    return duckdb.connect(str(db_path))

CURRENT_BATCH_DIR: Optional[Path] = None

# Pydantic Request / Response Models
class RunBatchResponse(BaseModel):
    total_bank_settlements: int
    matched_count: int
    match_rate_percent: float
    exception_count: int
    needs_review_count: int
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

class AskRequest(BaseModel):
    question: str

class AskResponse(BaseModel):
    answer: str
    sql_query: Optional[str] = None
    extracted_entity: Optional[Dict[str, Any]] = None
    data_found: bool

class UploadBatchResponse(BaseModel):
    batch_id: str
    message: str
    bank_valid_records: int
    bank_invalid_records: int
    ledger_valid_records: int
    ledger_invalid_records: int
    validation_warnings: Optional[List[str]] = None
    summary: RunBatchResponse

def validate_csv_content(content: bytes, model_cls, id_field: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    
    valid_records = []
    errors = []
    seen_ids = set()
    seen_rows = set()
    
    if not reader.fieldnames:
        return [], ["CSV file is completely empty or header is missing."]
        
    for idx, row in enumerate(reader, start=1):
        clean_row = {k: v for k, v in row.items() if k and isinstance(k, str)}
        row_tuple = tuple(sorted((str(k), str(v).strip()) for k, v in clean_row.items()))
        if row_tuple in seen_rows:
            continue
        seen_rows.add(row_tuple)
        
        try:
            record = model_cls(**clean_row)
            record_id = getattr(record, id_field, None)
            if record_id in seen_ids:
                errors.append(f"Row {idx}: Duplicate ID '{record_id}' found.")
                continue
            seen_ids.add(record_id)
            valid_records.append(clean_row)
        except ValidationError as ve:
            err_msgs = "; ".join([f"{err['loc'][0] if err['loc'] else 'field'}: {err['msg']}" for err in ve.errors()])
            errors.append(f"Row {idx}: {err_msgs}")
        except Exception as ex:
            errors.append(f"Row {idx}: {str(ex)}")
            
    return valid_records, errors

def run_full_pipeline(bank_csv_path: Optional[Path] = None, ledger_csv_path: Optional[Path] = None) -> Dict[str, Any]:
    start_time = time.time()
    settings = get_settings()
    db_conn = get_db()
    
    # Reset table data
    db_conn.execute("DROP TABLE IF EXISTS audit_log;")
    db_conn.execute("DROP TABLE IF EXISTS bank_settlements;")
    db_conn.execute("DROP TABLE IF EXISTS internal_ledger;")
    
    base_dir = Path(__file__).resolve().parent.parent
    jsonl_log = base_dir / "logs" / "audit_log.jsonl"
    if jsonl_log.exists():
        jsonl_log.unlink()
        
    # Ingest
    bank_csv = bank_csv_path or (base_dir / "data" / "raw" / "bank_settlements.csv")
    ledger_csv = ledger_csv_path or (base_dir / "data" / "raw" / "internal_ledger.csv")
    
    if not bank_csv or not ledger_csv or not Path(bank_csv).exists() or not Path(ledger_csv).exists():
        raise HTTPException(
            status_code=400,
            detail="No dataset uploaded yet. Please upload Bank Settlements and Internal Ledger CSV files first."
        )
        
    ingest_bank_settlements(bank_csv, db_conn)
    ingest_internal_ledger(ledger_csv, db_conn)
    
    consumed_settlements = set()
    consumed_orders = set()
    
    # 3. Deterministic matchers
    run_exact_matching(db_conn, consumed_settlements, consumed_orders, settings)
    run_tolerance_matching(db_conn, consumed_settlements, consumed_orders, settings)
    run_partial_matching(db_conn, consumed_settlements, consumed_orders, settings)
    run_split_matching(db_conn, consumed_settlements, consumed_orders, settings)
    run_advanced_matching(db_conn, consumed_settlements, consumed_orders, settings)
    
    # 4. Fuzzy candidate shortlisting for remaining settlements
    unmatched_stl_rows = db_conn.execute("""
        SELECT settlement_id, date, amount, utr_reference, payer_account, fees_deducted, net_amount, description, currency
        FROM bank_settlements
    """).fetchall()
    
    unmatched_ledger_rows = db_conn.execute("""
        SELECT order_id, invoice_date, expected_amount, customer_name, customer_reference, expected_settlement_date, tax_amount, currency, status
        FROM internal_ledger
    """).fetchall()
    
    ledger_pool = []
    for r in unmatched_ledger_rows:
        if r[0] not in consumed_orders:
            ledger_pool.append({
                "order_id": r[0], "invoice_date": r[1], "expected_amount": r[2],
                "customer_name": r[3], "customer_reference": r[4],
                "expected_settlement_date": r[5], "tax_amount": r[6],
                "currency": r[7], "status": r[8]
            })
            
    unmatched_stls = []
    candidate_pools_by_stl = {}
    
    for r in unmatched_stl_rows:
        stl_id = r[0]
        if stl_id not in consumed_settlements:
            stl_dict = {
                "settlement_id": r[0], "date": r[1], "amount": r[2],
                "utr_reference": r[3], "payer_account": r[4],
                "fees_deducted": r[5], "net_amount": r[6],
                "description": r[7], "currency": r[8]
            }
            unmatched_stls.append(stl_dict)
            cands = get_top_candidates(stl_dict, ledger_pool, top_k=3)
            candidate_pools_by_stl[stl_id] = cands
            
    # 5. Gemini Agent Verification (if API key or cache available)
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
    for stl in unmatched_stls:
        stl_id = stl["settlement_id"]
        if stl_id not in consumed_settlements:
            cands = candidate_pools_by_stl.get(stl_id, [])
            exc = classify_unmatched_record(stl, cands, settled_references=settled_utrs)
            if exc.is_exception:
                exception_items.append(exc)
                
    # 7. Evaluate metrics
    eval_stats = evaluate_reconciliation(db_conn)
    elapsed = time.time() - start_time
    db_conn.close()
    
    return {
        "summary": RunBatchResponse(
            total_bank_settlements=eval_stats["total_settlements"],
            matched_count=eval_stats["system_matches_count"],
            match_rate_percent=round(eval_stats["match_rate"] * 100, 2),
            exception_count=len(exception_items),
            needs_review_count=agent_stats.get("needs_review", 0),
            execution_time_seconds=round(elapsed, 2),
            token_usage=token_usage_tracker,
            precision_percent=round(eval_stats["precision"] * 100, 2),
            recall_percent=round(eval_stats["recall"] * 100, 2)
        ),
        "exceptions": exception_items
    }

@app.post("/upload-batch", response_model=UploadBatchResponse)
async def upload_batch_endpoint(
    bank_file: UploadFile = File(...),
    ledger_file: UploadFile = File(...)
):
    global CURRENT_BATCH_DIR
    try:
        bank_bytes = await bank_file.read()
        ledger_bytes = await ledger_file.read()
        
        bank_valid, bank_errors = validate_csv_content(bank_bytes, BankSettlementRecord, "settlement_id")
        ledger_valid, ledger_errors = validate_csv_content(ledger_bytes, InternalLedgerRecord, "order_id")
        
        # If either file has 0 valid records, fail validation completely with HTTP 400
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
            
        # Store in timestamped batch directory
        batch_id = datetime.now().strftime("batch_%Y%m%d_%H%M%S")
        base_dir = Path(__file__).resolve().parent.parent
        batch_dir = base_dir / "data" / "uploads" / batch_id
        batch_dir.mkdir(parents=True, exist_ok=True)
        
        bank_path = batch_dir / "bank_settlements.csv"
        ledger_path = batch_dir / "internal_ledger.csv"
        
        # Write valid records to destination CSVs
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
        
        # Execute reconciliation pipeline on newly uploaded batch
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
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/run-batch", response_model=RunBatchResponse)
def run_batch_endpoint():
    try:
        if not CURRENT_BATCH_DIR:
            raise HTTPException(
                status_code=400,
                detail="No dataset uploaded yet. Please upload Bank Settlements and Internal Ledger CSV files first."
            )
        bank_p = CURRENT_BATCH_DIR / "bank_settlements.csv"
        ledger_p = CURRENT_BATCH_DIR / "internal_ledger.csv"
        pipeline_res = run_full_pipeline(bank_csv_path=bank_p, ledger_csv_path=ledger_p)
        return pipeline_res["summary"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/matches", response_model=List[MatchRecord])
def get_matches_endpoint():
    db_conn = get_db()
    table_exists = db_conn.execute("""
        SELECT count(*) FROM information_schema.tables WHERE table_name = 'audit_log'
    """).fetchone()[0]
    
    if table_exists == 0:
        db_conn.close()
        return []
        
    rows = db_conn.execute("""
        SELECT settlement_id, order_id, rule_applied, confidence, timestamp 
        FROM audit_log ORDER BY timestamp DESC
    """).fetchall()
    db_conn.close()
    
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

@app.get("/exceptions", response_model=List[ExceptionItem])
def get_exceptions_endpoint():
    db_conn = get_db()
    # Read unmatched bank settlements
    table_exists = db_conn.execute("""
        SELECT count(*) FROM information_schema.tables WHERE table_name = 'bank_settlements'
    """).fetchone()[0]
    
    if table_exists == 0:
        db_conn.close()
        return []
        
    # Get currently matched settlements and UTRs
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
                
    db_conn.close()
    return exceptions

@app.post("/ask", response_model=AskResponse)
def ask_question_endpoint(req: AskRequest):
    settings = get_settings()
    db_conn = get_db()
    res = answer_settlement_question(req.question, db_conn, settings)
    db_conn.close()
    
    return AskResponse(
        answer=res["answer"],
        sql_query=res.get("sql_query"),
        extracted_entity=res.get("extracted_entity"),
        data_found=res.get("data_found", False)
    )
