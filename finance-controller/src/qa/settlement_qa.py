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
from src.config_loader import get_client_masked_key

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
You are an expert AI Finance Controller Q&A Assistant for a fintech reconciliation platform.
Answer the user's natural language question directly, accurately, and naturally based on the provided JSON context.

Rules:
1. Directly answer what was specifically asked in the user's question (e.g., if asked "why", explain the exact financial logic, platform fee deductions, reference differences, or confidence score reasons; if asked for details, summarize key financial fields; if asked about confidence, explain why it was assigned that score).
2. Cite exact record IDs (settlement_id, order_id, UTR reference), dates, and monetary amounts in ₹ INR.
3. Reference Comparison & Discrepancies:
   - When explaining a match (especially FUZZY_REFERENCE_MATCH or any match with reference differences), explicitly compare the retrieved bank reference (utr_reference) against the retrieved ledger reference (customer_reference).
   - Describe the ACTUAL discrepancy (e.g., "REF14363495 vs REF14363549 — differ in the last two digits" or exact difference).
   - NEVER claim that non-identical references matched perfectly or make generic claims of a perfect match when references differ or when a fuzzy match rule was applied.
4. Anti-Hallucination & Grounding:
   - Base all claims strictly on the provided SQL query results and reconciliation context.
   - If a specific detail, field, or record was NOT retrieved in the query results or provided context, do NOT state it as fact or infer/guess a value — state clearly that the detail is not available rather than inferring or guessing.
5. If exception details exist, clearly explain why the record is unresolved and what action is required.
6. If no data was found, state clearly: "No matching record or data was found in the reconciled database."
7. Do NOT use generic template responses. Write a natural, concise, professional English answer tailored to the user's question.
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
        getattr(settings.gemini, "model_name", None),
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.1-flash-lite-preview",
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-3.6-flash"
    ]
    # Deduplicate preserving order
    seen = set()
    models = [m for m in candidate_models if m and not (m in seen or seen.add(m))]
    
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
            tb = traceback.format_exc()
            err_msg = f"[GEMINI_API_RETRY] Model '{model_name}' failed for {task_desc}. Exception Type: {type(e).__name__}, Message: {str(e)}"
            logger.warning(err_msg)
            print(err_msg)
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                logger.warning(f"429 Rate limit hit in Q&A for model {model_name}. Sleeping 30s before fallback...")
                time.sleep(30)
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
    if not client:
        api_key = os.getenv("GEMINI_API_KEY") or getattr(settings, "gemini_api_key", None)
        if not api_key:
            warn_msg = f"[QA_EXTRACTION_FALLBACK] Gemini extraction unavailable (missing API key), using regex fallback for question: '{question}'"
            logger.warning(warn_msg)
            print(warn_msg)
            return extract_entity_with_regex(question)
        client = genai.Client(api_key=api_key)
        
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
            filter_type = data.get("filter_type", "general_query")
            extracted_val = data.get("value", data.get("extracted_value", "")).strip()
            if filter_type and extracted_val:
                return {"filter_type": filter_type, "value": extracted_val}
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(
                f"Failed to parse JSON output from Gemini extraction. Exception Type: {type(e).__name__}, Message: {str(e)}\nTraceback:\n{tb}"
            )
            
    warn_msg = f"[QA_EXTRACTION_FALLBACK] Gemini extraction unavailable (Gemini call failed / unparseable output), using regex fallback for question: '{question}'"
    logger.warning(warn_msg)
    print(warn_msg)
    return extract_entity_with_regex(question)

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

    if not client:
        api_key = os.getenv("GEMINI_API_KEY") or getattr(settings, "gemini_api_key", None)
        if api_key:
            client = genai.Client(api_key=api_key)
            
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
            
        sql_executed = f"SELECT {select_cols} {joins} WHERE s.settlement_id = ?"
        cursor = db_conn.execute(sql_executed, [val])
        columns = [d[0] for d in cursor.description]
        rows = cursor.fetchall()
        
        if rows:
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
        logger.warning("[QA_SYNTHESIS] All Gemini models failed or key missing. Falling back to template synthesis.")
        print("[QA_SYNTHESIS] All Gemini models failed or key missing. Falling back to template synthesis.")
        if filter_type == "settlement_id":
            stl_id, stl_date, stl_amt, net_amt, fees, utr = first_row[0], first_row[1], first_row[2], first_row[3], first_row[4], first_row[5]
            rule = rich_context.get("audit_match", {}).get("rule_applied", "Unresolved")
            if rule != "Unresolved":
                final_answer = f"Settlement {stl_id} (₹{net_amt/100:.2f}, UTR: '{utr}', Date: {stl_date}) is reconciled to Order {matched_order_or_stl} via rule {rule}."
            else:
                final_answer = f"Settlement {stl_id} (₹{net_amt/100:.2f}, UTR: '{utr}', Date: {stl_date}) is currently unresolved. {exception_note.strip()}"
        elif filter_type == "category_count":
            cnt = first_row[0] if len(first_row) == 1 else first_row[1]
            final_answer = f"Found {cnt} record(s) matching category or filter '{val}'."
        else:
            final_answer = f"Found {len(rows)} matching record(s) for entity '{val}' in reconciled database."

    res = {
        "answer": final_answer,
        "sql_query": sql_executed,
        "extracted_entity": entity_info,
        "data_found": True,
        "row_count": len(rows)
    }

    _qa_cache[cache_key] = res
    _save_qa_cache()
    return res
