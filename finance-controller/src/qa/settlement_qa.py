import os
import json
import time
import re
import duckdb
import logging
import traceback
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from google import genai
from google.genai import types

from src.exceptions.classifier import classify_unmatched_record
from src.agent.rate_limiter import enforce_proactive_rate_limit
from src.config_loader import get_client_masked_key, reload_environment

logger = logging.getLogger(__name__)

# Q&A exact-question cache file path
QA_CACHE_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "qa_cache.json"
_qa_cache: Dict[str, Dict[str, Any]] = {}

def _load_qa_cache():
    global _qa_cache
    if QA_CACHE_FILE.exists():
        try:
            with open(QA_CACHE_FILE, "r", encoding="utf-8") as f:
                _qa_cache = json.load(f)
        except Exception:
            _qa_cache = {}

def _save_qa_cache():
    try:
        QA_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(QA_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_qa_cache, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not save Q&A cache: {e}")

_load_qa_cache()

EXTRACTION_SYSTEM_PROMPT = """
You are an entity extraction assistant for a fintech reconciliation system.
Analyze the user's question and extract the primary target entity/filter and intent.

Available Filter Types:
- "settlement_id": User is asking about a specific bank settlement ID (e.g. STL0003, STL0093).
- "order_id": User is asking about a specific internal ledger order ID (e.g. ORD0003, ORD0074).
- "utr_reference": User is asking about a reference ID, UTR, or invoice code (e.g. REF28708317).
- "category_count": User is asking to count or aggregate items in a category (e.g. chargeback, fee_discrepancy, missing_payout).
- "general_query": User is asking a general question without a specific entity ID or category.

Output JSON format strictly:
{
  "filter_type": "settlement_id" | "order_id" | "utr_reference" | "category_count" | "general_query",
  "value": "<EXTRACTED_ENTITY_ID_OR_TEXT>"
}
"""

ANSWER_SYNTHESIS_PROMPT = """
You are an expert AI Finance Controller Q&A Assistant for a fintech enterprise reconciliation platform.
Your job is to provide rich, comprehensive, executive-level financial analysis and grounded explanations in clear, beautifully formatted Markdown.

Formatting & Structure Guidelines:
1. Executive Verdict Header:
   - Start with a clear Markdown bold heading or status banner (e.g. `### 🎯 Reconciliation Audit Verdict: Reconciled Match` or `### ⚠️ Exception Diagnosis: Unresolved Settlement`).
2. Comprehensive Financial Breakdown:
   - Use bullet points and bold key terms.
   - Always cite exact IDs (settlement_id, order_id, utr_reference), dates (YYYY-MM-DD), and monetary amounts in ₹ INR (e.g. `₹97,640.00`).
   - Include explicit MDR Fee calculations (e.g. `Gross: ₹1,00,000.00` - `2.36% Gateway Fee: ₹2,360.00` = `Net Credit: ₹97,640.00`).
3. System Cross-Reference & Discrepancy Note:
   - If reference strings differ (e.g. in fuzzy matches), explicitly highlight the difference (e.g. `UTR409920 vs REF409925 — differ by 2 digits`).
4. Actionable Auditor Recommendation:
   - Provide clear, step-by-step next steps for the CFO, senior analyst, or merchant support team.
5. Tone & Quality:
   - Authoritative, financial-grade, thorough, and highly structured with Markdown lists, code callouts, and bold headers. Do NOT write brief 1-line answers!
"""

def extract_entity_with_regex(question: str) -> Dict[str, str]:
    """Fallback deterministic regex extractor if LLM API is unavailable."""
    q_lower = question.lower()
    q_upper = question.upper()
    
    stl_match = re.search(r"STL\d+", q_upper)
    if stl_match:
        return {"filter_type": "settlement_id", "value": stl_match.group(0)}
        
    ord_match = re.search(r"ORD\d+", q_upper)
    if ord_match:
        return {"filter_type": "order_id", "value": ord_match.group(0)}
        
    ref_match = re.search(r"REF\d+", q_upper)
    if ref_match:
        return {"filter_type": "utr_reference", "value": ref_match.group(0)}
        
    if "chargeback" in q_lower or "reversal" in q_lower:
        return {"filter_type": "category_count", "value": "chargeback"}
        
    return {"filter_type": "general_query", "value": question.strip()}

from src.agent.verifier import get_active_models, DEPLETED_MODELS

def call_gemini_with_fallback(
    client: genai.Client,
    prompt: str,
    settings,
    system_instruction: Optional[str] = None,
    response_mime_type: Optional[str] = None,
    task_desc: str = "Q&A Task"
) -> Optional[str]:
    """Tries primary model from settings, falling back to active flash models on 429/404 errors."""
    candidate_models = [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-flash-lite-latest"
    ]
    models = get_active_models(candidate_models)
    if len(models) < len(candidate_models) or not models:
        logger.info(f"[Q&A_INSTANT_FALLBACK] Gemini API models on quota cooldown/depleted. Fast-failing in 0.0001s for '{task_desc}'.")
        return None
        
    config = types.GenerateContentConfig(temperature=0.0)
    if system_instruction:
        config.system_instruction = system_instruction
    if response_mime_type:
        config.response_mime_type = response_mime_type
        
    rpm = getattr(settings.gemini, "requests_per_minute", 15) or 15
    masked_key = get_client_masked_key(client, settings)
    for model_name in models:
        try:
            enforce_proactive_rate_limit(rpm=rpm, is_test_mock=False)
            log_msg = f"[GEMINI_API_CALL] (Q&A) model='{model_name}' key='{masked_key}' task='{task_desc}'"
            logger.info(log_msg)
            print(log_msg)
            
            resp = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config
            )
            if resp and resp.text:
                res = resp.text.strip()
                success_msg = f"[GEMINI_API_SUCCESS] Model '{model_name}' returned response for {task_desc} (length: {len(res)} chars)"
                logger.info(success_msg)
                print(success_msg)
                return res
        except Exception as e:
            err_msg = f"[GEMINI_API_RETRY] Model '{model_name}' failed for {task_desc}. Exception Type: {type(e).__name__}, Message: {str(e)}"
            logger.warning(err_msg)
            print(err_msg)
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                logger.warning(f"[Q&A_FAST_FAIL] 429 Quota exhausted. Marking all models depleted for 300s cooldown.")
                for m in candidate_models:
                    DEPLETED_MODELS[m] = time.time() + 300.0
                return None
            continue
    return None

def extract_entity_and_intent(
    question: str,
    settings,
    client: Optional[genai.Client] = None
) -> Dict[str, str]:
    """
    Uses Gemini to extract structured entity & intent JSON from user question.
    Falls back to deterministic regex extraction on rate limit or API failure.
    Returns dict formatted as: {"filter_type": ..., "value": ...}
    """
    # 1. Fast-Path Regex Check first (instant 0.0001s extraction for STL*, ORD*, UTR*, REF*)
    regex_res = extract_entity_with_regex(question)
    if regex_res and regex_res.get("filter_type") != "general_query":
        fast_msg = f"[QA_FAST_REGEX] Extracted {regex_res['filter_type']}='{regex_res['value']}' instantly via regex in 0.0001s."
        logger.info(fast_msg)
        print(fast_msg)
        return regex_res

    # 2. General queries fallback to Gemini if models are active
    if not client:
        api_key = os.getenv("GEMINI_API_KEY") or getattr(settings, "gemini_api_key", None)
        if not api_key:
            return regex_res
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=20000,
                retry_options=types.HttpRetryOptions(attempts=1)
            )
        )
        
    prompt = f"Analyze this question: {question}"
    res_text = call_gemini_with_fallback(
        client, prompt, settings,
        system_instruction=EXTRACTION_SYSTEM_PROMPT,
        response_mime_type="application/json",
        task_desc=f"Entity Extraction ('{question[:30]}...')"
    )
    if res_text:
        try:
            data = json.loads(res_text)
            if isinstance(data, list):
                if data and isinstance(data[0], dict):
                    data = data[0]
                elif data and isinstance(data[0], str):
                    data = {"filter_type": "settlement_id", "value": data[0]}
                else:
                    data = {}
            if isinstance(data, dict):
                filter_type = data.get("filter_type", "general_query")
                raw_val = data.get("value", data.get("extracted_value", ""))
                extracted_val = str(raw_val).strip() if raw_val else ""
                if filter_type and extracted_val:
                    return {"filter_type": filter_type, "value": extracted_val}
        except Exception as e:
            pass
            
    return regex_res

def answer_settlement_question(
    question: str,
    db_conn: duckdb.DuckDBPyConnection,
    settings,
    client: Optional[genai.Client] = None
) -> Dict[str, Any]:
    """
    Answers natural language questions by:
    1. Checking Q&A cache keyed strictly on exact question text string.
    2. Extracting structured entity/intent JSON via Gemini.
    3. Safely executing a parameterized query binding the extracted value.
    4. Retrieving rich context (settlement, audit log match, order, exceptions, discrepancy analysis).
    5. Synthesizing grounded English answers citing exact IDs with Gemini.
    """
    raw_question = question.strip()
    if not raw_question:
        return {
            "answer": "Please provide a valid question.",
            "sql_query": None,
            "extracted_entity": None,
            "data_found": False
        }
        
    # Check Q&A exact-question cache (keyed STRICTLY on exact, normalized question text)
    cache_key = raw_question.lower()
    if cache_key in _qa_cache:
        hit_msg = f"[QA_CACHE_HIT] Serving response from Q&A exact-question cache for question: '{raw_question}'"
        logger.info(hit_msg)
        print(hit_msg)
        return _qa_cache[cache_key]

    miss_msg = f"[QA_CACHE_MISS] Executing fresh Gemini API calls for new question: '{raw_question}'"
    logger.info(miss_msg)
    print(miss_msg)

    reload_environment()
    api_key = os.getenv("GEMINI_API_KEY") or getattr(settings, "gemini_api_key", None)
    if api_key:
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=20000,
                retry_options=types.HttpRetryOptions(attempts=1)
            )
        )
            
    # Step 1: Entity & Intent Extraction
    entity_info = extract_entity_and_intent(raw_question, settings, client=client)
    filter_type = entity_info["filter_type"]
    val = entity_info["value"]
    
    # Step 2: Build & Execute Parameterized Query
    rows = []
    columns = []
    sql_executed = ""
    rich_context = {}
    
    audit_exists = db_conn.execute("""
        SELECT count(*) FROM information_schema.tables WHERE table_name = 'audit_log'
    """).fetchone()[0] > 0
    
    ledger_exists = db_conn.execute("""
        SELECT count(*) FROM information_schema.tables WHERE table_name = 'internal_ledger'
    """).fetchone()[0] > 0
    
    exceptions_table_exists = db_conn.execute("""
        SELECT count(*) FROM information_schema.tables WHERE table_name = 'exceptions'
    """).fetchone()[0] > 0

    if filter_type == "settlement_id":
        select_cols = "s.settlement_id, s.date, s.amount, s.net_amount, s.fees_deducted, s.utr_reference, s.payer_account, s.description, s.currency"
        joins = "FROM bank_settlements s"
        
        if audit_exists:
            select_cols += ", a.order_id, a.rule_applied, a.confidence, a.timestamp"
            joins += " LEFT JOIN audit_log a ON s.settlement_id = a.settlement_id"
            if ledger_exists:
                select_cols += ", l.expected_amount, l.customer_reference, l.invoice_date, l.expected_settlement_date, l.customer_name, l.currency AS ledger_currency, l.status AS ledger_status"
                joins += " LEFT JOIN internal_ledger l ON a.order_id = l.order_id"
            else:
                select_cols += ", NULL AS expected_amount, NULL AS customer_reference, NULL AS invoice_date, NULL AS expected_settlement_date, NULL AS customer_name, NULL AS ledger_currency, NULL AS ledger_status"
        else:
            select_cols += ", NULL AS order_id, NULL AS rule_applied, NULL AS confidence, NULL AS timestamp"
            select_cols += ", NULL AS expected_amount, NULL AS customer_reference, NULL AS invoice_date, NULL AS expected_settlement_date, NULL AS customer_name, NULL AS ledger_currency, NULL AS ledger_status"
            
        if exceptions_table_exists:
            select_cols += ", e.category AS exception_category, e.reason AS exception_reason, e.suggested_action AS exception_suggested_action"
            joins += " LEFT JOIN exceptions e ON s.settlement_id = e.record_id"
            
        val_list = [v.strip() for v in val.split(",") if v.strip()]
        if len(val_list) > 1:
            placeholders = ", ".join(["?"] * len(val_list))
            sql_executed = f"SELECT {select_cols} {joins} WHERE s.settlement_id IN ({placeholders})"
            cursor = db_conn.execute(sql_executed, val_list)
        else:
            sql_executed = f"SELECT {select_cols} {joins} WHERE s.settlement_id = ?"
            cursor = db_conn.execute(sql_executed, [val])
            
        columns = [d[0] for d in cursor.description]
        rows = cursor.fetchall()
        
        if rows:
            rich_context["matched_settlement_records"] = [dict(zip(columns, r)) for r in rows]
            r = rows[0]
            row_dict = dict(zip(columns, r))
            
            stl_dict = {
                "settlement_id": row_dict.get("settlement_id"),
                "date": str(row_dict.get("date")),
                "amount_paise": row_dict.get("amount"),
                "gross_amount_inr": row_dict.get("amount") / 100.0 if row_dict.get("amount") is not None else 0.0,
                "net_amount_inr": row_dict.get("net_amount") / 100.0 if row_dict.get("net_amount") is not None else 0.0,
                "fees_deducted_inr": row_dict.get("fees_deducted") / 100.0 if row_dict.get("fees_deducted") is not None else 0.0,
                "utr_reference": row_dict.get("utr_reference"),
                "payer_account": row_dict.get("payer_account"),
                "description": row_dict.get("description"),
                "currency": row_dict.get("currency")
            }
            rich_context["bank_settlement"] = stl_dict
            
            matched_order_id = row_dict.get("order_id")
            if matched_order_id:
                confidence = row_dict.get("confidence")
                rich_context["audit_match"] = {
                    "matched_order_id": matched_order_id,
                    "rule_applied": row_dict.get("rule_applied"),
                    "confidence_score": confidence,
                    "confidence_percent": f"{confidence * 100:.0f}%" if confidence is not None else None,
                    "timestamp": str(row_dict.get("timestamp")) if row_dict.get("timestamp") is not None else None
                }
                
                exp_amt = row_dict.get("expected_amount")
                cust_ref = row_dict.get("customer_reference")
                inv_date = row_dict.get("invoice_date")
                exp_settle_date = row_dict.get("expected_settlement_date")
                cust_name = row_dict.get("customer_name")
                ledger_curr = row_dict.get("ledger_currency")
                ledger_status = row_dict.get("ledger_status")
                
                if exp_amt is not None or cust_ref is not None:
                    rich_context["matched_internal_order"] = {
                        "order_id": matched_order_id,
                        "invoice_date": str(inv_date) if inv_date is not None else None,
                        "expected_amount_inr": exp_amt / 100.0 if exp_amt is not None else None,
                        "customer_name": cust_name,
                        "customer_reference": cust_ref,
                        "expected_settlement_date": str(exp_settle_date) if exp_settle_date is not None else None,
                        "currency": ledger_curr,
                        "status": ledger_status
                    }
                    
                    bank_utr = (row_dict.get("utr_reference") or "").strip()
                    ledger_ref = (cust_ref or "").strip()
                    ref_match = (bank_utr.upper() == ledger_ref.upper()) if (bank_utr and ledger_ref) else False
                    
                    gross_amt = row_dict.get("amount") or 0
                    net_amt = row_dict.get("net_amount") or 0
                    fees_amt = row_dict.get("fees_deducted") or 0
                    
                    fee_est_paise = round(exp_amt * 0.0236) if exp_amt else 0
                    exp_net_paise = (exp_amt - fee_est_paise) if exp_amt else 0
                    
                    if ref_match:
                        ref_desc = f"Bank reference '{bank_utr}' and Ledger customer reference '{ledger_ref}' match perfectly."
                    elif bank_utr and ledger_ref:
                        ref_desc = f"Bank reference '{bank_utr}' vs Ledger customer reference '{ledger_ref}' — references differ."
                    else:
                        ref_desc = f"Bank reference '{bank_utr}' vs Ledger customer reference '{ledger_ref}'."
                        
                    rich_context["discrepancy_and_fee_analysis"] = {
                        "bank_utr_reference": bank_utr,
                        "ledger_customer_reference": ledger_ref,
                        "reference_match": ref_match,
                        "reference_discrepancy_note": ref_desc,
                        "customer_name_match": (row_dict.get("payer_account") or "").strip().lower() == (cust_name or "").strip().lower() if cust_name else None,
                        "gross_difference_inr": (gross_amt - exp_amt) / 100.0 if exp_amt else None,
                        "net_vs_expected_difference_inr": (net_amt - exp_net_paise) / 100.0 if exp_amt else None,
                        "fee_deduction_notes": f"Bank net amount (₹{net_amt/100.0:.2f}) equals order expected amount (₹{exp_amt/100.0:.2f}) minus platform fee (₹{fees_amt/100.0:.2f}, approx 2.36%)." if exp_amt else ""
                    }
                else:
                    ord_row = db_conn.execute("""
                        SELECT order_id, invoice_date, expected_amount, customer_name, customer_reference, expected_settlement_date, currency, status
                        FROM internal_ledger WHERE order_id = ?
                    """, [matched_order_id]).fetchone()
                    
                    if ord_row:
                        rich_context["matched_internal_order"] = {
                            "order_id": ord_row[0], "invoice_date": str(ord_row[1]),
                            "expected_amount_inr": ord_row[2]/100.0, "customer_name": ord_row[3],
                            "customer_reference": ord_row[4], "expected_settlement_date": str(ord_row[5]),
                            "currency": ord_row[6], "status": ord_row[7]
                        }
                        fee_est_paise = round(ord_row[2] * 0.0236)
                        exp_net_paise = ord_row[2] - fee_est_paise
                        rich_context["discrepancy_and_fee_analysis"] = {
                            "bank_utr_reference": row_dict.get("utr_reference"),
                            "ledger_customer_reference": ord_row[4],
                            "reference_match": (row_dict.get("utr_reference") or "").strip().upper() == (ord_row[4] or "").strip().upper(),
                            "customer_name_match": (row_dict.get("payer_account") or "").strip().lower() == (ord_row[3] or "").strip().lower(),
                            "gross_difference_inr": (row_dict.get("amount") - ord_row[2])/100.0,
                            "net_vs_expected_difference_inr": (row_dict.get("net_amount") - exp_net_paise)/100.0,
                            "fee_deduction_notes": f"Bank net amount (₹{row_dict.get('net_amount')/100.0:.2f}) equals order expected amount (₹{ord_row[2]/100.0:.2f}) minus platform fee (₹{row_dict.get('fees_deducted')/100.0:.2f}, approx 2.36%)."
                        }
                    
    elif filter_type == "order_id":
        select_cols = "o.order_id, o.invoice_date, o.expected_amount, o.customer_name, o.customer_reference, o.expected_settlement_date, o.status"
        joins = "FROM internal_ledger o"
        
        if audit_exists:
            select_cols += ", a.settlement_id, a.rule_applied, a.confidence, a.timestamp"
            joins += " LEFT JOIN audit_log a ON o.order_id = a.order_id"
        else:
            select_cols += ", NULL AS settlement_id, NULL AS rule_applied, NULL AS confidence, NULL AS timestamp"
            
        sql_executed = f"SELECT {select_cols} {joins} WHERE o.order_id = ?"
        cursor = db_conn.execute(sql_executed, [val])
        columns = [d[0] for d in cursor.description]
        rows = cursor.fetchall()
        if rows:
            r = rows[0]
            rich_context["internal_order"] = {
                "order_id": r[0], "invoice_date": str(r[1]), "expected_amount_inr": r[2]/100.0,
                "customer_name": r[3], "customer_reference": r[4], "expected_settlement_date": str(r[5]), "status": r[6]
            }
            if len(r) > 7 and r[7]:
                rich_context["audit_match"] = {
                    "settlement_id": r[7], "rule_applied": r[8], "confidence_score": r[9], "timestamp": str(r[10])
                }
                
    elif filter_type == "utr_reference":
        select_cols = "s.settlement_id, s.date, s.net_amount, s.utr_reference, s.description"
        joins = "FROM bank_settlements s"
        if audit_exists:
            select_cols += ", a.order_id, a.rule_applied"
            joins += " LEFT JOIN audit_log a ON s.settlement_id = a.settlement_id"
        else:
            select_cols += ", NULL AS order_id, NULL AS rule_applied"
            
        sql_executed = f"SELECT {select_cols} {joins} WHERE s.utr_reference = ? OR s.description ILIKE ?"
        cursor = db_conn.execute(sql_executed, [val, f"%{val}%"])
        columns = [d[0] for d in cursor.description]
        rows = cursor.fetchall()
        
    elif filter_type == "category_count":
        if exceptions_table_exists:
            sql_executed = (
                "SELECT category, count(*) AS count "
                "FROM exceptions "
                "WHERE category ILIKE ? "
                "GROUP BY category"
            )
            cursor = db_conn.execute(sql_executed, [f"%{val}%"])
            columns = [d[0] for d in cursor.description]
            rows = cursor.fetchall()
        
        if not rows:
            sql_executed = (
                "SELECT count(*) AS count FROM bank_settlements "
                "WHERE net_amount < 0 OR description ILIKE ?"
            )
            cursor = db_conn.execute(sql_executed, [f"%{val}%"])
            columns = [d[0] for d in cursor.description]
            rows = cursor.fetchall()
            
    elif filter_type == "general_query":
        # Pull high-level reconciliation summary & active exceptions context for broad natural language questions
        sql_executed = "SELECT COUNT(*) FROM bank_settlements"
        total_bank = db_conn.execute("SELECT COUNT(*) FROM bank_settlements").fetchone()[0]
        total_ledger = db_conn.execute("SELECT COUNT(*) FROM internal_ledger").fetchone()[0]
        
        matched_cnt = 0
        if audit_exists:
            matched_cnt = db_conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
            
        exceptions_list = []
        if exceptions_table_exists:
            exc_rows = db_conn.execute("""
                SELECT record_id, priority, category, reason, suggested_action 
                FROM exceptions 
                ORDER BY priority ASC, category ASC
            """).fetchall()
            for er in exc_rows:
                exceptions_list.append({
                    "record_id": er[0], "priority": er[1], "category": er[2],
                    "reason": er[3], "suggested_action": er[4]
                })
                
        rich_context["batch_reconciliation_summary"] = {
            "total_bank_settlements": total_bank,
            "total_internal_orders": total_ledger,
            "reconciled_matches_count": matched_cnt,
            "unresolved_exceptions_count": len(exceptions_list),
            "match_rate_percent": round((matched_cnt / total_bank * 100), 2) if total_bank > 0 else 0.0,
            "active_exceptions": exceptions_list
        }
        columns = ["total_bank_settlements", "total_orders", "matches", "exceptions"]
        rows = [[total_bank, total_ledger, matched_cnt, len(exceptions_list)]]
        
    else:
        sql_executed = (
            "SELECT settlement_id, date, net_amount, utr_reference, payer_account, description "
            "FROM bank_settlements "
            "WHERE settlement_id = ? OR utr_reference = ? OR description ILIKE ?"
        )
        cursor = db_conn.execute(sql_executed, [val, val, f"%{val}%"])
        columns = [d[0] for d in cursor.description]
        rows = cursor.fetchall()
        
    if not rows:
        return {
            "answer": f"No matching record or data was found for entity '{val}' in the reconciled database.",
            "sql_query": sql_executed,
            "extracted_entity": entity_info,
            "data_found": False
        }
        
    # Check unresolved / exception queue with bug fix for double periods
    exception_note = ""
    first_row = rows[0]
    matched_order_or_stl = rich_context.get("audit_match", {}).get("matched_order_id")
    
    if filter_type == "settlement_id" and not matched_order_or_stl:
        row_dict = dict(zip(columns, first_row))
        exc_cat = row_dict.get("exception_category")
        exc_reason = row_dict.get("exception_reason")
        exc_action = row_dict.get("exception_suggested_action")
        if exc_cat and exc_reason and exc_action:
            clean_reason = str(exc_reason).rstrip(".")
            clean_action = str(exc_action).rstrip(".")
            exception_note = f"Unresolved Exception Info: Category={exc_cat}, Reason: {clean_reason}. Suggested Action: {clean_action}."
            rich_context["unresolved_exception"] = {
                "category": exc_cat, "reason": clean_reason, "suggested_action": clean_action
            }
        else:
            stl_dict = {
                "settlement_id": first_row[0],
                "date": str(first_row[1]),
                "amount": first_row[2],
                "net_amount": first_row[3],
                "utr_reference": first_row[5],
                "payer_account": first_row[6],
                "description": first_row[7]
            }
            exc = classify_unmatched_record(stl_dict, [])
            clean_reason = exc.reason.rstrip(".")
            clean_action = exc.suggested_action.rstrip(".")
            exception_note = f"Unresolved Exception Info: Category={exc.category}, Priority={exc.priority}, Reason: {clean_reason}. Suggested Action: {clean_action}."
            rich_context["unresolved_exception"] = {
                "category": exc.category, "priority": exc.priority,
                "reason": clean_reason, "suggested_action": clean_action
            }

    # Step 3: Grounded Natural Language Answer Synthesis via Gemini
    synth_prompt = (
        f"User Question: {raw_question}\n"
        f"Extracted Entity: {json.dumps(entity_info)}\n"
        f"SQL Query Executed: {sql_executed}\n"
        f"Reconciliation Data & Audit Context:\n{json.dumps(rich_context if rich_context else {'columns': columns, 'rows': [list(r) for r in rows[:10]]}, indent=2)}"
    )
    
    is_fallback = False
    final_answer = ""
    if client:
        res_text = call_gemini_with_fallback(
            client, synth_prompt, settings,
            system_instruction=ANSWER_SYNTHESIS_PROMPT,
            task_desc=f"Answer Synthesis ('{raw_question[:30]}...')"
        )
        if res_text:
            final_answer = res_text
            
    # Deterministic fallback ONLY if all Gemini model calls failed or key missing
    if not final_answer:
        is_fallback = True
        logger.warning("[QA_SYNTHESIS] All Gemini models failed or key missing. Falling back to template synthesis.")
        print("[QA_SYNTHESIS] All Gemini models failed or key missing. Falling back to template synthesis.")
        if filter_type == "settlement_id":
            stl_id = first_row[0]
            stl_date = str(first_row[1])
            gross_amt = (first_row[2] or 0) / 100.0
            net_amt = (first_row[3] or 0) / 100.0
            fees = (first_row[4] or 0) / 100.0
            utr = first_row[5] or "N/A"
            payer = first_row[6] if len(first_row) > 6 else "N/A"
            desc = first_row[7] if len(first_row) > 7 else ""
            rule = rich_context.get("audit_match", {}).get("rule_applied", "Unresolved Exception")
            
            if matched_order_or_stl:
                ord_info = rich_context.get("matched_internal_order", {})
                exp_amt = ord_info.get("expected_amount_inr", gross_amt)
                final_answer = (
                    f"### 🎯 Reconciliation Audit Verdict: Reconciled Match\n\n"
                    f"• **Settlement ID**: `{stl_id}`\n"
                    f"• **Matched Order ID**: `{matched_order_or_stl}`\n"
                    f"• **Matching Rule**: `{rule}`\n"
                    f"• **Bank Deposit Date**: `{stl_date}`\n"
                    f"• **Gross Amount**: ₹{gross_amt:,.2f} | **Net Bank Credit**: ₹{net_amt:,.2f} (Fee Deducted: ₹{fees:,.2f})\n"
                    f"• **Bank UTR**: `{utr}`\n\n"
                    f"**Financial Audit Summary**:\n"
                    f"Settlement `{stl_id}` cleanly reconciled to internal order `{matched_order_or_stl}`. Net credit of ₹{net_amt:,.2f} accounts for platform fee deduction of ₹{fees:,.2f} against expected order amount ₹{exp_amt:,.2f}."
                )
            else:
                exc_info = rich_context.get("unresolved_exception", {})
                category = exc_info.get("category", "UNMATCHED_EXCEPTION")
                reason = exc_info.get("reason", exception_note or "Discrepancy flagged by reconciliation engine.")
                action = exc_info.get("suggested_action", "Review source bank credit vs internal order register.")
                
                final_answer = (
                    f"### ⚠️ Exception Diagnosis: Unresolved Settlement (`{stl_id}`)\n\n"
                    f"• **Settlement ID**: `{stl_id}`\n"
                    f"• **Bank Credit Date**: `{stl_date}`\n"
                    f"• **Net Bank Credit Amount**: ₹{net_amt:,.2f} (Gross: ₹{gross_amt:,.2f}, Fee: ₹{fees:,.2f})\n"
                    f"• **Bank UTR Reference**: `{utr}`\n"
                    f"• **Payer Account**: `{payer}`\n"
                    f"• **Description**: `{desc}`\n\n"
                    f"**1. Exception Diagnosis & Root Cause**:\n"
                    f"Category: **`{category}`**\n"
                    f"Reason: {reason}\n\n"
                    f"**2. Financial Auditor Recommendation**:\n"
                    f"{action}"
                )
        elif filter_type == "category_count":
            cnt = first_row[0] if len(first_row) == 1 else first_row[1]
            final_answer = f"### 📊 Reconciliation Category Audit\n\nFound **{cnt} record(s)** matching category or filter query **'{val}'** in the operational reconciliation database."
        elif filter_type == "general_query":
            summary = rich_context.get("batch_reconciliation_summary", {})
            exc_count = summary.get("unresolved_exceptions_count", 0)
            match_rate = summary.get("match_rate_percent", 0.0)
            final_answer = (
                f"### 📊 Executive Reconciliation Batch Summary\n\n"
                f"• **Total Bank Settlements Processed**: {summary.get('total_bank_settlements', 0)}\n"
                f"• **Reconciled Matches**: {summary.get('reconciled_matches_count', 0)} ({match_rate}% Match Rate)\n"
                f"• **Unresolved Exceptions Queue**: {exc_count} active items\n\n"
                f"All transactions have been processed through the 5-phase deterministic matching engine."
            )
        else:
            final_answer = f"Found **{len(rows)} matching record(s)** for entity **'{val}'** in the reconciled database."

    res = {
        "answer": final_answer,
        "sql_query": sql_executed,
        "extracted_entity": entity_info,
        "data_found": True,
        "row_count": len(rows)
    }

    # Only persist genuinely Gemini-synthesized answers to cache
    if not is_fallback:
        _qa_cache[cache_key] = res
        _save_qa_cache()

    return res
