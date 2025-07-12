from requests import Request, Session
from requests.exceptions import ConnectionError, Timeout, TooManyRedirects
import json
import os
from datetime import datetime

def main():
    current_date = datetime.now().strftime('%Y-%m-%d')
    print("Current date:", current_date)

    #check if we already have data for today
    fname = 'data/coinmarketcap_response/{}.json'.format(current_date)
    if os.path.exists(fname):
        print("Data for today already exists:", fname)
        exit()

    with open('data/coinmarketcap_apikey.txt', 'r') as f:
        api_key = f.read().strip()


    url = 'https://sandbox-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest'
    parameters = {
        'symbol': 'BTC,ETH,XRP,BCH,ADA,DOGE',
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

if __name__ == "__main__":
    main()
# This script fetches cryptocurrency data from CoinMarketCap and saves it to a JSON file.
# It checks if data for the current date already exists to avoid overwriting.
# The API key is read from a file for security.
# The script handles exceptions related to network issues gracefully.
# Make sure to have the required API key in 'data/coinmarketcap_apikey.txt'.
# The output file is named with the current date in 'data/coinmarketcap_response/' directory.
# The script supports multiple cryptocurrencies: BTC, ETH, XRP, BCH, ADA, DOGE.
# The data is converted to CAD as specified in the parameters.
# Ensure you have the 'requests' library installed in your Python environment.
# You can run this script daily to keep your cryptocurrency data updated.
# Adjust the 'symbol' parameter in the 'parameters' dictionary to include or exclude cryptocurrencies as needed.
# The output JSON file will contain the latest quotes for the specified cryptocurrencies in CAD.