# net-worth-tracker
## Description
Net Worth Tracker is a simple application to help you track your net worth over time. It allows you to input your financial accounts and calculates your net worth, and "total" based on the provided data.

## Exchange Rate Data
Exchange rate data was sourced from https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/

https://coinmarketcap.com/currencies/bitcoin/historical-data/

coinmarketcap api for cron job daily rate collection

## Screenshot
![Snap Shot](<images/finance tracker.png>)

## Features
- Add accounts from ods data
- Calculate net worth
- View net worth history

## Installation
1. Clone the repository:
    ```bash
    git clone https://github.com/jheffel/net-worth-tracker.git
    ```

## Usage
1. Navigate to the cloned directory:
    ```bash
    cd net-worth-tracker
    ```
2. Execute the main.py:
    ```bash
    python main.py
    ```
3. click the "Import ODS" button to load the test data at [example data](example_data/example_data.ods)
## Config

Text files in the config folder allow you to designate desired accounts into some different categories. They are populated by default for the test data, modify them with your own accounts as desired.  Removing any of the .txt's in the config folder will cause them not to be calculated or displayed in the app. They include:

1. [crypto](config/crypto.txt) -> Crypto accounts

2. [equity](config/equity.txt) -> Your mortgage and property value

3. [total](config/ignoreForTotal.txt) -> A custom category that removes any account listed from the total - by default it removes the property value so you can see net worth minus the property value

4. [investing](config/investing.txt) -> investing accounts

5. [operating](config/operating.txt) -> all liquid cash or credit accounts


## Notes
1. click the "Import ODS" button to load the test data at [example data](example_data/example_data.ods)

2. Replace the example data with your own account data in ods format, one sheet per account

3. Delete the [db](db/finance.db) database to start over with fresh data

## License
This project is licensed under the MIT License.