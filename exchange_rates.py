import sqlite3
from datetime import datetime

class ExchangeRate:
    def __init__(self, db_file="db/exchange_rates.db"):
        self.db_file = db_file
        self._initialize_db()

    def _initialize_db(self):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS exchange_rates (
                date TEXT,
                base_currency TEXT,
                target_currency TEXT,
                rate REAL,
                PRIMARY KEY (date, base_currency, target_currency)
            )
        ''')
        conn.commit()
        conn.close()

    def add_rate(self, date, base_currency, target_currency, rate):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO exchange_rates (date, base_currency, target_currency, rate)
            VALUES (?, ?, ?, ?)
        ''', (date, base_currency, target_currency, rate))
        conn.commit()
        conn.close()

    def get_rate(self, date, base_currency, target_currency):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT rate FROM exchange_rates
            WHERE date=? AND base_currency=? AND target_currency=?
        ''', (date, base_currency, target_currency))
        
        row = cursor.fetchone()
        conn.close()
        if row:
            return row[0]
        return None
    

    def get_nearest_rate(self, date, base_currency, target_currency):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT rate FROM exchange_rates
            WHERE date <= ? AND base_currency=? AND target_currency=?
            ORDER BY date DESC
            LIMIT 1
        ''', (date, base_currency, target_currency))
        row = cursor.fetchone()
        conn.close()
        if row:
            return row[0]
        else:
            # If no rate found try searching for the next available date
            cursor.execute('''
                SELECT rate FROM exchange_rates
                WHERE date >= ? AND base_currency=? AND target_currency=?
                ORDER BY date ASC
                LIMIT 1
            ''', (date, base_currency, target_currency))
            row = cursor.fetchone()
            conn.close()
            if row:
                return row[0]
        #if no rate found return None
        print(f"No exchange rate found for {base_currency} to {target_currency} on or around {date}.")
        return None