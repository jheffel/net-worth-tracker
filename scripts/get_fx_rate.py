

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