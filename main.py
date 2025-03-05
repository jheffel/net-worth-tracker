import tkinter as tk
#from view import FinanceView
from controller import FinanceController



# Run the application
if __name__ == "__main__":
    root = tk.Tk()
    app = FinanceController(root)
    root.mainloop()