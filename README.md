# net-worth-tracker
## Description
Net Worth Tracker is a simple application to help you track your net worth over time. It allows you to input your financial accounts and calculates your net worth, and "total" based on the provided data.

## Screenshot
![Net Worth Tracker Screenshot](https://raw.githubusercontent.com/jheffel/net-worth-tracker/refs/heads/main/images/finance%20tracker.png)
![alt text](<images/finance tracker.png>)

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

## Notes
1. click the "Import ODS" button to load the test data at [example data](example_data/example_data.ods)

2. Replace the example data with your own account data, one sheet per account

3. any accounts you want to ignore for the 'total' account can be put into a new line in this file [ignore list](ignoreForTotal.txt)

4. In the example data the 'total' is the net worth minus the "House value"

5. Delete the [db](db/finance.db) database to start over with fresh data

## License
This project is licensed under the MIT License.