import pandas as pd
from PyQt6.QtWidgets import QFileDialog, QMessageBox, QMainWindow
from datetime import datetime, timedelta
import mplcursors  # Import for interactive tooltips
from model import FinanceModel
from view import FinanceView

import matplotlib.pyplot as plt
import matplotlib.dates as mdates


def autopct_format(pct, allvals, currency):
    absolute = int(round(pct/100.*sum(allvals)))
    return f"{pct:.1f}%\n({currency} {absolute:,})"


class FinanceController(QMainWindow):
    def __init__(self):
        super().__init__()  # Call the superclass's __init__ method
        self.model = FinanceModel()
        self.view = FinanceView(self)

        self.resize(1920, 1080)  # Set initial window size

        self.txtColor = self.view.txtColor
        self.txtAlpha = self.view.txtAlpha

        self.setCentralWidget(self.view)
        self.setWindowTitle("Net Worth Tracker")


        self.update_checkboxes()
        self.plot_net_worth()

        if self.model.investingList:
            self.plot_investment_pie_chart()

        if self.model.operatingList:
            self.plot_operating_pie_chart()

        if self.model.cryptoList:
            self.plot_crypto_pie_chart()

        if self.model.equityList:
            self.plot_equity_pie_chart()

        if self.model.summaryList:
            self.plot_summary_pie_chart()





    def set_main_currency(self, currency):
        self.model.main_currency = currency
        self.plot_net_worth()
        self.plot_crypto_pie_chart()
        self.plot_operating_pie_chart()
        self.plot_investment_pie_chart()
        self.plot_equity_pie_chart()
        self.plot_summary_pie_chart()




    def update_checkboxes(self):
        account_data = self.model.load_data()
        self.view.update_account_checkboxes(account_data.keys())

    def import_from_ods(self):
        """Imports financial data from a multi-sheet ODS file into the database."""
        ods_file, _ = QFileDialog.getOpenFileName(self, "Open ODS File", "", "ODS files (*.ods)")
        if not ods_file:
            return  

        try:
            # Load all sheets from the ODS file
            sheets = pd.read_excel(ods_file, sheet_name=None, engine="odf")

            for sheet_name, df in sheets.items():
                if df.empty:
                    continue  # Skip empty sheets

                # Ensure we use the first column for the account name
                account_name = df.iloc[0, 0] if not df.empty else sheet_name  

                # Ensure only first four columns are used
                df = df.iloc[:, :5]

                #print(df.head())  # Debugging: print the first few rows of the DataFrame

                #df.columns = ["account", "date", "balance", "currency", "ticker"]  # Rename columns
                if df.shape[1] == 5:
                    df.columns = ["account", "date", "balance", "currency", "ticker"]
                elif df.shape[1] == 4:
                    df.columns = ["account", "date", "balance", "currency"]
                    df["ticker"] = ""  # Add empty ticker column
                else:
                    QMessageBox.warning(self, "Warning", f"Sheet '{sheet_name}' has unexpected number of columns ({df.shape[1]}). Skipping.")
                    continue


                for _, row in df.iterrows():
                    #print(f"Processing row:{_} {row}")  # Debugging: print each row being processed

                    try:
                        # Skip row if 'date' or 'balance' is missing or invalid
                        if pd.isna(row['date']) or pd.isna(row['balance']):
                            continue
                                
                        date = str(row["date"].date()).strip()
                        datetime.strptime(date, "%Y-%m-%d")  # Validate date format
                        #print("date {}".format(date))

                        currency = str(row["currency"]).strip()
                        #print("currency: {}".format(currency))

                        ticker = str(row["ticker"]).strip()
                        #print("ticker:{}".format(ticker))
                        if ticker == "NaN":
                            ticker = ""
                        if ticker == "nan":
                            ticker = ""
                        #print("ticker:{}".format(ticker))

                        balance = str(row["balance"]).strip().replace("$", "").replace(",", "")
                        if balance and currency:
                            self.model.add_balance(account_name, date, float(balance), currency, ticker)


                    except ValueError:
                        print(f"Invalid date or balance in row: {row}")

            QMessageBox.information(self, "Success", "Data successfully imported from ODS!")

        except Exception as e:
            QMessageBox.critical(self, "Error", f"Error importing ODS: {e}")

        # Update checkboxes after importing data
        self.update_checkboxes()
        self.plot_net_worth()
        self.plot_crypto_pie_chart()
        self.plot_operating_pie_chart()
        self.plot_investment_pie_chart()
        self.plot_equity_pie_chart()
        self.plot_summary_pie_chart()


    def toggle_all_accounts(self):
        """Toggles all account checkboxes between checked and unchecked."""
        new_state = not all(var.isChecked() for var in self.view.account_check_vars.values())  
        for var in self.view.account_check_vars.values():
            var.setChecked(new_state)

        # Refresh the graph after toggling checkboxes
        self.plot_net_worth()

        if self.model.investingList:
            self.plot_investment_pie_chart()

        if self.model.operatingList:
            self.plot_operating_pie_chart()

        if self.model.cryptoList:
            self.plot_crypto_pie_chart()

        if self.model.equityList:
            self.plot_equity_pie_chart()

        if self.model.summaryList:
            self.plot_summary_pie_chart()   

    def plot_crypto_pie_chart(self, *args):
        account_balances = {}
        date = args[0] if args else datetime.today().date()

        if isinstance(date, str):
            date = datetime.strptime(date, "%Y-%m-%d")

        account_data = self.model.load_data()
        if self.model.cryptoList:
            for account in self.model.cryptoList:
                if account in account_data:
                    if date in account_data[account]:
                        account_balances[account] = account_data[account][date]
                    else:
                        #interpolate
                        dates = list(account_data[account].keys())

                        balances = list(account_data[account].values())
                        
                        for i in range(len(dates) - 1):
                            prev_date, next_date = dates[i].date(), dates[i + 1].date()

                            if isinstance(date, datetime):
                                date = date.date()


                            if prev_date < date < next_date:
                                prev_balance, next_balance = balances[i], balances[i + 1]
                                days_diff = (next_date - prev_date).days
                                balance_diff = next_balance - prev_balance
                                days_to_target = (date - prev_date).days
                                interpolated_balance = prev_balance + (balance_diff / days_diff) * days_to_target
                                account_balances[account] = interpolated_balance
                                break


            # Sum all account balances for the crypto pie chart
            total_balance = sum(account_balances.values())

            removeZeroKeys = []

            for key, value in account_balances.items():
                if value < 0:
                    account_balances[key] = value * -1
                if value == 0:
                    removeZeroKeys.append(key)

            for key in removeZeroKeys:
                if key in account_balances:        
                    del account_balances[key]

            labels = account_balances.keys()
            sizes = account_balances.values()
            fig, ax = plt.subplots()
            ax.pie(sizes, labels=labels, autopct=lambda pct: autopct_format(pct, sizes, self.model.main_currency), startangle=90)
            #ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
            ax.axis('equal')
            ax.set_title("Crypto Accounts Distribution", color=self.txtColor, alpha=self.txtAlpha)

            fig.text(
                0.5, 0.01,
                f"Balance: {self.model.main_currency} {total_balance:,.2f}",
                ha='center', va='bottom', fontsize=10, color=self.txtColor, alpha=self.txtAlpha
            )

            self.view.display_crypto_graph(fig)
            plt.close(fig)

    def plot_operating_pie_chart(self, *args):
        account_balances = {}
        date = args[0] if args else datetime.today().date()

        if isinstance(date, str):
            date = datetime.strptime(date, "%Y-%m-%d")

        account_data = self.model.load_data()
        if self.model.operatingList:
            for account in self.model.operatingList:
                if account in account_data:
                    if date in account_data[account]:
                        account_balances[account] = account_data[account][date]
                    else:
                        #interpolate
                        dates = list(account_data[account].keys())

                        balances = list(account_data[account].values())
                        
                        for i in range(len(dates) - 1):
                            prev_date, next_date = dates[i].date(), dates[i + 1].date()

                            if isinstance(date, datetime):
                                date = date.date()


                            if prev_date < date < next_date:
                                prev_balance, next_balance = balances[i], balances[i + 1]
                                days_diff = (next_date - prev_date).days
                                balance_diff = next_balance - prev_balance
                                days_to_target = (date - prev_date).days
                                interpolated_balance = prev_balance + (balance_diff / days_diff) * days_to_target
                                account_balances[account] = interpolated_balance
                                break

            total_balance = sum(account_balances.values())
            
            removeZeroKeys = []

            for key, value in account_balances.items():
                if value < 0:
                    account_balances[key] = value * -1
                if value == 0:
                    removeZeroKeys.append(key)

            for key in removeZeroKeys:
                if key in account_balances:        
                    del account_balances[key]


            labels = account_balances.keys()
            sizes = account_balances.values()
            fig, ax = plt.subplots()
            #ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
            ax.pie(sizes, labels=labels, autopct=lambda pct: autopct_format(pct, sizes, self.model.main_currency), startangle=90)
            ax.axis('equal')
            ax.set_title("Operating Accounts Distribution", color=self.txtColor, alpha=self.txtAlpha)

            fig.text(
                0.5, 0.01,
                f"Balance: {self.model.main_currency} {total_balance:,.2f}",
                ha='center', va='bottom', fontsize=10, color=self.txtColor, alpha=self.txtAlpha
            )


            self.view.display_operating_graph(fig)
            plt.close(fig)

    def plot_investment_pie_chart(self, *args):
        account_balances = {}
        date = args[0] if args else datetime.today().date()

        if isinstance(date, str):
            date = datetime.strptime(date, "%Y-%m-%d")
        account_data = self.model.load_data()
        if self.model.investingList:
            for account in self.model.investingList:
                if account in account_data:
                    if date in account_data[account]:
                        account_balances[account] = account_data[account][date]
                    else:
                        #interpolate
                        dates = list(account_data[account].keys())

                        balances = list(account_data[account].values())
                        
                        for i in range(len(dates) - 1):
                            prev_date, next_date = dates[i].date(), dates[i + 1].date()

                            if isinstance(date, datetime):
                                date = date.date()


                            if prev_date < date < next_date:
                                prev_balance, next_balance = balances[i], balances[i + 1]
                                days_diff = (next_date - prev_date).days
                                balance_diff = next_balance - prev_balance
                                days_to_target = (date - prev_date).days
                                interpolated_balance = prev_balance + (balance_diff / days_diff) * days_to_target
                                account_balances[account] = interpolated_balance
                                break

            total_balance = sum(account_balances.values())

            removeZeroKeys = []

            for key, value in account_balances.items():
                if value < 0:
                    account_balances[key] = value * -1
                if value == 0:
                    removeZeroKeys.append(key)

            for key in removeZeroKeys:
                if key in account_balances:        
                    del account_balances[key]

            labels = account_balances.keys()
            sizes = account_balances.values()
            fig, ax = plt.subplots()
            #ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
            ax.pie(sizes, labels=labels, autopct=lambda pct: autopct_format(pct, sizes, self.model.main_currency), startangle=90)
            ax.axis('equal')
            ax.set_title("Investment Accounts Distribution", color=self.txtColor, alpha=self.txtAlpha)

            fig.text(
                0.5, 0.01,
                f"Balance: {self.model.main_currency} {total_balance:,.2f}",
                ha='center', va='bottom', fontsize=10, color=self.txtColor, alpha=self.txtAlpha
            )

            self.view.display_investing_graph(fig)
            plt.close(fig)

    def plot_equity_pie_chart(self, *args):
        account_balances = {}
        date = args[0] if args else datetime.today().date()

        if isinstance(date, str):
            date = datetime.strptime(date, "%Y-%m-%d")

        account_data = self.model.load_data()
        if self.model.equityList:
            for account in self.model.equityList:
                if account in account_data:
                    if date in account_data[account]:
                        account_balances[account] = account_data[account][date]
                    else:
                        #interpolate
                        dates = list(account_data[account].keys())

                        balances = list(account_data[account].values())
                        
                        for i in range(len(dates) - 1):
                            prev_date, next_date = dates[i].date(), dates[i + 1].date()

                            if isinstance(date, datetime):
                                date = date.date()


                            if prev_date < date < next_date:
                                prev_balance, next_balance = balances[i], balances[i + 1]
                                days_diff = (next_date - prev_date).days
                                balance_diff = next_balance - prev_balance
                                days_to_target = (date - prev_date).days
                                interpolated_balance = prev_balance + (balance_diff / days_diff) * days_to_target
                                account_balances[account] = interpolated_balance
                                break




            total_balance = sum(account_balances.values())

            removeZeroKeys = []

            for key, value in account_balances.items():
                if value < 0:
                    account_balances[key] = value * -1
                if value == 0:
                    removeZeroKeys.append(key)

            for key in removeZeroKeys:
                if key in account_balances:        
                    del account_balances[key]

            labels = account_balances.keys()
            sizes = account_balances.values()
            fig, ax = plt.subplots()
            #ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
            ax.pie(sizes, labels=labels, autopct=lambda pct: autopct_format(pct, sizes, self.model.main_currency), startangle=90)
            ax.axis('equal')

            ax.set_title("Equity Accounts Distribution", color=self.txtColor, alpha=self.txtAlpha)

            fig.text(
                0.5, 0.01,
                f"Balance: {self.model.main_currency} {total_balance:,.2f}",
                ha='center', va='bottom', fontsize=10, color=self.txtColor, alpha=self.txtAlpha
            )

            self.view.display_equity_graph(fig)
            plt.close(fig)

    
    def plot_summary_pie_chart(self, *args):
        account_balances = {}
        date = args[0] if args else datetime.today().date()

        if isinstance(date, str):
            date = datetime.strptime(date, "%Y-%m-%d")

        account_data = self.model.load_data()
        if self.model.summaryList:
            for account in self.model.summaryList:
                if account in account_data:
                    if date in account_data[account]:
                        account_balances[account] = account_data[account][date]
                    else:
                        #interpolate
                        dates = list(account_data[account].keys())

                        balances = list(account_data[account].values())
                        
                        for i in range(len(dates) - 1):
                            prev_date, next_date = dates[i].date(), dates[i + 1].date()

                            if isinstance(date, datetime):
                                date = date.date()


                            if prev_date < date < next_date:
                                prev_balance, next_balance = balances[i], balances[i + 1]
                                days_diff = (next_date - prev_date).days
                                balance_diff = next_balance - prev_balance
                                days_to_target = (date - prev_date).days
                                interpolated_balance = prev_balance + (balance_diff / days_diff) * days_to_target
                                account_balances[account] = interpolated_balance
                                break



            # Sum all account balances for the summary pie chart
            total_balance = sum(account_balances.values())
           
            removeZeroKeys = []

            for key, value in account_balances.items():
                if value < 0:
                    account_balances[key] = value * -1
                if value == 0:
                    removeZeroKeys.append(key)

            for key in removeZeroKeys:
                if key in account_balances:        
                    del account_balances[key]


            labels = account_balances.keys()
            sizes = account_balances.values()
            fig, ax = plt.subplots()


            ax.pie(sizes, labels=labels, autopct=lambda pct: autopct_format(pct, sizes, self.model.main_currency), startangle=90)
            ax.axis('equal')

            ax.set_title("Summary Distribution", color=self.txtColor, alpha=self.txtAlpha)

            fig.text(
                0.5, 0.01,
                f"Balance: {self.model.main_currency} {total_balance:,.2f}",
                ha='center', va='bottom', fontsize=10, color=self.txtColor, alpha=self.txtAlpha
            )

            self.view.display_summary_graph(fig)
            plt.close(fig)



    def plot_net_worth(self, *args):
        """Plots net worth with dynamic time filtering and interactive tooltips."""
        account_data = self.model.load_data()
        if not account_data:
            QMessageBox.warning(self, "No Data", "No financial data available to plot.")
            return
        
        selected_accounts = [account for account, var in self.view.account_check_vars.items() if var.isChecked()]
        if not selected_accounts:
            #selected_accounts = list(account_data.keys())
            self.view.display_graph_empty("No accounts selected.")
            return            

        timeframe = self.view.time_filter_var.currentText()
        today = datetime.today()

        if timeframe == "Last Year":
            start_date = today - timedelta(days=365)
        elif timeframe == "Last 6 Months":
            start_date = today - timedelta(days=182)
        elif timeframe == "Last 3 Months":
            start_date = today - timedelta(days=91)
        elif timeframe == "Last Month":
            start_date = today - timedelta(days=30)
        else:
            start_date = None  

        fig, ax = plt.subplots(figsize=(8, 5))
        fig.tight_layout()

        lines = []

        for account in selected_accounts:
            if account in account_data:
                dates = []
                balances = []
                for date, balance in account_data[account].items():
                    dates.append(date)
                    balances.append(balance)

                if start_date:
                    filtered_dates = [d for d in dates if d >= start_date]
                    filtered_balances = [b for d, b in zip(dates, balances) if d >= start_date]
                else:
                    filtered_dates, filtered_balances = dates, balances  

                if filtered_dates:
                    #print(f"Plotting account: {account} with {len(filtered_dates)} data points")
                    #for date in filtered_dates:
                        #print(f"\tDate: {date}, Balance: {account_data[account][date]}")
                    # Convert dates to matplotlib date format
                    #filtered_dates = mdates.date2num(filtered_dates)
                    line, = ax.plot(filtered_dates, filtered_balances, marker='o', linestyle='-', label=account)
                    lines.append(line)  

        if lines:
            cursor = mplcursors.cursor(lines, hover=True)
            cursor.connect("add", lambda sel: sel.annotation.set_text(
                f"{sel.artist.get_label()}\nDate: {mdates.num2date(sel.target[0]).strftime('%Y-%m-%d')}\nBalance: {self.model.main_currency} {sel.target[1]:,.2f}"
            ))
            cursor.connect("add", lambda sel: self.plot_crypto_pie_chart(mdates.num2date(sel.target[0]).strftime('%Y-%m-%d')))
            cursor.connect("add", lambda sel: self.plot_operating_pie_chart(mdates.num2date(sel.target[0]).strftime('%Y-%m-%d')))
            cursor.connect("add", lambda sel: self.plot_investment_pie_chart(mdates.num2date(sel.target[0]).strftime('%Y-%m-%d')))
            cursor.connect("add", lambda sel: self.plot_equity_pie_chart(mdates.num2date(sel.target[0]).strftime('%Y-%m-%d')))
            cursor.connect("add", lambda sel: self.plot_summary_pie_chart(mdates.num2date(sel.target[0]).strftime('%Y-%m-%d')))

        ax.set_xlabel("Date", color=self.txtColor, alpha=self.txtAlpha)
        ax.set_ylabel("Balance ({})".format(self.model.main_currency), color=self.txtColor, alpha=self.txtAlpha)
        ax.set_title(f"Account Balances ({timeframe})", color=self.txtColor, alpha=self.txtAlpha)
        ax.tick_params(axis='x', colors="gray")
        ax.tick_params(axis='y', colors="gray")
        ax.xaxis.set_alpha(self.txtAlpha)
        ax.yaxis.set_alpha(self.txtAlpha)
        ax.legend()
        ax.grid()
        plt.xticks(rotation=0)



        # Calculate amount changed for the selected timeframe
        if selected_accounts and any(filtered_dates for account in selected_accounts if account in account_data):
            # Find the earliest and latest date in the filtered data
            all_dates = []
            for account in selected_accounts:
                if account in account_data:
                    dates = [d for d in account_data[account].keys() if (not start_date or d >= start_date)]
                    all_dates.extend(dates)
            if all_dates:
                min_date = min(all_dates)
                max_date = max(all_dates)
                start_total = 0
                end_total = 0
                for account in selected_accounts:
                    if account in account_data:
                        # Get balance at min_date
                        start_balance = None
                        end_balance = None
                        dates = sorted(account_data[account].keys())
                        # Find closest date <= min_date for start, and <= max_date for end
                        for d in dates:
                            if d <= min_date:
                                start_balance = account_data[account][d]
                            if d <= max_date:
                                end_balance = account_data[account][d]
                        if start_balance is not None:
                            start_total += start_balance
                        if end_balance is not None:
                            end_total += end_balance
                amount_changed = end_total - start_total
                fig.text(
                    0.01, 0.01,
                    f"Amount Changed: {self.model.main_currency} {amount_changed:,.2f}   ({min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')})",
                    ha='left', va='bottom', fontsize=10, color=self.txtColor, alpha=self.txtAlpha
                )





        self.view.display_graph(fig)
        plt.close(fig)

