import pandas as pd
from tkinter import filedialog, messagebox
from datetime import datetime, timedelta
import mplcursors  # Import for interactive tooltips
from model import FinanceModel
from view import FinanceView

import matplotlib.pyplot as plt
import matplotlib.dates as mdates

class FinanceController:
    def __init__(self, root):
        self.model = FinanceModel()
        self.view = FinanceView(root, self)
        #self.model.calculate_net_worth()
        self.update_checkboxes()
        self.plot_net_worth()

    def update_checkboxes(self):
        account_data = self.model.load_data()

        self.view.update_account_checkboxes(account_data.keys())

    def import_from_ods(self):
        """Imports financial data from a multi-sheet ODS file into the database."""
        ods_file = filedialog.askopenfilename(filetypes=[("ODS files", "*.ods")])
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

            messagebox.showinfo("Success", "Data successfully imported from ODS!")

        except Exception as e:
            messagebox.showerror("Error", f"Error importing ODS: {e}")

        # 🔹 Update checkboxes after importing data
        self.update_checkboxes()
        self.plot_net_worth()




    def toggle_all_accounts(self):
        """Toggles all account checkboxes between checked and unchecked."""
        new_state = not all(var.get() for var in self.view.account_check_vars.values())  
        for var in self.view.account_check_vars.values():
            var.set(new_state)

        # Refresh the graph after toggling checkboxes
        self.plot_net_worth()

    def plot_net_worth(self, *args):
        """Plots net worth with dynamic time filtering and interactive tooltips."""
        account_data = self.model.load_data()
        if not account_data:
            messagebox.showwarning("No Data", "No financial data available to plot.")
            return
        
        selected_accounts = [account for account, var in self.view.account_check_vars.items() if var.get()]
        if not selected_accounts:
            selected_accounts = list(account_data.keys())

        timeframe = self.view.time_filter_var.get()
        today = datetime.today()

        # Define time filtering
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


        # Create a figure and axes
        fig, ax = plt.subplots(figsize=(8, 5))
        fig.tight_layout()

        lines = []  # Store line objects for tooltips

        for account in selected_accounts:
            if account in account_data:
                dates = []
                balances = []
                #dates, balances = account_data[account]
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

        # Ensure tooltips work on individual points
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


        # Close the figure to prevent memory issues
        plt.close(fig)

        self.view.display_graph(fig)

