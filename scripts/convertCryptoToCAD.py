import csv
import json
import requests
from datetime import datetime

from exchange_rates import ExchangeRate

# Example: Fetch USD to CAD exchange rate (you can use a fixed rate if you prefer)
def get_usd_to_cad_rate(date, base='USD', target='CAD'):

    db = ExchangeRate()

    rate = db.get_nearest_rate(date, base, target)
    if rate is not None:
        print(f"Exchange rate on {date} from {base} to {target}: {rate}")
    else:
        print(f"No rate found for {base}/{target} on {date}")

    return rate

def addData(date, currency, close):
    db = ExchangeRate()
    db.add_rate(date, currency, "CAD", close)

# Read your data (assume CSV with columns: open_time, open_date, close_price)
def read_data(csv_file):
    with open(csv_file, newline='') as f:
        reader = csv.DictReader(f)
        return list(reader)

def convert_and_write_json(data, usd_to_cad_rate, output_file):
    output = []
    for row in data:
        close_price_usd = float(row['close_price'])
        close_price_cad = round(close_price_usd * usd_to_cad_rate, 2)
        output.append({
            'open_time': row['open_time'],
            'open_date': row['open_date'],
            'close_price_CAD': close_price_cad
        })
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)

if __name__ == "__main__":


    # Step 2: Read your CSV data

    queue = {}


    dataPath = 'data/raw/Bitcoin_2021-08-23-2021-10-22_historical_data_coinmarketcap.csv'
    currency = "BTC"

    queue[currency] = dataPath

    dataPath = "data/raw/Bitcoin Cash_2021-10-20-2021-12-19_historical_data_coinmarketcap.csv"
    currency = "BCH"
    
    queue[currency] = dataPath

    dataPath = "data/raw/Cardano_2020-12-27-2021-02-26_historical_data_coinmarketcap.csv"
    currency = "ADA"

    queue[currency] = dataPath

    dataPath = "data/raw/Dogecoin_2021-08-02-2021-10-01_historical_data_coinmarketcap.csv"
    currency = "DOGE"
    
    queue[currency] = dataPath
    dataPath = "data/raw/Ethereum_2021-10-01-2021-11-30_historical_data_coinmarketcap.csv"
    currency = "ETH"

    queue[currency] = dataPath
    dataPath = "data/raw/XRP_2021-06-24-2021-08-23_historical_data_coinmarketcap.csv"
    currency = "XRP"

    queue[currency] = dataPath


    for currency, dataPath in queue.items():
        data = read_data(dataPath)  # Replace with your CSV filename

        for row in data:
            #print (row)
            for key, value in row.items():
                print (key)
                print (value)

                date = value.split(";")[0]
                date = date.split('T')[0]
                close = value.split(";")[8]
                usdCadRate = get_usd_to_cad_rate(date, base='USD', target='CAD')
                closeCad = float(close) * usdCadRate
                print ("date: {}".format(date))
                print ("close: {}".format(close))
                print ("closeCad: {}".format(closeCad))
                print ("usdCadRate: {}".format(usdCadRate))
                print ("currency: {}".format(currency))

                #Write to the database
                addData(date, currency, closeCad)

            print ("--------------------")
            print ("\n")

        # Step 1: Get exchange rate
        #usd_to_cad = get_usd_to_cad_rate()
        #print(f"USD to CAD rate: {usd_to_cad}")



        # Step 3: Convert and write to JSON
        #convert_and_write_json(data, usd_to_cad, 'output.json')
        #print("Done! Data written to output.json")

        