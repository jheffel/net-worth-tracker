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
import sqlite3

def fetch_balances(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT account_name, date, balance, currency, ticker FROM account_balances")
    rows = cursor.fetchall()
    conn.close()
    return set(rows)

def compare_dbs(db1, db2):
    balances1 = fetch_balances(db1)
    balances2 = fetch_balances(db2)

    only_in_1 = balances1 - balances2
    only_in_2 = balances2 - balances1

    print(f"Entries only in {db1}:")
    for row in only_in_1:
        print(row)
    print(f"\nEntries only in {db2}:")
    for row in only_in_2:
        print(row)

    if not only_in_1 and not only_in_2:
        print("\nNo differences found between the databases.")

if __name__ == "__main__":
    db1 = "db/finance.db"
    db2 = "db/finance_correct.db"
    compare_dbs(db1, db2)