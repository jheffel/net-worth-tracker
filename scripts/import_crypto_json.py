import json
from datetime import datetime
import fetch_coinmarketcap
import os

def main():
    current_date = datetime.now().strftime('%Y-%m-%d')
    print("Current date:", current_date)

    input_path = "data/coinmarketcap_response/{}.json".format(current_date)

    if not os.path.exists(input_path):
        print("Data for today does not exist:", input_path)
        fetch_coinmarketcap.main()


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
if __name__ == "__main__":
    main()