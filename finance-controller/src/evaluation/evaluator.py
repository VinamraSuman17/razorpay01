import csv
from pathlib import Path
import duckdb

def evaluate_reconciliation(db_conn: duckdb.DuckDBPyConnection) -> dict:
    """
    Evaluates system matches in the audit_log table against ground_truth.csv.
    Returns precision, recall, match rate, and raw counts.
    """
    base_dir = Path(__file__).resolve().parent.parent.parent
    gt_path = base_dir / "data" / "ground_truth" / "ground_truth.csv"
    
    gt_matches = {}  # Map of (settlement_id, order_id) -> is_true_match (bool)
    true_matches_count = 0
    
    if gt_path.exists():
        with open(gt_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                stl_id = row["settlement_id"]
                order_id = row["order_id"]
                is_true = row["is_true_match"].strip().lower() == "true"
                gt_matches[(stl_id, order_id)] = is_true
                if is_true:
                    true_matches_count += 1
                    
    # Check if audit_log table exists
    table_exists = db_conn.execute("""
        SELECT count(*) FROM information_schema.tables WHERE table_name = 'audit_log'
    """).fetchone()[0]
    
    sys_matches = []
    if table_exists > 0:
        sys_matches = db_conn.execute("SELECT settlement_id, order_id, rule_applied FROM audit_log").fetchall()
        
    tp = 0
    fp = 0
    matched_settlements = set()
    
    for row in sys_matches:
        stl_id, order_id, rule = row
        matched_settlements.add(stl_id)
        
        is_true = gt_matches.get((stl_id, order_id), False)
        if is_true:
            tp += 1
        else:
            fp += 1
            
    fn = true_matches_count - tp
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / true_matches_count if true_matches_count > 0 else 0.0
    
    total_settlements = db_conn.execute("SELECT COUNT(*) FROM bank_settlements").fetchone()[0]
    match_rate = len(matched_settlements) / total_settlements if total_settlements > 0 else 0.0
    
    return {
        "precision": precision,
        "recall": recall,
        "match_rate": match_rate,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "total_true_matches": true_matches_count,
        "total_settlements": total_settlements,
        "system_matches_count": len(sys_matches)
    }
