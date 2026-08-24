import pytest
from src.matching.fuzzy import get_top_candidates

def test_fuzzy_dropped_leading_zero():
    # Unmatched bank settlement with dropped leading zero in reference or vice-versa
    settlement = {
        "settlement_id": "STL999",
        "utr_reference": "REF01338908",
        "payer_account": "Saini and Sons",
        "description": "UPI/KKBK2812140441/Settlement for REF01338908"
    }
    
    # Candidate pool in ledger
    candidate_pool = [
        {
            "order_id": "ORD0001",
            "customer_reference": "REF99999999",
            "customer_name": "Unrelated Corp"
        },
        {
            "order_id": "ORD0002",
            "customer_reference": "REF1338908",  # Dropped leading zero
            "customer_name": "Saini and Sons"
        },
        {
            "order_id": "ORD0003",
            "customer_reference": "REF88888888",
            "customer_name": "Another Corp"
        }
    ]
    
    candidates = get_top_candidates(settlement, candidate_pool, top_k=3, min_score_threshold=0.35)
    
    assert len(candidates) > 0
    # ORD0002 should rank #1
    top_cand = candidates[0]
    assert top_cand["record"]["order_id"] == "ORD0002"
    assert top_cand["similarity_score"] > 0.75

def test_fuzzy_unrelated_strings_rejection():
    settlement = {
        "settlement_id": "STL888",
        "utr_reference": "XYZ_UNRELATED_REFERENCE_987",
        "payer_account": "Nonexistent Entity LLC",
        "description": "Random wire transfer with no matching data"
    }
    
    candidate_pool = [
        {
            "order_id": "ORD0100",
            "customer_reference": "ABC_COMPLETELY_DIFFERENT_123",
            "customer_name": "Alpha Beta Gamma Holdings"
        },
        {
            "order_id": "ORD0101",
            "customer_reference": "QWE_ANOTHER_MISMATCH_456",
            "customer_name": "Delta Epsilon Services"
        }
    ]
    
    # Unrelated strings should fall below default min_score_threshold (0.35) or return empty list
    candidates = get_top_candidates(settlement, candidate_pool, top_k=3, min_score_threshold=0.35)
    assert len(candidates) == 0

def test_fuzzy_ranking_order():
    settlement = {
        "settlement_id": "STL777",
        "utr_reference": "REF41458685",
        "payer_account": "D'Alia LLC",
        "description": "UPI payment for REF41458685"
    }
    
    candidate_pool = [
        {
            "order_id": "ORD001",
            "customer_reference": "REF41458680", # Slight mismatch
            "customer_name": "D'Alia LLC"
        },
        {
            "order_id": "ORD002",
            "customer_reference": "REF41458685", # Exact reference match
            "customer_name": "D'Alia LLC"
        },
        {
            "order_id": "ORD003",
            "customer_reference": "REF00000000",
            "customer_name": "D'Alia LLC"
        }
    ]
    
    candidates = get_top_candidates(settlement, candidate_pool, top_k=3, min_score_threshold=0.35)
    
    assert len(candidates) == 3
    # Sorted descending by similarity score
    assert candidates[0]["similarity_score"] >= candidates[1]["similarity_score"]
    assert candidates[1]["similarity_score"] >= candidates[2]["similarity_score"]
    assert candidates[0]["record"]["order_id"] == "ORD002"
