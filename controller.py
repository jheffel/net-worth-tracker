import pandas as pd
from PyQt6.QtWidgets import QFileDialog, QMessageBox, QMainWindow
from datetime import datetime, timedelta
import mplcursors  # Import for interactive tooltips
from model import FinanceModel
from view import FinanceView

import matplotlib.pyplot as plt
import matplotlib.dates as mdates

class FinanceController(QMainWindow):
    def __init__(self):
        super().__init__()  # Call the superclass's __init__ method
        self.model = FinanceModel()
        self.view = FinanceView(self)
        self.setCentralWidget(self.view)
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

                # Ensure only first three columns are used
                df = df.iloc[:, :3]
                df.columns = ["account", "date", "balance"]  # Rename columns

                for _, row in df.iterrows():
                    try:
                        # Skip row if 'date' or 'balance' is missing or invalid
                        if pd.isna(row['date']) or pd.isna(row['balance']):
                            continue

                        date = str(row["date"].date()).strip()
                        datetime.strptime(date, "%Y-%m-%d")  # Validate date format

                        balance = str(row["balance"]).strip().replace("$", "").replace(",", "")
                        if balance:
                            self.model.add_balance(account_name, date, float(balance))

                    except ValueError:
                        print(f"Invalid date or balance in row: {row}")

            QMessageBox.information(self, "Success", "Data successfully imported from ODS!")

        except Exception as e:
            QMessageBox.critical(self, "Error", f"Error importing ODS: {e}")

        # Update checkboxes after importing data
        self.update_checkboxes()
        self.plot_net_worth()

    def toggle_all_accounts(self):
        """Toggles all account checkboxes between checked and unchecked."""
        new_state = not all(var.isChecked() for var in self.view.account_check_vars.values())  
        for var in self.view.account_check_vars.values():
            var.setChecked(new_state)

        # Refresh the graph after toggling checkboxes
        self.plot_net_worth()

    def plot_crypto_pie_chart(self, *args):
        account_balances = {}
        account_data = self.model.load_data()
        for account in self.model.cryptoList:
            if account in account_data:
                account_balances[account] = list(account_data[account].values())[-1]

        for key, value in account_balances.items():
            if value < 0:
                account_balances[key] = value * -1

        labels = account_balances.keys()
        sizes = account_balances.values()
        fig, ax = plt.subplots()
        ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
        ax.axis('equal')
        ax.set_title("Crypto Accounts Distribution")
        self.view.display_crypto_graph(fig)
        plt.close(fig)

    def plot_operating_pie_chart(self, *args):
        account_balances = {}
        account_data = self.model.load_data()
        for account in self.model.operatingList:
            if account in account_data:
                account_balances[account] = list(account_data[account].values())[-1]

        for key, value in account_balances.items():
            if value < 0:
                account_balances[key] = value * -1

        labels = account_balances.keys()
        sizes = account_balances.values()
        fig, ax = plt.subplots()
        ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
        ax.axis('equal')
        ax.set_title("Operating Accounts Distribution")
        self.view.display_operating_graph(fig)
        plt.close(fig)

    def plot_investment_pie_chart(self, *args):
        account_balances = {}
        account_data = self.model.load_data()
        for account in self.model.investingList:
            if account in account_data:
                account_balances[account] = list(account_data[account].values())[-1]

        for key, value in account_balances.items():
            if value < 0:
                account_balances[key] = value * -1

        labels = account_balances.keys()
        sizes = account_balances.values()
        fig, ax = plt.subplots()
        ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
        ax.axis('equal')
        ax.set_title("Investment Accounts Distribution")
        self.view.display_investing_graph(fig)
        plt.close(fig)

    def plot_equity_pie_chart(self, *args):
        account_balances = {}
        account_data = self.model.load_data()
        for account in self.model.equityList:
            if account in account_data:
                account_balances[account] = list(account_data[account].values())[-1]

        for key, value in account_balances.items():
            if value < 0:
                account_balances[key] = value * -1

        labels = account_balances.keys()
        sizes = account_balances.values()
        fig, ax = plt.subplots()
        ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
        ax.axis('equal')
        ax.set_title("Equity Accounts Distribution")
        self.view.display_equity_graph(fig)
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

        ax.set_xlabel("Date")
        ax.set_ylabel("Balance ($)")
        ax.set_title(f"Account Balances ({timeframe})")
        ax.legend()
        ax.grid()
        plt.xticks(rotation=45)

        self.view.display_graph(fig)
        plt.close(fig)