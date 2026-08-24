def calculate_fee_adjusted_amount(amount_paise: int, fee_percentage: float) -> int:
    """
    Calculates net amount in paise after deducting fee_percentage.
    Formula: net = amount - round(amount * fee_percentage / 100)
    """
    fee = round(amount_paise * (fee_percentage / 100.0))
    return amount_paise - fee

def apply_fx_conversion(amount_paise: int, fx_rate: float) -> int:
    """
    Converts amount in paise from foreign currency to INR using fx_rate.
    Formula: round(amount_paise * fx_rate)
    """
    return round(amount_paise * fx_rate)

def calculate_difference(amount1_paise: int, amount2_paise: int) -> int:
    """
    Calculates absolute difference between two paise amounts.
    """
    return abs(amount1_paise - amount2_paise)
