import sqlite3
from datetime import datetime
import os


class FinanceModel:
    def __init__(self, db_file="db/finance.db"):
        
        self.networthData = {}

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
        print(ignoreForTotalList)
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
        for account_name, date_str, balance in data:
            date = datetime.strptime(date_str, "%Y-%m-%d")
            if account_name not in account_data:
                #account_data[account_name] = ([], [])
                account_data[account_name] = {}
            
            account_data[account_name][date] = balance

            #account_data[account_name][0].append(date)
            #account_data[account_name][1].append(balance)

            #calculate total net worth minus house value
            if account_name not in self.ignoreForTotalList:
                netWorthAccount = "total"
                if netWorthAccount not in net_worth:
                    net_worth[netWorthAccount] = {}
                #net_worth["net worth"][0].append(date) #set the date
                #net_worth["net worth"][1].append(balance) #add the balance to the net worth
                if date not in net_worth[netWorthAccount]:
                    net_worth[netWorthAccount][date] = balance
                else:
                    net_worth[netWorthAccount][date] += balance
 

        account_data.update(net_worth)

        return account_data

'''
    def calculate_net_worth(self):
        data = self.load_data()
        net_worth = {}
        
        for account_name, (dates, balances) in data.items():
            for date, balance in zip(dates, balances):
                if date not in net_worth:
                    net_worth[date] = 0
                net_worth[date] += balance
        
        sorted_net_worth = sorted(net_worth.items())
        dates, net_worth_values = zip(*sorted_net_worth)
        
        self.networthData = sorted_net_worth

        #return dates, net_worth_values
'''