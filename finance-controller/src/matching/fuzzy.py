from typing import List, Dict, Any, Optional
import numpy as np
from rapidfuzz import fuzz

_EMBED_MODEL = None

def get_embed_model():
    """Lazily loads local sentence-transformers model."""
    global _EMBED_MODEL
    if _EMBED_MODEL is None:
        from sentence_transformers import SentenceTransformer
        _EMBED_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    return _EMBED_MODEL

def get_top_candidates(
    unmatched_record: Dict[str, Any],
    candidate_pool: List[Dict[str, Any]],
    top_k: int = 3,
    min_score_threshold: float = 0.35
) -> List[Dict[str, Any]]:
    """
    Generates top-k ranked candidate matches from candidate_pool for an unmatched_record.
    Uses RapidFuzz string similarity on reference & name fields combined with
    offline sentence embeddings for semantic similarity.
    
    Returns an empty list if no candidate meets min_score_threshold.
    """
    if not candidate_pool:
        return []
        
    model = get_embed_model()
    
    # Construct target text & references
    if "settlement_id" in unmatched_record:
        target_ref = unmatched_record.get("utr_reference") or ""
        target_payer = unmatched_record.get("payer_account") or ""
        target_desc = unmatched_record.get("description") or ""
        target_text = f"{target_payer} {target_desc} {target_ref}".strip()
    else:
        target_ref = unmatched_record.get("customer_reference") or ""
        target_payer = unmatched_record.get("customer_name") or ""
        target_desc = unmatched_record.get("order_id") or ""
        target_text = f"{target_payer} {target_desc} {target_ref}".strip()

    # Pre-encode target text
    target_emb = model.encode(target_text, normalize_embeddings=True)
    
    candidates_with_scores = []
    
    for cand in candidate_pool:
        if "order_id" in cand:
            cand_ref = cand.get("customer_reference") or ""
            cand_name = cand.get("customer_name") or ""
            cand_desc = cand.get("order_id") or ""
            cand_text = f"{cand_name} {cand_desc} {cand_ref}".strip()
        else:
            cand_ref = cand.get("utr_reference") or ""
            cand_name = cand.get("payer_account") or ""
            cand_desc = cand.get("description") or ""
            cand_text = f"{cand_name} {cand_desc} {cand_ref}".strip()
            
        # 1. Reference string similarity
        ref_ratio = 0.0
        if target_ref and cand_ref:
            r1 = target_ref.strip().upper()
            r2 = cand_ref.strip().upper()
            r_ratio = fuzz.ratio(r1, r2) / 100.0
            p_ratio = fuzz.partial_ratio(r1, r2) / 100.0
            
            # Extract digits to handle dropped leading zeros (e.g., REF0123 vs REF123)
            d1 = ''.join(c for c in r1 if c.isdigit()).lstrip('0')
            d2 = ''.join(c for c in r2 if c.isdigit()).lstrip('0')
            digit_ratio = (fuzz.ratio(d1, d2) / 100.0) if d1 and d2 else 0.0
            
            ref_ratio = max(r_ratio, p_ratio, digit_ratio)
            
        # 2. Payer/Customer name similarity
        name_ratio = 0.0
        if target_payer and cand_name:
            name_ratio = fuzz.token_sort_ratio(target_payer, cand_name) / 100.0
            
        # 3. Embedding semantic similarity
        cand_emb = model.encode(cand_text, normalize_embeddings=True)
        semantic_sim = float(np.dot(target_emb, cand_emb))
        semantic_sim = max(0.0, min(1.0, semantic_sim))
        
        # Hybrid score calculation
        if ref_ratio >= 0.75:
            hybrid_score = max(ref_ratio, 0.7 * ref_ratio + 0.3 * semantic_sim)
        else:
            hybrid_score = 0.4 * ref_ratio + 0.3 * name_ratio + 0.3 * semantic_sim
            
        if hybrid_score >= min_score_threshold:
            candidates_with_scores.append({
                "record": cand,
                "similarity_score": round(hybrid_score, 4),
                "ref_score": round(ref_ratio, 4),
                "name_score": round(name_ratio, 4),
                "semantic_score": round(semantic_sim, 4)
            })
            
    # Sort descending by similarity score
    candidates_with_scores.sort(key=lambda x: x["similarity_score"], reverse=True)
    
    return candidates_with_scores[:top_k]
