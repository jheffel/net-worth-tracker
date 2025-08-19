import sqlite3
from datetime import datetime
import yfinance as yf
import os

class stockTicker:
    def __init__(self, db_file="db/stock.db"):
        self.db_file = db_file
        self._initialize_db()

        self.stockList = self.loadStockList()

    def _initialize_db(self):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS stock_prices (
                date TEXT,
                symbol TEXT,
                currency TEXT,
                price REAL,
                PRIMARY KEY (date, symbol)
            )
        ''')
        conn.commit()
        conn.close()

    def add_price(self, date, symbol, currency, price):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO stock_prices (date, symbol, currency, price)
            VALUES (?, ?, ?, ?)
        ''', (date, symbol, currency, price))
        conn.commit()
        conn.close()

    def get_price(self, date, symbol):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT price FROM stock_prices
            WHERE date=? AND symbol=?
        ''', (date, symbol))
        
        row = cursor.fetchone()
        conn.close()
        if row:
            return row[0]
        return None

    def get_nearest_price(self, date, symbol):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT price FROM stock_prices
            WHERE date <= ? AND symbol=?
            ORDER BY date DESC
            LIMIT 1
        ''', (date, symbol))
        row = cursor.fetchone()
        if row:
            conn.close()
            return row[0]
        else:
            # If no price found try searching for the next available date
            cursor.execute('''
                SELECT price FROM stock_prices
                WHERE date >= ? AND symbol=?
                ORDER BY date ASC
                LIMIT 1
            ''', (date, symbol))
            row = cursor.fetchone()
            conn.close()
            if row:
                return row[0]
        #if no price found return None
        print(f"No stock price found for {symbol} on or around {date}.")
        return None

    def populate_stock_data(self, symbol, startDate):
        ticker = yf.Ticker(symbol)
        info = ticker.info
        currency = info.get('currency', 'USD')
        hist = ticker.history(start=startDate)
        for date, row in hist.iterrows():
            date_str = date.strftime('%Y-%m-%d')
            price = row['Close']
            if price is not None:
                #stock_db.add_price(date_str, symbol, 'USD', price)
                self.add_price(date_str, symbol, currency, price)
                print(f"Added stock price for {symbol} in {currency} on {date_str}: {price}")
                
            else:
                print(f"No price data for {symbol} on {date_str}")


    def loadStockList(self):
        fpath = "config/stock.txt"
        if os.path.exists(fpath):
            stockList = []
            with open(fpath, "r") as file:
                for line in file:
                    stockList.append(line.strip())

            print("Stock accounts:")
            for stock in stockList:
                print("\t", stock)

            return stockList
        else:
            return False


def fetch_stock_price(symbol, date):
    ticker = yf.Ticker(symbol)
    hist = ticker.history(start=date)

    if not hist.empty:
        for date, row in hist.iterrows():
            print(f"Checking date: {date}")

            # Assuming the date is in the format 'YYYY-MM-DD'
            # and we want the closing price for that date
            if 'Close' in row:
                print(f"Found price for {symbol} on {date}: {row['Close']}")
                return row['Close']
            else:
                print(f"No 'Close' price available for {symbol} on {date}.")
                return None
        # If the date is not found, we can return the first available close price
        print(f"Date {date} not found for {symbol}, returning first available close price.")
        if not hist.empty:
            hist = hist.reset_index()
            if 'Close' in hist.columns:
                # Return the first available close price
                if not hist['Close'].empty:
                    # Get the first row's close price
                    hist = hist.sort_values(by='Date')
                    hist = hist.reset_index(drop=True)
                    if 'Close' in hist.columns:
                        if not hist['Close'].empty:
                            # Return the first close price
                            return hist['Close'][0]
        # If no close price is available, return None
        print(f"No stock price data available for {symbol} on {date}.")
        return None
    else:
        print(f"No historical data available for {symbol} on {date}.")
        return None


def test(symbol, date):
    ticker = yf.Ticker(symbol)
    hist = ticker.history(start=date)

    if not hist.empty:
        hist = hist.reset_index()
        if 'Currency' in hist.columns:
            currency = hist['Currency'][0]
            print(f"Currency for {symbol} on {date}: {currency}")
            return currency
        else:
            # Try to get currency from ticker.info
            info = ticker.info
            currency = info.get('currency', None)
            print(f"Currency for {symbol} from ticker.info: {currency}")
            return currency
    else:
        print(f"No historical data available for {symbol} on {date}.")
        return None




def main():
    #populate_stock_data("MSFT", "2022-11-01")
    #populate_stock_data("AAPL", "2022-11-01")

    #print(fetch_stock_price("AAPL", "2023-10-01"))
    #print(fetch_stock_price("AAPL", "2025-07-17"))
    #print(fetch_stock_price("AAPL", "2025-07-18"))

    stockList

if __name__ == "__main__":
    main()