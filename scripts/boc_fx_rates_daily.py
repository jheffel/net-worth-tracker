import requests
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
import exchange_rates 

def getResponse(current_date, output_path):
    print("Fetching data from Bank of Canada...")

    url = "https://www.bankofcanada.ca/valet/observations/group/FX_RATES_DAILY/json?start_date={}".format(current_date)

    response = requests.get(url)
    response.raise_for_status()  # Raises an error if the request failed

    with open(output_path, "w") as f:
        f.write(response.text)

    print(f"Exchange rate data saved to {output_path}")


def addDatatoDB(input_path, db):
    with open(input_path, "r") as f:
        data = json.load(f)

    observations = data.get("observations", [])
    series_detail = data.get("seriesDetail", {})

    for obs in observations:
        date = obs.get("d")
        if not date:
            continue
        for pair, value in obs.items():
            if pair == "d":
                continue
            rate = value.get("v")
            if not rate:
                continue
            # Parse base and target currency from the seriesDetail
            detail = series_detail.get(pair)
            if not detail:
                continue
            label = detail.get("label")  # e.g., "USD/CAD"
            if not label or "/" not in label:
                continue
            base_currency, target_currency = label.split("/")
            db.add_rate(date, base_currency, target_currency, float(rate))
            print(f"Added {base_currency}/{target_currency} : {rate} for {date} to the database.")


def main():

    current_date = datetime.now().strftime('%Y-%m-%d')
    print("Current date:", current_date)


    basePath = parent_dir + "/"


    output_path = "{}data/boc_fx_rates/{}.json".format(basePath, current_date)


    #check if we already have data for today
    if os.path.exists(output_path):
        print("Data for today already exists:", output_path)
        return

    else:
        getResponse(current_date, output_path)

    currencies = ["USD",
                  "INR",
                  "IDR",
                  "JPY",
                  "TWD",
                  "TRY",
                  "KRW",
                  "SEK",
                  "CHF",
                  "EUR",
                  "HKD",
                  "MXN",
                  "NZD",
                  "SAR",
                  "SGD",
                  "ZAR",
                  "GBP",
                  "NOK",
                  "PEN",
                  "RUB",
                  "AUD",
                  "BRL",
                  "CNY"]
    
    db = exchange_rates.ExchangeRate("{}db/exchange_rates.db".format(basePath))
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
        addDatatoDB(output_path, db)





if __name__ == "__main__":
    main()