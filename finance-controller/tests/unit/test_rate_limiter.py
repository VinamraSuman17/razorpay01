import time
import pytest
from src.agent.rate_limiter import enforce_proactive_rate_limit, _last_call_lock
import src.agent.rate_limiter as rl_mod
from src.config_loader import mask_api_key, reload_environment

def test_mask_api_key_formatting():
    assert mask_api_key(None) == "<NOT SET>"
    assert mask_api_key("") == "<NOT SET>"
    assert mask_api_key("12345") == "12...45"
    assert mask_api_key("AQ.Ab89999991FfQ") == "AQ.Ab8...1FfQ"
    assert mask_api_key("AIzaSyD1234567890ENDKey") == "AIzaSy...DKey"

def test_proactive_rate_limiter_skips_when_test_mock():
    t0 = time.time()
    slept = enforce_proactive_rate_limit(rpm=15, is_test_mock=True)
    t_elapsed = time.time() - t0
    assert slept == 0.0
    assert t_elapsed < 0.1

def test_proactive_rate_limiter_pacing():
    # Force _last_call_timestamp to current time
    with _last_call_lock:
        rl_mod._last_call_timestamp = time.time()
        
    # High RPM to make test fast: 600 RPM -> target_interval = 0.1 seconds
    t0 = time.time()
    slept1 = enforce_proactive_rate_limit(rpm=600, is_test_mock=False)
    slept2 = enforce_proactive_rate_limit(rpm=600, is_test_mock=False)
    total_elapsed = time.time() - t0
    
    # Second call should have slept approx 0.1s to maintain pacing
    assert total_elapsed >= 0.18
