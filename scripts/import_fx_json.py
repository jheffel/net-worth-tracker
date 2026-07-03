# Net Worth Tracker
# Copyright (C) 2025 jheffel
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
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