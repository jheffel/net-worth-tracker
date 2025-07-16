

import sys
import os

# Get the current script's directory
current_dir = os.path.dirname(os.path.abspath(__file__))
# Get the parent directory
parent_dir = os.path.dirname(current_dir)
# Add the parent directory to sys.path
sys.path.append(parent_dir)
# Now you can import modules from the parent directory
from exchange_rates import ExchangeRate


def main():
    db = ExchangeRate(parent_dir + "/db/exchange_rates.db")
    date = input("Enter date (YYYY-MM-DD): ").strip()
    base = input("Enter base currency (e.g. USD): ").strip().upper()
    target = input("Enter target currency (e.g. CAD): ").strip().upper()
    rate = db.get_rate(date, base, target)
    if rate is not None:
        print(f"Exchange rate on {date} from {base} to {target}: {rate}")
    else:
        print(f"No rate found for {base}/{target} on {date}")

if __name__ == "__main__":
    main()