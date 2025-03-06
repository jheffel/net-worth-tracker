import sqlite3
from datetime import datetime, timedelta
import os
import json


class FinanceModel:
    def __init__(self, db_file="db/finance.db"):

        #list of accounts to ignore when calculating total net worth
        self.ignoreForTotalList = self.loadIgnoreForTotalList()
        self.operatingList = self.loadOperatingList()
        self.investingList = self.loadInvestingList()
        self.cryptoList = self.loadCryptoList()
        self.equityList = self.loadEquityList()

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

    def loadEquityList(self):
        
        fpath = "config/equity.txt"

        if os.path.exists(fpath):
            equityList = []
            with open(fpath, "r") as file:
                for line in file:
                    equityList.append(line.strip())

            print("Equity accounts:")
            for equity in equityList:
                print("\t", equity)

            return equityList
        else:
            return False

    def loadOperatingList(self):
        
        fpath = "config/operating.txt"
        
        if os.path.exists(fpath):
            operatingList = []
            with open(fpath, "r") as file:
                for line in file:
                    operatingList.append(line.strip())

            print("Operating accounts:")
            for operating in operatingList:
                print("\t", operating)

            return operatingList
        else:    
            return False

    def loadInvestingList(self):
        
        fpath = "config/investing.txt"
        
        if os.path.exists(fpath):
            investingList = []
            with open(fpath, "r") as file:
                for line in file:
                    investingList.append(line.strip())

            print("investing accounts:")
            for investing in investingList:
                print("\t", investing)

            return investingList
        else:
            return False

    def loadCryptoList(self):
        fpath = "config/crypto.txt"
        if os.path.exists(fpath):
            cryptoList = []
            with open(fpath, "r") as file:
                for line in file:
                    cryptoList.append(line.strip())
            
            print("crypto accounts:")
            for crypto in cryptoList:  
                print("\t", crypto)

            return cryptoList
        else:
            return False

    def loadIgnoreForTotalList(self):
        fpath = "config/ignoreForTotal.txt"
        if os.path.exists(fpath):
            ignoreForTotalList = []
            with open(fpath, "r") as file:
                for line in file:
                    ignoreForTotalList.append(line.strip())

            print("Total will ignore:")
            for ignore in ignoreForTotalList:
                print("\t", ignore)

            return ignoreForTotalList
        else:
            return False

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
        operating = {}
        investing = {}
        crypto = {}
        equity = {}

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

        #calculate the net worth, total, operating, total investing, crypto, and equity
        for account_name, data in account_data.items():
            for date, balance in data.items():

                #calculate the total of everything minus accounts in the ignore list
                if self.ignoreForTotalList:
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

                #calculate the total of all operating accounts
                if self.operatingList:
                    if account_name in self.operatingList:
                        operatingAccount = "operating"
                        if operatingAccount not in operating:
                            operating[operatingAccount] = {}

                        if date not in operating[operatingAccount]:
                            operating[operatingAccount][date] = balance
                        else:
                            operating[operatingAccount][date] += balance

                #calculate the total of all investing accounts
                if self.investingList:
                    if account_name in self.investingList:
                        investingAccount = "investing"
                        if investingAccount not in investing:
                            investing[investingAccount] = {}

                        if date not in investing[investingAccount]:
                            investing[investingAccount][date] = balance
                        else:
                            investing[investingAccount][date] += balance

                #calculate the total of all crypto accounts
                if self.cryptoList:
                    if account_name in self.cryptoList:
                        cryptoAccount = "crypto"
                        if cryptoAccount not in crypto:
                            crypto[cryptoAccount] = {}

                        if date not in crypto[cryptoAccount]:
                            crypto[cryptoAccount][date] = balance
                        else:
                            crypto[cryptoAccount][date] += balance

                #calculate the total of all equity accounts
                if self.equityList:
                    if account_name in self.equityList:
                        equityAccount = "equity"
                        if equityAccount not in equity:
                            equity[equityAccount] = {}

                        if date not in equity[equityAccount]:
                            equity[equityAccount][date] = balance
                        else:
                            equity[equityAccount][date] += balance


        if equity:

            #sort the equity dictionary by date
            for account_name in equity:
                equity[account_name] = dict(sorted(equity[account_name].items()))

            account_data.update(equity)

        if net_worth:
            # Sort the net worth dictionary by date
            for account_name in net_worth:
                net_worth[account_name] = dict(sorted(net_worth[account_name].items()))

            account_data.update(net_worth)
        
        if total:
            #sort the total dictionary by date
            for account_name in total:
                total[account_name] = dict(sorted(total[account_name].items()))

            account_data.update(total)

        if operating:
            #sort the operating dictionary by date
            for account_name in operating:
                operating[account_name] = dict(sorted(operating[account_name].items()))

            account_data.update(operating)

        if investing:
            #sort the investing dictionary by date
            for account_name in investing:
                investing[account_name] = dict(sorted(investing[account_name].items()))

            account_data.update(investing)
        
        if crypto:
            #sort the crypto dictionary by date
            for account_name in crypto:
                crypto[account_name] = dict(sorted(crypto[account_name].items()))

            account_data.update(crypto)

        return account_data

