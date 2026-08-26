import time
import threading
import logging

logger = logging.getLogger(__name__)

_last_call_lock = threading.Lock()
_last_call_timestamp = 0.0

def enforce_proactive_rate_limit(rpm: int = 15, is_test_mock: bool = False) -> float:
    """
    Proactively spaces out Gemini API calls so total request frequency stays strictly under `rpm` requests per minute.
    For a 15 RPM limit, uses a safe target of 12 RPM (5.0s inter-call interval) to prevent rolling 60-second window bursts.
    
    Skipped when `is_test_mock` is True (e.g. unit testing).
    Returns the number of seconds slept (if any).
    """
    global _last_call_timestamp
    if is_test_mock:
        return 0.0

    # Cap to 10 RPM (6.0s spacing) for safe margin under 15 RPM free tier limit
    effective_rpm = min(rpm, 10)
    target_interval = 60.0 / max(1, effective_rpm)  # 6.0s interval

    with _last_call_lock:
        now = time.time()
        elapsed = now - _last_call_timestamp
        sleep_needed = target_interval - elapsed
        if sleep_needed > 0:
            log_msg = f"[PROACTIVE_RATE_LIMITER] Sleeping {sleep_needed:.2f}s to maintain <={effective_rpm} RPM limit..."
            logger.info(log_msg)
            print(log_msg)
            time.sleep(sleep_needed)
            _last_call_timestamp = time.time()
        else:
            _last_call_timestamp = now
        return max(0.0, sleep_needed)
