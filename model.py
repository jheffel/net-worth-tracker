import sqlite3
from datetime import datetime, timedelta
import os
import json
import exchange_rates
import stocks


class FinanceModel:
    def __init__(self, db_file="db/finance.db"):

        #list of accounts to ignore when calculating total net worth
        self.ignoreForTotalList = self.loadIgnoreForTotalList()
        self.operatingList = self.loadOperatingList()
        self.investingList = self.loadInvestingList()
        self.cryptoList = self.loadCryptoList()
        self.equityList = self.loadEquityList()
        self.summaryList = self.loadSummaryList()

        self.available_currencies = self.loadCurrencyList()
        self.main_currency = "CAD"  # Default main currency

        #self.stockList = self.loadStockList()

        self.db_file = db_file
        
        os.makedirs(os.path.dirname(self.db_file), exist_ok=True)

        self._initialize_db()
        self.exchangeRate = exchange_rates.ExchangeRate()
        self.stock = stocks.stockTicker()


    def loadCurrencyList(self):
        fpath = "config/currency.txt"
        if os.path.exists(fpath):
            with open(fpath, "r") as file:
                currencies = [line.strip() for line in file if line.strip()]
            print("Available currencies:")
            for currency in currencies:
                print("\t", currency)
            return currencies



    
    def _initialize_db(self):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS account_balances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_name TEXT,
                date TEXT,
                balance REAL,
                currency TEXT,
                ticker TEXT,
                UNIQUE(account_name, date, currency, ticker)
            )
        ''')
        conn.commit()
        conn.close()

    # def loadStockList(self):
    #     fpath = "config/stock.txt"
    #     if os.path.exists(fpath):
    #         stockList = []
    #         with open(fpath, "r") as file:
    #             for line in file:
    #                 stockList.append(line.strip())

    #         print("Stock accounts:")
    #         for stock in stockList:
    #             print("\t", stock)

    #         return stockList
    #     else:
    #         return False
        

    def loadSummaryList(self):
        
        fpath = "config/summary.txt"
        
        if os.path.exists(fpath):
            summaryList = []
            with open(fpath, "r") as file:
                for line in file:
                    summaryList.append(line.strip())

            print("Summary accounts:")
            for summary in summaryList:
                print("\t", summary)

            return summaryList
        else:    
            return False


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

    def add_balance(self, account_name, date, balance, currency, ticker):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO account_balances (account_name, date, balance, currency, ticker)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(account_name, date, currency, ticker) DO UPDATE SET balance=excluded.balance
        """, (account_name, date, balance, currency, ticker))
        conn.commit()
        conn.close()


#    def get_account_currency(self, account):
#        # Try to get the currency for an account from the model, fallback to main_currency
#        if hasattr(self.model, 'get_account_currency'):
#            return self.model.get_account_currency(account)
#        if hasattr(self.model, 'account_currency_map'):
#            return self.model.account_currency_map.get(account, self.main_currency)
#        return self.main_currency

    def convert_to_main(self, date, amount, currency):

        if isinstance(date, datetime):
            date = date.replace(hour=0, minute=0, second=0, microsecond=0)
            #print(f"date: {date}")
            date = date.strftime("%Y-%m-%d")
            #print(f"date_stripped: {date}")
 
        #print(f"Converting {amount} from {currency} to main currency ({self.main_currency}) on date {date}")

        if currency == self.main_currency:
            return amount
        
        currencytoCAD_rate = False
        if currency == "CAD":
            currencytoCAD_rate = 1.0  # No conversion needed if already in CAD
        else:
            currencytoCAD_rate = self.exchangeRate.get_nearest_rate(date, currency, "CAD")

        #if currencytoCAD_rate is not None:
        #    print(f"Exchange rate on {date} from {currency} to CAD: {currencytoCAD_rate}")
        #else:
        #    print(f"No rate found for {currency}/CAD on {date}")


        cad_amount = amount * currencytoCAD_rate  # Convert to CAD

        MaintoCAD_rate = False
        # If the main currency is CAD, we don't need to convert
        if self.main_currency == "CAD":
            MaintoCAD_rate = 1.0
        else:
            MaintoCAD_rate = self.exchangeRate.get_nearest_rate(date, self.main_currency, "CAD")
            #if MaintoCAD_rate is not None:
            #    print(f"Exchange rate on {date} from CAD to {self.main_currency}: {MaintoCAD_rate}")
            #else:
            #    print(f"No rate found for CAD/{self.main_currency} on {date}")


        return cad_amount / MaintoCAD_rate  # Convert to main

        return amount  # Fallback: no conversion

    def load_data(self):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("SELECT account_name, date, balance, currency, ticker FROM account_balances ORDER BY date")
        data = cursor.fetchall()
        conn.close()
        
        account_data = {}
        net_worth = {}
        total = {}
        operating = {}
        investing = {}
        crypto = {}
        equity = {}

        timeNow = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

        invalid_currencies = {}

        for account_name, date_str, balance, currency, ticker in data:

            #print(f"Processing account: {account_name}, date: {date_str}, balance: {balance}, currency: {currency}, ticker: {ticker}")

            # Ensure the currency is in the available currencies
            if currency not in self.available_currencies:
                if account_name not in invalid_currencies:
                    invalid_currencies[account_name] = set()
                invalid_currencies[account_name] = invalid_currencies[account_name].union({currency})
                
            else:
                date = datetime.strptime(date_str, "%Y-%m-%d")
                if account_name not in account_data:
                    account_data[account_name] = {}

                if currency not in account_data[account_name]:
                    account_data[account_name][currency] = {}

                if ticker not in account_data[account_name][currency]:
                    account_data[account_name][currency][ticker] = {}

                if date not in account_data[account_name][currency][ticker]:
                    account_data[account_name][currency][ticker][date] = {}
                    
                account_data[account_name][currency][ticker][date] = balance
            
        #for account_name, currencies in invalid_currencies.items():
            #for currency in currencies:
                #print(f"Warning: Currency '{currency}' for account '{account_name}' is not in available currencies. Skipping.")


        #extend all data to current date
        for account_name in account_data:
            #print(f"Extending data for account: {account_name}")
        
            for currency in account_data[account_name].keys():
                #print(f"Extending data for currency: {currency} in account: {account_name}")
                
                for ticker in account_data[account_name][currency].keys():
                    last_date = max(account_data[account_name][currency][ticker].keys())
                    #print(f"Last date for {account_name} {ticker} in {currency}: {last_date}")
                    last_balance = account_data[account_name][currency][ticker][last_date]
                    account_data[account_name][currency][ticker][timeNow] = last_balance

        #sort the account data by date
        for account_name in account_data:
            for currency in account_data[account_name].keys():
                for ticker in account_data[account_name][currency].keys():
                    account_data[account_name][currency][ticker] = dict(sorted(account_data[account_name][currency][ticker].items()))
                #account_data[account_name][currency] = dict(sorted(account_data[account_name][currency].items()))



        #interpolate all data for all dates available in the data
        all_dates = set()
        for account_name in account_data:
            for currency in account_data[account_name].keys():
                for ticker in account_data[account_name][currency].keys():
                    all_dates.update(account_data[account_name][currency][ticker].keys())
                #all_dates.update(account_data[account_name][currency].keys())
        all_dates = sorted(all_dates)

        #add dates by interval
        if all_dates:
            firstDate = min(all_dates)
            lastDate = max(all_dates)
            interval = timedelta(days=10)  # Daily interval
            current_date = firstDate

            while current_date <= lastDate:
                all_dates.append(current_date)
                current_date += interval

            all_dates = sorted(set(all_dates))


        for account_name in account_data:
            for currency in account_data[account_name].keys():
                for ticker in account_data[account_name][currency].keys():
                    for date in all_dates:
                        if date not in account_data[account_name][currency][ticker].keys():
                            
                            #check if this is the first recorded date for this account
                            if date > min(account_data[account_name][currency][ticker].keys()):
            
                                previous_date = max(d for d in account_data[account_name][currency][ticker] if d < date)
                                previous_balance = account_data[account_name][currency][ticker][previous_date]
            
                                #check if this is the last recorded date for this account
                                #print("date:", date, type(date))
                                #timeNow = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
                                #print("time now:", timeNow, type(timeNow))
            
                                if date < timeNow:
            
                                    next_date = min(d for d in account_data[account_name][currency][ticker] if d > date)
                                    next_balance = account_data[account_name][currency][ticker][next_date]
            
                                    #update the account data with the interpolated balance
                                    #print(f"Interpolating balance for {account_name} on {date} in {currency}: previous date {previous_date} with balance {previous_balance}, next date {next_date} with balance {next_balance}")
            
                                    account_data[account_name][currency][ticker][date] = previous_balance + (next_balance - previous_balance) * (date - previous_date).days / (next_date - previous_date).days


        #sort the account data by date
        for account_name in account_data:
            for currency in account_data[account_name].keys():
                for ticker in account_data[account_name][currency].keys():
                    account_data[account_name][currency][ticker] = dict(sorted(account_data[account_name][currency][ticker].items()))
                #account_data[account_name][currency] = dict(sorted(account_data[account_name][currency].items()))
            #account_data[account_name] = dict(sorted(account_data[account_name].items()))


        #convert currencies to main currency
        for account_name in account_data:
            for currency in account_data[account_name].keys():
                for ticker in account_data[account_name][currency].keys():
                    for date, balance in account_data[account_name][currency][ticker].items():
                        #convert the balance to the ticker currency
                        if ticker:
                            balance = balance * self.stock.get_nearest_price(date, ticker)
                        #convert the balance to the main currency
                        converted_balance = self.convert_to_main(date, balance, currency)
                        account_data[account_name][currency][ticker][date] = converted_balance

        #print("Account data after conversion:", account_data)



        #merge all the currencies in to the main currency
        newData = {}
        for account_name in account_data:
            if account_name not in newData:
                newData[account_name] = {}
            for currency in account_data[account_name].keys():
                for ticker in account_data[account_name][currency].keys():
                    for date, balance in account_data[account_name][currency][ticker].items():
                        if date not in newData[account_name]:
                            newData[account_name][date] = 0
                        newData[account_name][date] += balance
       
        account_data = newData
        #print("\n\n\n\n\n\nAccount data after merging currencies:", account_data)


        #calculate the net worth, total, operating, total investing, crypto, and equity
        for account_name, data in account_data.items():
            #print(f"Processing account: {account_name}")
            #for currency, data2 in data.items():
            #print(f"Processing currency: {currency} for account: {account_name}")
            for date, balance in data.items():
                #print(f"Processing date: {date} with balance: {balance} for account: {account_name} in currency: {currency}")

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

