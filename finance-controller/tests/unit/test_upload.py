import io
import pytest
from fastapi.testclient import TestClient
from backend.main import app
import backend.main as main_module

@pytest.fixture(autouse=True)
def reset_current_batch():
    orig = main_module.CURRENT_BATCH_DIR
    main_module.CURRENT_BATCH_DIR = None
    yield
    main_module.CURRENT_BATCH_DIR = orig

def test_run_batch_without_upload_returns_400(monkeypatch):
    """Confirm /run-batch returns HTTP 400 when no dataset has been uploaded yet."""
    monkeypatch.setattr(main_module, "resolve_current_batch_dir", lambda: None)
    client = TestClient(app)
    res = client.post("/run-batch")
    assert res.status_code == 400
    assert "No dataset uploaded yet" in res.json()["detail"]

def test_upload_completely_invalid_csv_rejected():
    """Requirement 2: Confirm uploading malformed CSVs with wrong headers fails with HTTP 400."""
    client = TestClient(app)
    bad_bank_csv = "wrong_header1,wrong_header2\nval1,val2\n"
    bad_ledger_csv = "order_id,invoice_date,expected_amount\nORD999,2026-07-01,1000\n"

    files = {
        "bank_file": ("bad_bank.csv", io.BytesIO(bad_bank_csv.encode("utf-8")), "text/csv"),
        "ledger_file": ("bad_ledger.csv", io.BytesIO(bad_ledger_csv.encode("utf-8")), "text/csv")
    }

    res = client.post("/upload-batch", files=files)
    assert res.status_code == 400
    err_detail = res.json()["detail"]
    assert "Validation Failed" in err_detail or "Field required" in err_detail

def test_upload_custom_dataset_with_malformed_row():
    """Requirement 5: Test uploading a small custom CSV pair with 1 malformed row.
    Confirm it validates, rejects the bad row with a clear reason, and reconciles the good rows.
    """
    client = TestClient(app)

    # 5 valid rows + 1 deliberately malformed row (Row 3 has date='2026-99-99')
    bank_csv_content = (
        "settlement_id,date,amount,utr_reference,payer_account,fees_deducted,net_amount,description,currency\n"
        "TEST_STL_001,2026-08-01,1000.00,TEST_REF_001,Acme Corp,23.60,976.40,Payment for TEST_REF_001,INR\n"
        "TEST_STL_002,2026-08-02,2000.00,TEST_REF_002,Beta LLC,47.20,1952.80,Payment for TEST_REF_002,INR\n"
        "TEST_STL_BAD,2026-99-99,3000.00,TEST_REF_BAD,Bad Corp,70.80,2929.20,Bad date row,INR\n"
        "TEST_STL_003,2026-08-03,3000.00,TEST_REF_003,Gamma Inc,70.80,2929.20,Payment for TEST_REF_003,INR\n"
        "TEST_STL_004,2026-08-04,4000.00,TEST_REF_004,Delta Co,94.40,3905.60,Payment for TEST_REF_004,INR\n"
        "TEST_STL_005,2026-08-05,5000.00,TEST_REF_005,Epsilon Ltd,118.00,4882.00,Payment for TEST_REF_005,INR\n"
    )

    ledger_csv_content = (
        "order_id,invoice_date,expected_amount,customer_name,customer_reference,expected_settlement_date,tax_amount,currency,status\n"
        "TEST_ORD_001,2026-08-01,1000.00,Acme Corp,TEST_REF_001,2026-08-01,180.00,INR,unsettled\n"
        "TEST_ORD_002,2026-08-02,2000.00,Beta LLC,TEST_REF_002,2026-08-02,360.00,INR,unsettled\n"
        "TEST_ORD_003,2026-08-03,3000.00,Gamma Inc,TEST_REF_003,2026-08-03,540.00,INR,unsettled\n"
        "TEST_ORD_004,2026-08-04,4000.00,Delta Co,TEST_REF_004,2026-08-04,720.00,INR,unsettled\n"
        "TEST_ORD_005,2026-08-05,5000.00,Epsilon Ltd,TEST_REF_005,2026-08-05,900.00,INR,unsettled\n"
    )

    files = {
        "bank_file": ("bank_settlements.csv", io.BytesIO(bank_csv_content.encode("utf-8")), "text/csv"),
        "ledger_file": ("internal_ledger.csv", io.BytesIO(ledger_csv_content.encode("utf-8")), "text/csv")
    }

    res = client.post("/upload-batch", files=files)
    assert res.status_code == 200
    data = res.json()

    # Verify counts
    assert data["bank_valid_records"] == 5
    assert data["bank_invalid_records"] == 1
    assert data["ledger_valid_records"] == 5
    assert data["ledger_invalid_records"] == 0

    # Verify clear warning for rejected row
    assert data["validation_warnings"] is not None
    assert len(data["validation_warnings"]) == 1
    assert "Invalid date format" in data["validation_warnings"][0]

    # Verify reconciliation summary on good rows
    summary = data["summary"]
    assert summary["total_bank_settlements"] == 5
    assert summary["matched_count"] == 5
    assert summary["match_rate_percent"] == 100.0

def test_upload_oversized_file_returns_413():
    client = TestClient(app)
    # 10.1 MB buffer
    oversized_bytes = b"a" * (10 * 1024 * 1024 + 1024)
    normal_bytes = b"settlement_id,date,amount,utr_reference,payer_account,fees_deducted,net_amount,description,currency\n"
    
    files = {
        "bank_file": ("bank.csv", io.BytesIO(oversized_bytes), "text/csv"),
        "ledger_file": ("ledger.csv", io.BytesIO(normal_bytes), "text/csv")
    }
    res = client.post("/upload-batch", files=files)
    assert res.status_code == 413
    assert "File too large" in res.json()["detail"]

def test_upload_non_csv_filename_returns_400():
    client = TestClient(app)
    csv_bytes = b"settlement_id,date,amount,utr_reference,payer_account,fees_deducted,net_amount,description,currency\n"
    files = {
        "bank_file": ("bank.txt", io.BytesIO(csv_bytes), "text/plain"),
        "ledger_file": ("ledger.csv", io.BytesIO(csv_bytes), "text/csv")
    }
    res = client.post("/upload-batch", files=files)
    assert res.status_code == 400
    assert "File must be a CSV" in res.json()["detail"]

def test_upload_empty_file_returns_400():
    client = TestClient(app)
    csv_bytes = b"settlement_id,date,amount,utr_reference,payer_account,fees_deducted,net_amount,description,currency\n"
    files = {
        "bank_file": ("bank.csv", io.BytesIO(b""), "text/csv"),
        "ledger_file": ("ledger.csv", io.BytesIO(csv_bytes), "text/csv")
    }
    res = client.post("/upload-batch", files=files)
    assert res.status_code == 400
    assert "File is empty" in res.json()["detail"]
