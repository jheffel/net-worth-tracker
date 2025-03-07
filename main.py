from controller import FinanceController

import tkinter

# Run the application
if __name__ == "__main__":

    window = tkinter.Tk()
    app = FinanceController(window)
    window.mainloop()