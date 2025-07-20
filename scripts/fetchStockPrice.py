import yfinance as yf
from datetime import datetime
import os
import json
import sys

# Get the current script's directory
current_dir = os.path.dirname(os.path.abspath(__file__))
# Get the parent directory
parent_dir = os.path.dirname(current_dir)
# Add the parent directory to sys.path
sys.path.append(parent_dir)
# Now you can import modules from the parent directory
import stocks

def fetch_stock_price(symbol, date):
    ticker = yf.Ticker(symbol)
    hist = ticker.history(start=date, end=date)
    if not hist.empty:
        return hist['Close'][0]
    return None


def get_stock_data(symbol, startDate):
    
    data = {}
    
    ticker = yf.Ticker(symbol)
    info = ticker.info
    currency = info.get('currency', None)
    hist = ticker.history(start=startDate)
    for date, row in hist.iterrows():
        date_str = date.strftime('%Y-%m-%d')
        price = row['Close']
        if price is not None:
            #stock_db.add_price(date_str, symbol, 'USD', price)
            #db.add_price(date_str, symbol, currency, price)
            print(f"Added stock price for {symbol} in {currency} on {date_str}: {price}")

            if symbol not in data:
                data[symbol] = {}

            if currency not in data[symbol]:
                data[symbol][currency] = {}

            data[symbol][currency][date_str] = price

        else:
            print(f"No price data for {symbol} on {date_str}")

    return data

def write_to_json(data, output_path):
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=4)
    print(f"Data written to {output_path}")

def loadStockList(basePath=""):
    fpath = "{}config/stock.txt".format(basePath)
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




def addDatatoDB(data, db):



    print(data)

    for symbol in data.keys():
        for currency in data[symbol].keys():
            for date, price in data[symbol][currency].items():
                db.add_price(date, symbol, currency, price)
                print(f"Added stock price for {symbol} in {currency} on {date}: {price}")

    print("Data added to database successfully.")


def addHistoricalDataToDB():

    basePath = parent_dir + "/"

    db = stocks.stockTicker("{}db/stock.db".format(basePath))
    startDate = "2021-01-01"  # Example start date for historical data

    stockList = loadStockList(basePath)
    if not stockList:
        print("No stock accounts found.")
        return

    for stock in stockList:
        print(f"Fetching historical data for {stock}...")
        # Fetch historical data for the stock
        data = get_stock_data(stock, startDate)
        if data:
            addDatatoDB(data, db)
        else:
            print(f"No historical data found for {stock}.")


def runDaily():

    current_date = datetime.now().strftime('%Y-%m-%d')
    print("Current date:", current_date)


    basePath = parent_dir + "/"

    stockList = loadStockList(basePath)
    if not stockList:
        print("No stock accounts found.")
        return


    output_path = "{}data/stock_prices/{}.json".format(basePath, current_date)


    #check if we already have data for today
    if os.path.exists(output_path):
        print("Data for today already exists:", output_path)
        return

    else:
        #get the data
        allData = {}
        for stock in stockList:
            print(f"Fetching data for {stock}...")

            data = get_stock_data(stock, current_date)
            allData.update(data)

        #write the data to json
        write_to_json(allData, output_path)

  
    
    db = stocks.stockTicker("{}db/stock.db".format(basePath))
    passed = True
    #check if we need to add data to DB
    for stock in stockList:
        price = db.get_price(current_date, stock)
        if price is None:
            print(f"No rate found for {stock} on {current_date} in database")
            passed = False
        else:
            print(f"Price for {stock} on {current_date} already exists in DB.")

    if not passed:
        # If we don't have all rates, we add data to DB
        with open(output_path, "r") as f:
            data = json.load(f)
        if data:
            addDatatoDB(data, db)
        else:
            print("No data to add to DB.")



def main():
    #addHistoricalDataToDB()
    runDaily()


if __name__ == "__main__":
    main()