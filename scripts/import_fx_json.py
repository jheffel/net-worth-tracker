import json
import os
from exchange_rates import ExchangeRate

# Path to your JSON file
json_path = "example_data/FX_RATES_DAILY-sd-2017-01-03.json"

# Initialize the ExchangeRate database handler
fx_db = ExchangeRate()

with open(json_path, "r") as f:
    data = json.load(f)

observations = data.get("observations", [])
series_detail = data.get("seriesDetail", {})

for obs in observations:
    date = obs.get("d")
    if not date:
        continue
    for pair, value in obs.items():
        if pair == "d":
            continue
        rate = value.get("v")
        if not rate:
            continue
        # Parse base and target currency from the seriesDetail
        detail = series_detail.get(pair)
        if not detail:
            continue
        label = detail.get("label")  # e.g., "USD/CAD"
        if not label or "/" not in label:
            continue
        base_currency, target_currency = label.split("/")
        fx_db.add_rate(date, base_currency, target_currency, float(rate))

print("FX rates import complete.")