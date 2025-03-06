import sqlite3
from datetime import datetime, timedelta
import os


class FinanceModel:
    def __init__(self, db_file="db/finance.db"):

        #list of accounts to ignore when calculating total net worth
        self.ignoreForTotalList = self.loadIgnoreForTotalList()

        self.db_file = db_file
        
        os.makedirs(os.path.dirname(self.db_file), exist_ok=True)

        self._initialize_db()
    
    def _initialize_db(self):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS account_balances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_name TEXT,
                date TEXT,
                balance REAL,
                UNIQUE(account_name, date)
            )
        ''')
        conn.commit()
        conn.close()

    def loadIgnoreForTotalList(self):
        ignoreForTotalList = []
        with open("ignoreForTotal.txt", "r") as file:
            for line in file:
                ignoreForTotalList.append(line.strip())

        print("Total will ignore:")
        for ignore in ignoreForTotalList:
            print("\t", ignore)

        return ignoreForTotalList

    def add_balance(self, account_name, date, balance):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO account_balances (account_name, date, balance)
            VALUES (?, ?, ?)
            ON CONFLICT(account_name, date) DO UPDATE SET balance=excluded.balance
        """, (account_name, date, balance))
        conn.commit()
        conn.close()

    def load_data(self):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("SELECT account_name, date, balance FROM account_balances ORDER BY date")
        data = cursor.fetchall()
        conn.close()
        
        account_data = {}
        net_worth = {}
        total = {}  
        for account_name, date_str, balance in data:
            date = datetime.strptime(date_str, "%Y-%m-%d")
            if account_name not in account_data:
                account_data[account_name] = {}
            
            account_data[account_name][date] = balance

        #extend all data to current date
        for account_name in account_data:
            last_date = max(account_data[account_name].keys())
            last_balance = account_data[account_name][last_date]
            account_data[account_name][datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)] = last_balance

        #sort the account data by date
        for account_name in account_data:
            account_data[account_name] = dict(sorted(account_data[account_name].items()))


        #interpolate all data for all dates available in the data
        all_dates = set()
        for account_name in account_data:
            all_dates.update(account_data[account_name].keys())
        all_dates = sorted(all_dates)

        for account_name in account_data:
            #print("account name:", account_name)
            for date in all_dates:

                #print("date:", date)

                if date not in account_data[account_name].keys():
                    
                    #check if this is the first recorded date for this account
                    if date > min(account_data[account_name].keys()):

                        previous_date = max(d for d in account_data[account_name] if d < date)
                        previous_balance = account_data[account_name][previous_date]

                        #check if this is the last recorded date for this account
                        if date < datetime.now().replace(hour=0, minute=0, second=0, microsecond=0):
                            next_date = min(d for d in account_data[account_name] if d > date)
                            next_balance = account_data[account_name][next_date]

                            #update the account data with the interpolated balance
                            account_data[account_name][date] = previous_balance + (next_balance - previous_balance) * (date - previous_date).days / (next_date - previous_date).days


        #sort the account data by date
        for account_name in account_data:
            account_data[account_name] = dict(sorted(account_data[account_name].items()))

        #calculate the net worth, total, and equity
        for account_name, data in account_data.items():
            for date, balance in data.items():

                #calculate the total of everything minus accounts in the ignore list
                if account_name not in self.ignoreForTotalList:
                    totalAccount = "total"
                    if totalAccount not in total:
                        total[totalAccount] = {}
    
                    if date not in total[totalAccount]:
                        total[totalAccount][date] = balance
                    else:
                        total[totalAccount][date] += balance
                
                #calculate overall net worth with no exclusions
                netWorthAccount = "net worth"
                if netWorthAccount not in net_worth:
                    net_worth[netWorthAccount] = {}

                if date not in net_worth[netWorthAccount]:
                    net_worth[netWorthAccount][date] = balance
                else:
                    net_worth[netWorthAccount][date] += balance

        # Sort the net worth dictionary by date
        for account_name in net_worth:
            net_worth[account_name] = dict(sorted(net_worth[account_name].items()))

        #sort the total dictionary by date
        for account_name in total:
            total[account_name] = dict(sorted(total[account_name].items()))

        account_data.update(net_worth)
        account_data.update(total)

        return account_data

