from requests import Request, Session
from requests.exceptions import ConnectionError, Timeout, TooManyRedirects
import json
import os
from datetime import datetime
import sys

# Get the current script's directory
current_dir = os.path.dirname(os.path.abspath(__file__))
# Get the parent directory
parent_dir = os.path.dirname(current_dir)
# Add the parent directory to sys.path
sys.path.append(parent_dir)
# Now you can import modules from the parent directory
import exchange_rates 



def addDatatoDB(input_path, db):
    with open(input_path, "r") as f:
        data = json.load(f)

    result = []
    for symbol, info in data["data"].items():
        date = info["quote"]["CAD"]["last_updated"][:10]
        cad_value = info["quote"]["CAD"]["price"]
        result.append({
            "date": date,
            "currency": symbol,
            "cad_value": cad_value
        })

    for line in result:
        print(f"{line['date']} - {line['currency']}: {line['cad_value']} CAD")
        db.add_rate(line['date'], line['currency'], 'CAD', line['cad_value'])
        
        print(f"Added {line['currency']} rate for {line['date']} to the database.")

def readApi(fname, currencies):

    print("Fetching data from CoinMarketCap API...")

    with open('{}/data/coinmarketcap_apikey.txt'.format(parent_dir), 'r') as f:
        api_key = f.read().strip()


    url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest'
    parameters = {
        'symbol': ",".join(currencies),
        'convert':'CAD'
    }
    headers = {
        'Accepts': 'application/json',
        'X-CMC_PRO_API_KEY': api_key,
    }

    session = Session()
    session.headers.update(headers)

    try:
        response = session.get(url, params=parameters)
        data = json.loads(response.text)
        print(data)

        with open(fname, 'w') as outfile:
            json.dump(data, outfile, indent=2)
        print("Data saved to:", fname)

    except (ConnectionError, Timeout, TooManyRedirects) as e:
        print(e)



def main():

    current_date = datetime.now().strftime('%Y-%m-%d')
    print("Current date:", current_date)
    fname = '{}/data/coinmarketcap_response/{}.json'.format(parent_dir, current_date)

    # Read currencies from crypto.txt
    with open(f'{parent_dir}/config/available_crypto.txt', 'r') as f:
        currencies = [line.strip() for line in f if line.strip()]

    #check if we already have data for today
    if os.path.exists(fname):
        print("Data for today already exists:", fname)
    else:
        
        readApi(fname, currencies)


    db = exchange_rates.ExchangeRate(parent_dir + "/db/exchange_rates.db")
    passed = True
    #check if we need to add data to DB
    for currency in currencies:
        rate = db.get_rate(current_date, currency, "CAD")
        if rate is None:
            print(f"No rate found for {currency} on {current_date}")
            passed = False
        else:
            print(f"Rate for {currency} on {current_date} already exists in DB.")

    if not passed:
        # If we don't have all rates, we add data to DB
        addDatatoDB(fname, db)



if __name__ == "__main__":
    main()
