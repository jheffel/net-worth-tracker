from controller import FinanceController

import tkinter
from tkinter import ttk  # Normal Tkinter.* widgets are not themed!
from ttkthemes import ThemedTk

# Run the application
if __name__ == "__main__":

    window = ThemedTk(theme="breeze")
    app = FinanceController(window)
    window.mainloop()