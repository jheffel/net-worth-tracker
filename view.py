import tkinter as tk
from tkinter import ttk
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from ttkthemes import ThemedTk 


class FinanceView:
    
    def __init__(self, root, controller):
        self.root = root
        #root.configure(bg='black')
        self.controller = controller
        self.root.title("Net Worth Tracker")
        
        # Create layout
        self.panedwindow = ttk.Panedwindow(self.root, orient=tk.VERTICAL)
        self.panedwindow.pack(fill=tk.BOTH, expand=True)

        #top frame
        self.frame = ttk.Frame(self.panedwindow)

        #top paned window
        self.panedTopWindow = ttk.Panedwindow(self.frame, orient=tk.HORIZONTAL)
        self.panedTopWindow.pack(fill=tk.BOTH, expand=True)

        #bottom frame
        self.frameBottom = ttk.Frame(self.panedwindow)
        self.frameBottom.grid_rowconfigure(0, weight=1)
        self.frameBottom.grid_columnconfigure(0, weight=1)
        self.frameBottom.grid_columnconfigure(1, weight=1)
        self.frameBottom.grid_columnconfigure(2, weight=1)
        self.frameBottom.grid_columnconfigure(3, weight=1)
        


        # Left panel for account selection
        self.account_frame = ttk.Frame(self.panedTopWindow)

        self.account_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")

        # Create a canvas and a scrollbar for the account subframe
        self.account_canvas = tk.Canvas(self.account_frame)
        self.account_scrollbar = ttk.Scrollbar(self.account_frame, orient="vertical", command=self.account_canvas.yview)
        self.account_subframe = ttk.Frame(self.account_canvas)

        self.account_subframe.bind(
            "<Configure>",
            lambda e: self.account_canvas.configure(
            scrollregion=self.account_canvas.bbox("all")
            )
        )

        self.account_canvas.create_window((0, 0), window=self.account_subframe, anchor="nw")
        self.account_canvas.configure(yscrollcommand=self.account_scrollbar.set)

        self.account_canvas.grid(row=5, column=0, pady=5, sticky="nsew")
        self.account_scrollbar.grid(row=5, column=1, pady=5, sticky="ns")

        # Ensure the canvas and scrollbar resize properly
        self.account_frame.grid_rowconfigure(5, weight=1)
        self.account_frame.grid_columnconfigure(0, weight=1)

        # Time filter dropdown
        self.time_filter_var = tk.StringVar(value="All Data")
        self.time_filter_options = ["All Data", "All Data", "Last Year", "Last 6 Months", "Last 3 Months", "Last Month"]
        ttk.Label(self.account_frame, text="Select Timeframe:").grid(row=1, column=0, pady=5)
        self.time_filter_menu = ttk.OptionMenu(self.account_frame, self.time_filter_var, *self.time_filter_options, command=self.controller.plot_net_worth)
        self.time_filter_menu.grid(row=2, column=0, pady=5)

        # "Check/Uncheck All" Button
        self.toggle_button = tk.Button(self.account_frame, text="Check/Uncheck All", command=self.controller.toggle_all_accounts)
        self.toggle_button.grid(row=3, column=0, pady=5)

        # Import ODS Button
        self.import_button = ttk.Button(self.account_frame, text="Import ODS", command=self.controller.import_from_ods)
        self.import_button.grid(row=0, column=0, pady=5)


        # Account checkboxes
        self.account_check_vars = {}






        # Right panel for graph
        self.graph_frame = ttk.Frame(self.panedTopWindow)
        #self.graph_frame.grid(row=0, column=1, padx=10, pady=10, sticky="nsew")







        #Bottom panel for pie charts
        self.overview_frame = ttk.Frame(self.frameBottom)
        self.overview_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        self.overview_frame.grid_rowconfigure(0, weight=1)
        self.overview_frame.grid_columnconfigure(0, weight=1)
        self.overview_frame.grid_columnconfigure(1, weight=1)
        self.overview_frame.grid_columnconfigure(2, weight=1)
        self.overview_frame.grid_columnconfigure(3, weight=1)
        



        #operating pie chart Panel
        self.operating_frame = ttk.Frame(self.overview_frame)
        self.operating_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")

        #investing pie chart Panel
        self.investing_frame = ttk.Frame(self.overview_frame)
        self.investing_frame.grid(row=0, column=1, padx=10, pady=10, sticky="nsew")

        #crypto pie chart Panel
        self.crypto_frame = ttk.Frame(self.overview_frame)
        self.crypto_frame.grid(row=0, column=2, padx=10, pady=10, sticky="nsew")

        #equity pie chart Panel
        self.equity_frame = ttk.Frame(self.overview_frame)
        self.equity_frame.grid(row=0, column=3, padx=10, pady=10, sticky="nsew")



        # Add the frames to the paned windows
        self.panedTopWindow.add(self.account_frame)
        self.panedTopWindow.add(self.graph_frame)
        
        self.panedwindow.add(self.frame)
        self.panedwindow.add(self.frameBottom)



    def update_account_checkboxes(self, accounts):
        """Updates the account checkboxes dynamically."""
        for widget in self.account_subframe.winfo_children():
            widget.destroy()

        for idx, account in enumerate(accounts):
            var = tk.BooleanVar(value=True)
            self.account_check_vars[account] = var
            ttk.Checkbutton(self.account_subframe, text=account, variable=var, command=self.controller.plot_net_worth).grid(row=5 + idx, column=0, sticky="w")

    def display_graph(self, fig):
        """Displays the Matplotlib graph inside the Tkinter GUI."""
        fig.patch.set_facecolor('darkgrey')  # Set the background color of the figure
        for widget in self.graph_frame.winfo_children():
            widget.destroy()
        canvas = FigureCanvasTkAgg(fig, master=self.graph_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

    def display_investing_graph(self, fig):
        """Displays the Matplotlib graph inside the Tkinter GUI with a transparent background."""
        fig.patch.set_facecolor('darkgrey')  # Set the background color of the figure
        for widget in self.investing_frame.winfo_children():
            widget.destroy()
        canvas = FigureCanvasTkAgg(fig, master=self.investing_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

    def display_crypto_graph(self, fig):
        """Displays the Matplotlib graph inside the Tkinter GUI."""
        fig.patch.set_facecolor('darkgrey')  # Set the background color of the figure
        for widget in self.crypto_frame.winfo_children():
            widget.destroy()
        canvas = FigureCanvasTkAgg(fig, master=self.crypto_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

    def display_operating_graph(self, fig):
        """Displays the Matplotlib graph inside the Tkinter GUI."""
        fig.patch.set_facecolor('darkgrey')  # Set the background color of the figure
        for widget in self.operating_frame.winfo_children():
            widget.destroy()
        canvas = FigureCanvasTkAgg(fig, master=self.operating_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

    def display_equity_graph(self, fig):
        """Displays the Matplotlib graph inside the Tkinter GUI."""
        fig.patch.set_facecolor('darkgrey')  # Set the background color of the figure
        for widget in self.equity_frame.winfo_children():
            widget.destroy()
        canvas = FigureCanvasTkAgg(fig, master=self.equity_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)