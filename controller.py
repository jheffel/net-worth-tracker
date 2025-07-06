import pandas as pd
from PyQt6.QtWidgets import QFileDialog, QMessageBox, QMainWindow, QComboBox, QLabel, QHBoxLayout
from datetime import datetime, timedelta
import mplcursors  # Import for interactive tooltips
from model import FinanceModel
from view import FinanceView

import matplotlib.pyplot as plt
import matplotlib.dates as mdates


def autopct_format(pct, allvals):
    absolute = int(round(pct/100.*sum(allvals)))
    return f"{pct:.1f}%\n(${absolute:,})"


class FinanceController(QMainWindow):
    def __init__(self):
        super().__init__()
        self.model = FinanceModel()
        self.view = FinanceView(self)
        self.txtColor = self.view.txtColor
        self.txtAlpha = self.view.txtAlpha
        self.setCentralWidget(self.view)
        self.setWindowTitle("Net Worth Tracker")

        # --- Currency support ---
        self.available_currencies = ["USD", "EUR", "GBP", "JPY", "CAD"]
        self.main_currency = "USD"
        self.exchange_rates = {"USD": 1.0, "EUR": 1.1, "GBP": 1.3, "JPY": 0.007, "CAD": 0.75}  # Example rates
        self._setup_currency_selector()
        # --- End currency support ---

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

    def _setup_currency_selector(self):
        # Add a currency selector to the UI
        self.currency_selector = QComboBox()
        self.currency_selector.addItems(self.available_currencies)
        self.currency_selector.setCurrentText(self.main_currency)
        self.currency_selector.currentTextChanged.connect(self.set_main_currency)
        currency_label = QLabel("Main Currency:")
        layout = QHBoxLayout()
        layout.addWidget(currency_label)
        layout.addWidget(self.currency_selector)
        self.view.layout().insertLayout(0, layout)

    def set_main_currency(self, currency):
        self.main_currency = currency
        self.plot_net_worth()
        self.plot_crypto_pie_chart()
        self.plot_operating_pie_chart()
        self.plot_investment_pie_chart()
        self.plot_equity_pie_chart()
        self.plot_summary_pie_chart()

    def get_account_currency(self, account):
        # Try to get the currency for an account from the model, fallback to main_currency
        if hasattr(self.model, 'get_account_currency'):
            return self.model.get_account_currency(account)
        if hasattr(self.model, 'account_currency_map'):
            return self.model.account_currency_map.get(account, self.main_currency)
        return self.main_currency

    def convert_to_main(self, amount, currency):
        if currency == self.main_currency:
            return amount
        if currency in self.exchange_rates and self.main_currency in self.exchange_rates:
            usd_amount = amount / self.exchange_rates[currency]  # Convert to USD
            return usd_amount * self.exchange_rates[self.main_currency]  # Convert to main
        return amount  # Fallback: no conversion

    # --- Update plotting methods to use currency conversion ---
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
                        bal = account_data[account][date]
                        currency = self.get_account_currency(account)
                        account_balances[account] = self.convert_to_main(bal, currency)
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
                                currency = self.get_account_currency(account)
                                account_balances[account] = self.convert_to_main(interpolated_balance, currency)
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
            ax.pie(sizes, labels=labels, autopct=lambda pct: autopct_format(pct, sizes), startangle=90)
            #ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
            ax.axis('equal')
            ax.set_title(f"Crypto Accounts Distribution ({self.main_currency})", color=self.txtColor, alpha=self.txtAlpha)

            fig.text(
                0.5, 0.01,
                f"Balance: {self.main_currency} {total_balance:,.2f}",
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
                        bal = account_data[account][date]
                        currency = self.get_account_currency(account)
                        account_balances[account] = self.convert_to_main(bal, currency)
                    else:
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
                                currency = self.get_account_currency(account)
                                account_balances[account] = self.convert_to_main(interpolated_balance, currency)
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
            ax.pie(sizes, labels=labels, autopct=lambda pct: autopct_format(pct, sizes), startangle=90)
            ax.axis('equal')
            ax.set_title(f"Operating Accounts Distribution ({self.main_currency})", color=self.txtColor, alpha=self.txtAlpha)
            fig.text(
                0.5, 0.01,
                f"Balance: {self.main_currency} {total_balance:,.2f}",
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
                        bal = account_data[account][date]
                        currency = self.get_account_currency(account)
                        account_balances[account] = self.convert_to_main(bal, currency)
                    else:
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
                                currency = self.get_account_currency(account)
                                account_balances[account] = self.convert_to_main(interpolated_balance, currency)
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
            ax.pie(sizes, labels=labels, autopct=lambda pct: autopct_format(pct, sizes), startangle=90)
            ax.axis('equal')
            ax.set_title(f"Investment Accounts Distribution ({self.main_currency})", color=self.txtColor, alpha=self.txtAlpha)
            fig.text(
                0.5, 0.01,
                f"Balance: {self.main_currency} {total_balance:,.2f}",
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
                        bal = account_data[account][date]
                        currency = self.get_account_currency(account)
                        account_balances[account] = self.convert_to_main(bal, currency)
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
            ax.pie(sizes, labels=labels, autopct=lambda pct: autopct_format(pct, sizes), startangle=90)
            ax.axis('equal')

            ax.set_title(f"Equity Accounts Distribution ({self.main_currency})", color=self.txtColor, alpha=self.txtAlpha)

            fig.text(
                0.5, 0.01,
                f"Balance: {self.main_currency} {total_balance:,.2f}",
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
                        bal = account_data[account][date]
                        currency = self.get_account_currency(account)
                        account_balances[account] = self.convert_to_main(bal, currency)
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


            ax.pie(sizes, labels=labels, autopct=lambda pct: autopct_format(pct, sizes), startangle=90)
            ax.axis('equal')

            ax.set_title(f"Summary Distribution ({self.main_currency})", color=self.txtColor, alpha=self.txtAlpha)

            fig.text(
                0.5, 0.01,
                f"Balance: {self.main_currency} {total_balance:,.2f}",
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
            selected_accounts = list(account_data.keys())

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
                    line, = ax.plot(filtered_dates, filtered_balances, marker='o', linestyle='-', label=account)
                    lines.append(line)  

        if lines:
            cursor = mplcursors.cursor(lines, hover=True)
            cursor.connect("add", lambda sel: sel.annotation.set_text(
                f"{sel.artist.get_label()}\nDate: {mdates.num2date(sel.target[0]).strftime('%Y-%m-%d')}\nBalance: ${sel.target[1]:,.2f}"
            ))
            cursor.connect("add", lambda sel: self.plot_crypto_pie_chart(mdates.num2date(sel.target[0]).strftime('%Y-%m-%d')))
            cursor.connect("add", lambda sel: self.plot_operating_pie_chart(mdates.num2date(sel.target[0]).strftime('%Y-%m-%d')))
            cursor.connect("add", lambda sel: self.plot_investment_pie_chart(mdates.num2date(sel.target[0]).strftime('%Y-%m-%d')))
            cursor.connect("add", lambda sel: self.plot_equity_pie_chart(mdates.num2date(sel.target[0]).strftime('%Y-%m-%d')))
            cursor.connect("add", lambda sel: self.plot_summary_pie_chart(mdates.num2date(sel.target[0]).strftime('%Y-%m-%d')))

        ax.set_xlabel("Date", color=self.txtColor, alpha=self.txtAlpha)
        ax.set_ylabel("Balance ($)", color=self.txtColor, alpha=self.txtAlpha)
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
                    f"Amount Changed: ${amount_changed:,.2f}   ({min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')})",
                    ha='left', va='bottom', fontsize=10, color=self.txtColor, alpha=self.txtAlpha
                )





        self.view.display_graph(fig)
        plt.close(fig)

