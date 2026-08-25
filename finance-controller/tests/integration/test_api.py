import pytest
from fastapi.testclient import TestClient
from backend.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_get_matches_endpoint(client):
    response = client.get("/matches")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_exceptions_endpoint(client):
    response = client.get("/exceptions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_ask_endpoint(client):
    response = client.post("/ask", json={"question": "Show me total bank settlements count"})
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "data_found" in data

def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
