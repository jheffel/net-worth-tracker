import sqlite3
from datetime import datetime
import os


class FinanceModel:
    def __init__(self, db_file="db/finance.db"):
        self.db_file = db_file
        
        os.makedirs(os.path.dirname(self.db_file), exist_ok=True)

        self._initialize_db()
    
    def _initialize_db(self):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS account_balances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_name TEXT,
                date TEXT,
                balance REAL,
                UNIQUE(account_name, date)
            )
        ''')
        conn.commit()
        conn.close()

    def add_balance(self, account_name, date, balance):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO account_balances (account_name, date, balance)
            VALUES (?, ?, ?)
            ON CONFLICT(account_name, date) DO UPDATE SET balance=excluded.balance
        """, (account_name, date, balance))
        conn.commit()
        conn.close()

    def load_data(self):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("SELECT account_name, date, balance FROM account_balances ORDER BY date")
        data = cursor.fetchall()
        conn.close()
        
        account_data = {}
        for account_name, date_str, balance in data:
            date = datetime.strptime(date_str, "%Y-%m-%d")
            if account_name not in account_data:
                account_data[account_name] = ([], [])
            account_data[account_name][0].append(date)
            account_data[account_name][1].append(balance)
        
        return account_data
