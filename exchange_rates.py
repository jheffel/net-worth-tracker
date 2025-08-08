import sqlite3
from datetime import datetime
from functools import lru_cache
from contextlib import contextmanager


class ExchangeRate:
    def __init__(self, db_file="db/exchange_rates.db"):
        self.db_file = db_file
        self._initialize_db()
        self._rate_cache = {}  # Simple cache for frequently accessed rates

    @contextmanager
    def get_db_connection(self):
        """Context manager for database connections."""
        conn = sqlite3.connect(self.db_file)
        try:
            yield conn
        finally:
            conn.close()

    def _initialize_db(self):
        with self.get_db_connection() as conn:
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

    def add_rate(self, date, base_currency, target_currency, rate):
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO exchange_rates (date, base_currency, target_currency, rate)
                VALUES (?, ?, ?, ?)
            ''', (date, base_currency, target_currency, rate))
            conn.commit()
            # Clear cache when new rates are added
            self._rate_cache.clear()

    @lru_cache(maxsize=1024)
    def get_rate(self, date, base_currency, target_currency):
        """Cached version of get_rate for better performance."""
        cache_key = f"{date}_{base_currency}_{target_currency}"
        if cache_key in self._rate_cache:
            return self._rate_cache[cache_key]
        
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT rate FROM exchange_rates
                WHERE date=? AND base_currency=? AND target_currency=?
            ''', (date, base_currency, target_currency))
            
            row = cursor.fetchone()
            result = row[0] if row else None
            self._rate_cache[cache_key] = result
            return result

    @lru_cache(maxsize=1024)
    def get_nearest_rate(self, date, base_currency, target_currency):
        """Cached version of get_nearest_rate for better performance."""
        cache_key = f"nearest_{date}_{base_currency}_{target_currency}"
        if cache_key in self._rate_cache:
            return self._rate_cache[cache_key]
        
        with self.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT rate FROM exchange_rates
                WHERE date <= ? AND base_currency=? AND target_currency=?
                ORDER BY date DESC
                LIMIT 1
            ''', (date, base_currency, target_currency))
            row = cursor.fetchone()
            if row:
                result = row[0]
                self._rate_cache[cache_key] = result
                return result
            else:
                # If no rate found try searching for the next available date
                cursor.execute('''
                    SELECT rate FROM exchange_rates
                    WHERE date >= ? AND base_currency=? AND target_currency=?
                    ORDER BY date ASC
                    LIMIT 1
                ''', (date, base_currency, target_currency))
                row = cursor.fetchone()
                result = row[0] if row else None
                self._rate_cache[cache_key] = result
                if result is None:
                    print(f"No exchange rate found for {base_currency} to {target_currency} on or around {date}.")
                return result