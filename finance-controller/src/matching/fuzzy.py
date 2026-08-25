from typing import List, Dict, Any, Optional
import numpy as np
from rapidfuzz import fuzz

_EMBED_MODEL = None
_EMBED_CACHE: Dict[str, np.ndarray] = {}
MAX_CACHE_SIZE = 5000

def get_embed_model():
    """Lazily loads local sentence-transformers model."""
    global _EMBED_MODEL
    if _EMBED_MODEL is None:
        from sentence_transformers import SentenceTransformer
        _EMBED_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    return _EMBED_MODEL

def _encode_texts(texts: List[str]) -> List[np.ndarray]:
    """Batch encodes list of text strings, utilizing bounded in-memory cache."""
    global _EMBED_CACHE
    model = get_embed_model()
    
    if len(_EMBED_CACHE) > MAX_CACHE_SIZE:
        _EMBED_CACHE.clear()
        
    missing_texts = [t for t in texts if t not in _EMBED_CACHE]
    if missing_texts:
        embeddings = model.encode(missing_texts, normalize_embeddings=True)
        for t, emb in zip(missing_texts, embeddings):
            _EMBED_CACHE[t] = emb
            
    return [_EMBED_CACHE[t] for t in texts]

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

    # Construct candidate texts
    cand_texts = []
    for cand in candidate_pool:
        if "order_id" in cand:
            cand_ref = cand.get("customer_reference") or ""
            cand_name = cand.get("customer_name") or ""
            cand_desc = cand.get("order_id") or ""
            cand_texts.append(f"{cand_name} {cand_desc} {cand_ref}".strip())
        else:
            cand_ref = cand.get("utr_reference") or ""
            cand_name = cand.get("payer_account") or ""
            cand_desc = cand.get("description") or ""
            cand_texts.append(f"{cand_name} {cand_desc} {cand_ref}".strip())

    # Batch-encode target + candidates in one pass
    all_texts = [target_text] + cand_texts
    all_embs = _encode_texts(all_texts)
    
    target_emb = all_embs[0]
    cand_embs = all_embs[1:]
    
    candidates_with_scores = []
    for idx, cand in enumerate(candidate_pool):
        if "order_id" in cand:
            cand_ref = cand.get("customer_reference") or ""
            cand_name = cand.get("customer_name") or ""
        else:
            cand_ref = cand.get("utr_reference") or ""
            cand_name = cand.get("payer_account") or ""
            
        # 1. Reference string similarity
        ref_ratio = 0.0
        if target_ref and cand_ref:
            r1 = target_ref.strip().upper()
            r2 = cand_ref.strip().upper()
            r_ratio = fuzz.ratio(r1, r2) / 100.0
            p_ratio = fuzz.partial_ratio(r1, r2) / 100.0
            
            # Extract digits to handle dropped leading zeros
            d1 = ''.join(c for c in r1 if c.isdigit()).lstrip('0')
            d2 = ''.join(c for c in r2 if c.isdigit()).lstrip('0')
            digit_ratio = (fuzz.ratio(d1, d2) / 100.0) if d1 and d2 else 0.0
            
            ref_ratio = max(r_ratio, p_ratio, digit_ratio)
            
        # 2. Payer/Customer name similarity
        name_ratio = 0.0
        if target_payer and cand_name:
            name_ratio = fuzz.token_sort_ratio(target_payer, cand_name) / 100.0
            
        # 3. Embedding semantic similarity
        cand_emb = cand_embs[idx]
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
            
    candidates_with_scores.sort(key=lambda x: x["similarity_score"], reverse=True)
    return candidates_with_scores[:top_k]
