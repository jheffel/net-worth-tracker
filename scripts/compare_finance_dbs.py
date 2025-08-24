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