import tkinter as tk
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg



class FinanceView:
    def __init__(self, root, controller):
        self.root = root
        self.controller = controller
        self.root.title("Finance Tracker")
        
        # Create layout
        self.frame = tk.Frame(self.root)
        self.frame.pack(fill=tk.BOTH, expand=True)

        # top left panel for import and time filter
        self.top_left_frame = tk.Frame(self.frame)
        self.top_left_frame.grid(row=1, column=0, padx=10, pady=10, sticky="nsew")

        # Left panel for account selection
        self.account_frame = tk.Frame(self.frame)
        self.account_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")

        # Create a canvas and a scrollbar for the account subframe
        self.account_canvas = tk.Canvas(self.account_frame)
        self.account_scrollbar = tk.Scrollbar(self.account_frame, orient="vertical", command=self.account_canvas.yview)
        self.account_subframe = tk.Frame(self.account_canvas)

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

        # Right panel for graph
        self.graph_frame = tk.Frame(self.frame)
        self.graph_frame.grid(row=0, column=1, padx=10, pady=10, sticky="nsew")

        # Bottom Left Panel
        self.bottom_left_frame = tk.Frame(self.frame)
        self.bottom_left_frame.grid(row=2, column=0, padx=10, pady=10, sticky="nsew")

        #Bottom Right Panel
        self.overview_frame = tk.Frame(self.frame)
        self.overview_frame.grid(row=2, column=1, padx=10, pady=10, sticky="nsew")
        self.overview_frame.grid_rowconfigure(0, weight=1)
        self.overview_frame.grid_columnconfigure(0, weight=1)
        self.overview_frame.grid_columnconfigure(1, weight=1)
        self.overview_frame.grid_columnconfigure(2, weight=1)

        # Set the row height to take up 20% of the window
        self.frame.grid_rowconfigure(2, weight=1, minsize=int(self.root.winfo_screenheight() * 0.1))

        #operating pie chart Panel
        self.operating_frame = tk.Frame(self.overview_frame)
        self.operating_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")

        #investing pie chart Panel
        self.investing_frame = tk.Frame(self.overview_frame)
        self.investing_frame.grid(row=0, column=1, padx=10, pady=10, sticky="nsew")

        #crypto pie chart Panel
        self.crypto_frame = tk.Frame(self.overview_frame)
        self.crypto_frame.grid(row=0, column=2, padx=10, pady=10, sticky="nsew")

        # Import ODS Button
        self.import_button = tk.Button(self.account_frame, text="Import ODS", command=self.controller.import_from_ods)
        self.import_button.grid(row=0, column=0, pady=5)


        # Time filter dropdown
        self.time_filter_var = tk.StringVar(value="All Data")
        self.time_filter_options = ["All Data", "Last Year", "Last 6 Months", "Last 3 Months", "Last Month"]
        tk.Label(self.account_frame, text="Select Timeframe:").grid(row=1, column=0, pady=5)
        self.time_filter_menu = tk.OptionMenu(self.account_frame, self.time_filter_var, *self.time_filter_options, command=self.controller.plot_net_worth)
        self.time_filter_menu.grid(row=2, column=0, pady=5)

        # "Check/Uncheck All" Button
        self.toggle_button = tk.Button(self.account_frame, text="Check/Uncheck All", command=self.controller.toggle_all_accounts)
        self.toggle_button.grid(row=3, column=0, pady=5)

        # Add a label
        self.label = tk.Label(self.bottom_left_frame, text="Account Overview")
        self.label.grid(row=0, column=0, pady=5)

        # Account checkboxes
        self.account_check_vars = {}

        # Resizing behavior
        self.frame.grid_rowconfigure(0, weight=1)
        self.frame.grid_columnconfigure(1, weight=1)

    def update_account_checkboxes(self, accounts):
        """Updates the account checkboxes dynamically."""
        for widget in self.account_subframe.winfo_children():
            widget.destroy()

        for idx, account in enumerate(accounts):
            var = tk.BooleanVar(value=True)
            self.account_check_vars[account] = var
            tk.Checkbutton(self.account_subframe, text=account, variable=var, command=self.controller.plot_net_worth).grid(row=5 + idx, column=0, sticky="w")

    def display_graph(self, fig):
        """Displays the Matplotlib graph inside the Tkinter GUI."""
        for widget in self.graph_frame.winfo_children():
            widget.destroy()
        canvas = FigureCanvasTkAgg(fig, master=self.graph_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        # Resizable canvas
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)  # Ensure canvas is resizable
        self.graph_frame.grid_rowconfigure(0, weight=1)
        self.graph_frame.grid_columnconfigure(0, weight=1)

    def display_investing_graph(self, fig):
        """Displays the Matplotlib graph inside the Tkinter GUI with a transparent background."""
        for widget in self.investing_frame.winfo_children():
            widget.destroy()
        canvas = FigureCanvasTkAgg(fig, master=self.investing_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        # Set the background color of the canvas to be transparent
        # canvas.get_tk_widget().configure(bg='systemTransparent')

        # Resizable canvas
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)  # Ensure canvas is resizable
        self.investing_frame.grid_rowconfigure(0, weight=1)
        self.investing_frame.grid_columnconfigure(0, weight=1)


    def display_crypto_graph(self, fig):
        """Displays the Matplotlib graph inside the Tkinter GUI."""
        for widget in self.crypto_frame.winfo_children():
            widget.destroy()
        canvas = FigureCanvasTkAgg(fig, master=self.crypto_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        # Resizable canvas
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)  # Ensure canvas is resizable
        self.crypto_frame.grid_rowconfigure(0, weight=1)
        self.crypto_frame.grid_columnconfigure(0, weight=1)

    def display_operating_graph(self, fig):
        """Displays the Matplotlib graph inside the Tkinter GUI."""
        for widget in self.operating_frame.winfo_children():
            widget.destroy()
        canvas = FigureCanvasTkAgg(fig, master=self.operating_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        # Resizable canvas
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)  # Ensure canvas is resizable
        self.operating_frame.grid_rowconfigure(0, weight=1)
        self.operating_frame.grid_columnconfigure(0, weight=1)