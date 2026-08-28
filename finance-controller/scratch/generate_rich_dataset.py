import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

companies = [
    ('Acme Corp', 'ACC_ACME', 1.0, 0),
    ('Global Tech', 'ACC_GLOBAL', 1.5, 0),
    ('Nexus Inc', 'ACC_NEXUS', 2.0, 0),
    ('Beta LLC', 'ACC_BETA', 5.5, 1),
    ('Delta Systems', 'ACC_DELTA', 6.0, 1),
    ('Omni Global', 'ACC_OMNI', 9.0, 2),
    ('Vortex Dynamics', 'ACC_VORTEX', 12.0, 3)
]

bank_rows = ['settlement_id,date,amount,utr_reference,payer_account,fees_deducted,net_amount,tax_deducted,description,currency']
ledger_rows = ['order_id,invoice_date,expected_amount,customer_name,customer_reference,expected_settlement_date,tax_amount,currency,status']

base_date = datetime(2026, 7, 1)

# Generate 55 matched pairs
for i in range(1, 56):
    stl_id = f'STL{i:04d}'
    ord_id = f'ORD{i:04d}'
    utr = f'REF{i:04d}'
    
    comp_name, acc, avg_lag, def_cnt = random.choice(companies)
    gross_paise = random.randint(100, 1500) * 100000 # Rs 100,000 to Rs 1,500,000
    
    inv_dt = base_date + timedelta(days=random.randint(0, 20))
    settle_dt = inv_dt + timedelta(days=int(avg_lag))
    
    fee_paise = round(gross_paise * 0.02) # 2% platform fee
    gst_paise = round(gross_paise * 0.18) # 18% GST on invoice
    net_paise = gross_paise - fee_paise
    
    # Add currency variance for 3 records
    curr = 'INR'
    if i in [15, 30, 45]:
        curr = 'USD'
        gross_paise = 50000 # USD 500
        net_paise = 49000
        
    d_str = settle_dt.strftime("%Y-%m-%d")
    i_str = inv_dt.strftime("%Y-%m-%d")
    
    bank_rows.append(f'{stl_id},{d_str},{gross_paise},{utr},{acc},{fee_paise},{net_paise},0,Settlement from {comp_name},{curr}')
    ledger_rows.append(f'{ord_id},{i_str},{gross_paise},{comp_name},{utr},{d_str},{gst_paise},{curr},settled')

# Add 8 Healthy Pending Orders (for 30-Day Liquidity Forecast)
for i in range(56, 64):
    ord_id = f'ORD{i:04d}'
    utr = f'REF{i:04d}'
    comp_name, acc, avg_lag, def_cnt = random.choice(companies[:3]) # High reliability companies
    gross_paise = random.randint(200, 2000) * 100000
    inv_dt = base_date + timedelta(days=25)
    exp_settle_dt = inv_dt + timedelta(days=random.randint(2, 15))
    gst_paise = round(gross_paise * 0.18)
    
    i_str = inv_dt.strftime("%Y-%m-%d")
    e_str = exp_settle_dt.strftime("%Y-%m-%d")
    ledger_rows.append(f'{ord_id},{i_str},{gross_paise},{comp_name},{utr},{e_str},{gst_paise},INR,unsettled')

# Add 5 Overdue / At-Risk Defaulter Orders (for Defaulter Analytics)
for i in range(64, 69):
    ord_id = f'ORD{i:04d}'
    utr = f'REF{i:04d}'
    comp_name, acc, avg_lag, def_cnt = random.choice(companies[4:]) # Heavy defaulter companies
    gross_paise = random.randint(300, 2500) * 100000
    inv_dt = datetime(2026, 6, 10) + timedelta(days=random.randint(0, 10))
    exp_settle_dt = inv_dt + timedelta(days=5)
    gst_paise = round(gross_paise * 0.18)
    
    i_str = inv_dt.strftime("%Y-%m-%d")
    e_str = exp_settle_dt.strftime("%Y-%m-%d")
    ledger_rows.append(f'{ord_id},{i_str},{gross_paise},{comp_name},{utr},{e_str},{gst_paise},INR,unsettled')

# Add 3 Genuine Bank Exception Records (Chargeback, Duplicate, Orphan Deposit)
bank_rows.append('STL0090,2026-07-25,-150000,REF0090,ACC_OMNI,0,-150000,0,Chargeback Reversal for Omni Global,INR')
bank_rows.append('STL0091,2026-07-26,500000,REF0005,ACC_BETA,10000,490000,0,Duplicate Credit Settlement for Beta LLC,INR')
bank_rows.append('STL0092,2026-07-27,850000,MISC8888,ACC_UNKNOWN,17000,833000,0,Unidentified Miscellaneous Deposit,INR')

out_dir = Path("data/demo_60_records")
out_dir.mkdir(parents=True, exist_ok=True)

(out_dir / "bank_settlements.csv").write_text("\n".join(bank_rows), encoding="utf-8")
(out_dir / "internal_ledger.csv").write_text("\n".join(ledger_rows), encoding="utf-8")

print("SUCCESSFULLY GENERATED 58 BANK SETTLEMENTS AND 68 LEDGER RECORDS IN data/demo_60_records/")
