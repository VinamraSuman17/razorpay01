import requests
import json

url = "http://127.0.0.1:8000/ask"

print("=== TEST 1: EXACT SQL INJECTION PAYLOAD HTTP REQUEST ===")
payload1 = {
    "question": "xyz' AND FALSE UNION SELECT * FROM bank_settlements WHERE settlement_id = 'STL0003' AND description LIKE '%"
}
print(f"URL: {url}")
print(f"Payload: {json.dumps(payload1)}")
resp1 = requests.post(url, json=payload1)
print(f"Response Status: {resp1.status_code}")
print(f"Response Body:\n{json.dumps(resp1.json(), indent=2)}")

print("\n" + "="*60 + "\n")

print("=== TEST 2: NATURAL LANGUAGE QUESTION HTTP REQUEST ===")
payload2 = {
    "question": "why is settlement STL0093 unresolved"
}
print(f"URL: {url}")
print(f"Payload: {json.dumps(payload2)}")
resp2 = requests.post(url, json=payload2)
print(f"Response Status: {resp2.status_code}")
print(f"Response Body:\n{json.dumps(resp2.json(), indent=2)}")
