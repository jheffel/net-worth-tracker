import pandas as pd
import sys
import re
from datetime import datetime

def clean_balance(balance):
    # Remove $ and commas, keep only numbers, dot, and minus
    if isinstance(balance, str):
        balance = balance.replace("$", "").replace(",", "")
        balance = re.sub(r'[^0-9.-]', '', balance)
    try:
        return float(balance)
    except Exception:
        return None

def test_import_from_ods(ods_file):
    sheets = pd.read_excel(ods_file, sheet_name=None, engine="odf")
    added = []
    skipped = []

    for sheet_name, df in sheets.items():
        if df.empty:
            continue

        # Use first column for account name
        account_name = df.iloc[0, 0] if not df.empty else sheet_name
        df = df.iloc[:, :5]

        if df.shape[1] == 5:
            df.columns = ["account", "date", "balance", "currency", "ticker"]
        elif df.shape[1] == 4:
            df.columns = ["account", "date", "balance", "currency"]
            df["ticker"] = ""
        else:
            print(f"Sheet '{sheet_name}' has unexpected number of columns ({df.shape[1]}). Skipping.")
            continue

        for idx, row in df.iterrows():
            try:
                if pd.isna(row['date']) or pd.isna(row['balance']):
                    skipped.append((idx+2, row.to_dict(), "Missing date or balance"))
                    continue

                # Try to parse date
                try:
                    date = str(row["date"].date()).strip()
                    datetime.strptime(date, "%Y-%m-%d")
                except Exception:
                    skipped.append((idx+2, row.to_dict(), "Invalid date format"))
                    continue

                currency = str(row["currency"]).strip()
                ticker = str(row["ticker"]).strip()
                if ticker in ["NaN", "nan"]:
                    ticker = ""

                balance = clean_balance(row["balance"])
                if balance is None:
                    skipped.append((idx+2, row.to_dict(), "Invalid balance"))
                    continue

                # If it passes all checks, it would be added
                added.append((idx+2, row.to_dict()))
            except Exception as e:
                skipped.append((idx+2, row.to_dict(), f"Exception: {e}"))

    print("Rows that would be added to the database:")
    for row in added:
        print(f"Row {row[0]}: {row[1]}")
    print("\nRows that would be skipped:")
    for row in skipped:
        print(f"Row {row[0]}: {row[1]} | Reason: {row[2]}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_import_from_ods.py <your_file.ods>")
    else:
        test_import_from_ods(sys.argv[1])