import io
from fastapi.testclient import TestClient
import sys
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.main import app

client = TestClient(app)

ledger_csv = """order_id,invoice_date,expected_amount,customer_name,customer_reference,expected_settlement_date,tax_amount,currency,status
ORD0010,2026-07-04,532.68,"Sridhar, Dutt and Devi",REF47604758,2026-07-05,81.25,USD,settled
ORD0002,2026-07-11,75274.56,Chawla-Agarwal,REF98694111,2026-07-12,11482.56,INR,settled
ORD0005,2026-07-19,18478.23,Chakrabarti-Puri,REF87207439,2026-07-21,2818.71,INR,settled
ORD0006,2026-07-12,13308.93,Chandra and Sons,REF27186854,2026-07-13,2030.17,INR,settled
ORD0004,2026-07-11,705.97,"Maharaj, Taneja and Chandra",REF59298188,2026-07-12,107.69,INR,settled
ORD0003,2026-07-20,20774.45,"Dass, Sachdeva and Bandi",REF95494134,2026-07-22,3168.98,INR,settled
ORD0009,2026-07-18,51905.27,"Uppal, Saraf and Dora",REF89809054,2026-07-20,7917.75,INR,settled
ORD0001,2026-07-08,75258.63,Sehgal Ltd,REF37759458,2026-07-10,11480.13,INR,settled
ORD0007,2026-07-18,28694.24,"Loke, Anne and Ganguly",REF18900794,2026-07-20,4377.08,INR,settled
ORD0008,2026-07-22,15340.36,Oza-Parikh,REF17617666,2026-07-24,2340.05,INR,settled
ORD0011,2026-07-23,83964.03,"Saxena, Ganesh and Chadha",REF51444628,2026-07-24,12808.07,INR,settled"""

bank_csv = """settlement_id,date,amount,utr_reference,payer_account,fees_deducted,net_amount,description,currency
STL0005,2026-07-21,18478.23,REF87207439,Chakrabarti-Puri,0,18478.23,UPI/HDFC4448589384/Settlement for REF87207439,INR
STL0002,2026-07-12,75274.56,REF98694111,Chawla-Agarwal,0,75274.56,UPI/KKBK7645516086/Settlement for REF98694111,INR
STL0008,2026-07-24,15340.36,REF17417666,Oza-Parikh,0,15340.36,UPI/AXIS7597917319/Settlement ref REF17417666,INR
STL0004,2026-07-12,705.97,REF59298188,"Maharaj, Taneja and Chandra",0,705.97,UPI/KKBK6747770407/Settlement for REF59298188,INR
STL0014,2026-07-28,-20774.45,REF95494134,"Dass, Sachdeva and Bandi",0,-20774.45,Chargeback reversal of REF95494134,INR
STL0003,2026-07-22,20774.45,REF95494134,"Dass, Sachdeva and Bandi",0,20774.45,UPI/AXIS3971941915/Settlement for REF95494134,INR
STL0007,2026-07-20,28693.69,REF18900794,"Loke, Anne and Ganguly",0,28693.69,UPI/SBIN2101534352/Settlement for REF18900794 (rounding),INR
STL0013,2026-07-15,58073.37,MISC715169,"Jaggi, De and Cherian",0,58073.37,Unidentified inward transfer,INR
STL0001,2026-07-10,75258.63,REF37759458,Sehgal Ltd,0,75258.63,UPI/ICIC7766758800/Settlement for REF37759458,INR
STL0012,2026-07-24,83964.03,REF51444628,"Saxena, Ganesh and Chadha",0,83964.03,UPI/SBIN7108742666/Settlement for REF51444628 (duplicate credit),INR
STL0010,2026-07-05,44478.78,REF47604758,"Sridhar, Dutt and Devi",0,44478.78,UPI/SBIN1045932502/Settlement for REF47604758 (FX converted),INR
STL0009,2026-07-20,51905.27,REF89809045,"Uppal, Saraf and Dora",0,51905.27,UPI/AXIS5258667012/Settlement ref REF89809045,INR
STL0011,2026-07-24,83964.03,REF51444628,"Saxena, Ganesh and Chadha",0,83964.03,UPI/SBIN8142383506/Settlement for REF51444628,INR
STL0006,2026-07-13,13308.93,REF27186854,Chandra and Sons,314.09,12994.84,UPI/KKBK3131068740/Settlement for REF27186854 after platform fee,INR"""

files = {
    "bank_file": ("bank_settlements.csv", io.BytesIO(bank_csv.encode("utf-8")), "text/csv"),
    "ledger_file": ("internal_ledger.csv", io.BytesIO(ledger_csv.encode("utf-8")), "text/csv")
}

response = client.post("/upload-batch", files=files)
print(f"Status Code: {response.status_code}")
print(f"Response JSON: {response.json()}")
