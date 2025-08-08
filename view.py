from PyQt6.QtWidgets import (QSplitter, QTextEdit, QDateEdit, QWidget, QVBoxLayout, QHBoxLayout, QFrame, QScrollArea, QCheckBox, QLabel, QPushButton, QComboBox)
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from PyQt6.QtCore import Qt

from datetime import datetime, timedelta


class FinanceView(QWidget):
    def __init__(self, controller, parent=None):
        super().__init__(parent)

        self.txtColor = "white"
        self.txtAlpha = 0.75

        self.controller = controller

        # Create top-left and bottom frames with styled panel appearance
        self.topleft = QFrame()
        self.topleft.setFrameShape(QFrame.Shape.StyledPanel)
        self.bottom = QFrame()
        self.bottom.setFrameShape(QFrame.Shape.StyledPanel)
        self.bottomLayout = QHBoxLayout(self.bottom)


        # Create horizontal splitter to divide top area
        self.splitter1 = QSplitter(Qt.Orientation.Horizontal)
        self.splitter1.addWidget(self.topleft)


        # Create vertical splitter to divide left and bottom areas
        self.splitter2 = QSplitter(Qt.Orientation.Vertical)
        self.splitter2.addWidget(self.splitter1)
        self.splitter2.addWidget(self.bottom)
        self.splitter2.setStretchFactor(0, 8)  # 90% for top area
        self.splitter2.setStretchFactor(1, 2)  # 10% for bottom area

        # Create a central widget and layout to hold the splitters
        self.central_widget = QWidget()
        self.hbox = QHBoxLayout(self.central_widget)
        self.hbox.addWidget(self.splitter2)
        self.setLayout(self.hbox)


        # Left panel for account selection
        self.account_frame = QFrame(self.topleft)
        self.account_layout = QVBoxLayout(self.account_frame)
        # Don't set layout on topleft since it's already managed by splitter

        #timeframe frame
        self.timeframe_frame = QFrame(self.topleft)
        self.timeframe_frame.setFrameShape(QFrame.Shape.StyledPanel)
        self.timeframe_layout = QVBoxLayout(self.timeframe_frame)
        self.account_layout.addWidget(self.timeframe_frame)

        # Time filter dropdown
        self.time_filter_label = QLabel("Select Timeframe:", self.account_frame)
        self.timeframe_layout.addWidget(self.time_filter_label)
        self.time_filter_var = QComboBox(self.account_frame)
        self.time_filter_var.addItems(["All Data", "Last Year", "Last 6 Months", "Last 3 Months", "Last Month", "Custom"])
        self.time_filter_var.currentIndexChanged.connect(self.controller.plot_net_worth)
        self.timeframe_layout.addWidget(self.time_filter_var)

        # Custom date input
        self.custom_label = QLabel("Select Custom Date Range:", self.account_frame)
        self.timeframe_layout.addWidget(self.custom_label)

        self.custom_label.setVisible(False)

        #self.start_date_var = QDateEdit("Start Date", self.account_frame)
        self.start_date_var = QDateEdit()
        self.start_date_var.setDisplayFormat("yyyy-MM-dd")
        self.start_date_var.setCalendarPopup(True)
        self.start_date_var.setDate(datetime.today() - timedelta(days=365))
        
        self.start_date_var.setVisible(False)

        self.start_date_var.dateChanged.connect(self.controller.plot_net_worth)
        #self.start_date_var.clicked.connect(lambda: self.date_picker(0))

        self.end_date_var = QDateEdit()
        self.end_date_var.setDisplayFormat("yyyy-MM-dd")
        self.end_date_var.setDate(datetime.today())
        self.end_date_var.setCalendarPopup(True)
        #self.end_date_var.clicked.connect(lambda: self.date_picker(1))

        self.end_date_var.setVisible(False)

        self.end_date_var.dateChanged.connect(self.controller.plot_net_worth)

        # Create a horizontal layout to hold the start and end date buttons
        hbox = QHBoxLayout()
        hbox.addWidget(self.start_date_var)
        hbox.addWidget(self.end_date_var)

        self.timeframe_layout.addLayout(hbox)

        # Hide custom date input by default
        for i in range(5):
            self.time_filter_var.currentTextChanged.connect(lambda state=i: self.show_custom_input(state))






        # Add a currency selector to the UI
        self.currency_frame = QFrame(self.topleft)
        self.currency_frame.setFrameShape(QFrame.Shape.StyledPanel)

        self.currency_selector = QComboBox()
        self.currency_selector.addItems(self.controller.model.available_currencies)
        self.currency_selector.setCurrentText(self.controller.model.main_currency)
        self.currency_selector.currentTextChanged.connect(self.controller.set_main_currency)
        currency_label = QLabel("Main Currency:")
        currency_layout = QHBoxLayout(self.currency_frame)
        currency_layout.addWidget(currency_label)
        currency_layout.addWidget(self.currency_selector)
        #self.view.layout().insertLayout(0, layout)
        #self.account_layout.addLayout(currency_layout) 
        self.account_layout.addWidget(self.currency_frame)

       # "Check/Uncheck All" Button
        self.tool_frame = QFrame(self.topleft)
        self.tool_frame.setFrameShape(QFrame.Shape.StyledPanel)

        self.tool_layout = QHBoxLayout(self.tool_frame)

        self.toggle_button = QPushButton("Check/Uncheck All", self.account_frame)
        self.toggle_button.clicked.connect(self.controller.toggle_all_accounts)
        
        self.tool_layout.addWidget(self.toggle_button)

        self.account_layout.addWidget(self.tool_frame)

        # Create a scroll area for the account subframe
        self.scroll_area = QScrollArea(self.account_frame)
        self.scroll_area.setWidgetResizable(True)
        self.account_subframe = QWidget()
        self.account_subframe_layout = QVBoxLayout(self.account_subframe)
        self.scroll_area.setWidget(self.account_subframe)
        self.account_layout.addWidget(self.scroll_area)

        # Account checkboxes
        self.account_check_vars = {}

        # Import ODS Button
        self.import_frame = QFrame()
        self.import_frame.setFrameShape(QFrame.Shape.StyledPanel)

        self.import_layout = QHBoxLayout(self.import_frame)

        self.import_button = QPushButton("Import ODS", self.account_frame)
        self.import_button.clicked.connect(self.controller.import_from_ods)
        
        self.import_layout.addWidget(self.import_button)

        self.account_layout.addWidget(self.import_frame)


        # Right panel for graph
        self.graph_frame = QFrame(self.splitter1)
        self.graph_layout = QVBoxLayout(self.graph_frame)
        # Don't set layout on topleft since it's already managed by splitter
        
        self.splitter1.addWidget(self.graph_frame)
        self.splitter1.setStretchFactor(0, 1)  # 10% for left panel
        self.splitter1.setStretchFactor(1, 9)  # 90% for graph


        # Bottom panel for pie charts
        self.summary_frame = QFrame(self.bottom)
        self.summary_layout = QVBoxLayout(self.summary_frame)
        self.bottomLayout.addWidget(self.summary_frame)

        self.operating_frame = QFrame(self.bottom)
        self.operating_layout = QVBoxLayout(self.operating_frame)
        self.bottomLayout.addWidget(self.operating_frame)

        self.investing_frame = QFrame(self.bottom)
        self.investing_layout = QVBoxLayout(self.investing_frame)
        self.bottomLayout.addWidget(self.investing_frame)

        self.crypto_frame = QFrame(self.bottom)
        self.crypto_layout = QVBoxLayout(self.crypto_frame)
        self.bottomLayout.addWidget(self.crypto_frame)

        self.equity_frame = QFrame(self.bottom)
        self.equity_layout = QVBoxLayout(self.equity_frame)
        self.bottomLayout.addWidget(self.equity_frame)

    def show_custom_input(self, state):
    
        if state == "Custom":
            self.start_date_var.setEnabled(True)
            self.start_date_var.setVisible(True)
            
            self.end_date_var.setEnabled(True)
            self.end_date_var.setVisible(True)

            self.custom_label.setEnabled(True)
            self.custom_label.setVisible(True)

        else:
            self.start_date_var.setDisabled(True)
            self.start_date_var.setVisible(False)

            self.end_date_var.setDisabled(True)
            self.end_date_var.setVisible(False)
            
            self.custom_label.setDisabled(True)
            self.custom_label.setVisible(False)

    def update_account_checkboxes(self, accounts):
        """Updates the account checkboxes dynamically."""
        for i in reversed(range(self.account_subframe_layout.count())):
            widget = self.account_subframe_layout.itemAt(i).widget()
            if widget is not None:
                widget.deleteLater()

        for account in accounts:
            var = QCheckBox(account, self.account_subframe)
            var.setChecked(False)
            var.stateChanged.connect(self.controller.plot_net_worth)
            self.account_check_vars[account] = var
            self.account_subframe_layout.addWidget(var)

    def display_graph(self, fig):
        """Displays the Matplotlib graph inside the PyQt GUI."""
        # Clear existing widgets more efficiently
        self._clear_layout(self.graph_layout)

        # Set the figure and axes background to transparent
        fig.patch.set_facecolor('black')
        fig.patch.set_alpha(0.75)
        fig.patch.set_edgecolor('none')

        for text in fig.texts:
            text.set_color('white')
            text.set_alpha(1.0)

        for ax in fig.get_axes():
            ax.patch.set_facecolor('black')
            ax.patch.set_alpha(0.1)
            ax.patch.set_edgecolor('none')
            ax.grid(color='black', linestyle='-', linewidth=0.5, alpha=0.25)
        
        canvas = FigureCanvas(fig)
        self.graph_layout.addWidget(canvas)

    def _clear_layout(self, layout):
        """Efficiently clear all widgets from a layout."""
        while layout.count():
            child = layout.takeAt(0)
            if child.widget():
                child.widget().deleteLater()

    def _setup_figure_style(self, fig):
        """Common figure styling to reduce code duplication."""
        fig.patch.set_facecolor('black')
        fig.patch.set_alpha(0.75)
        fig.patch.set_edgecolor('none')
        
        for ax in fig.get_axes():
            ax.patch.set_facecolor('black')
            ax.patch.set_alpha(0.5)
            ax.patch.set_edgecolor('none')
            
            for text in ax.texts:
                text.set_color(self.txtColor)
                text.set_alpha(self.txtAlpha)

    def display_investing_graph(self, fig):
        """Displays the Matplotlib graph inside the PyQt GUI."""
        self._clear_layout(self.investing_layout)
        self._setup_figure_style(fig)
        canvas = FigureCanvas(fig)
        self.investing_layout.addWidget(canvas)

    def display_crypto_graph(self, fig):
        """Displays the Matplotlib graph inside the PyQt GUI."""
        self._clear_layout(self.crypto_layout)
        self._setup_figure_style(fig)
        canvas = FigureCanvas(fig)
        self.crypto_layout.addWidget(canvas)

    def display_operating_graph(self, fig):
        """Displays the Matplotlib graph inside the PyQt GUI."""
        self._clear_layout(self.operating_layout)
        self._setup_figure_style(fig)
        canvas = FigureCanvas(fig)
        self.operating_layout.addWidget(canvas)

    def display_equity_graph(self, fig):
        """Displays the Matplotlib graph inside the PyQt GUI."""
        self._clear_layout(self.equity_layout)
        self._setup_figure_style(fig)
        canvas = FigureCanvas(fig)
        self.equity_layout.addWidget(canvas)

    def display_summary_graph(self, fig):
        """Displays the Matplotlib graph inside the PyQt GUI."""
        self._clear_layout(self.summary_layout)
        self._setup_figure_style(fig)
        canvas = FigureCanvas(fig)
        self.summary_layout.addWidget(canvas)

    def display_graph_empty(self, message):
        # Remove any existing graph
        for i in reversed(range(self.graph_layout.count())):
            widget = self.graph_layout.itemAt(i).widget()
            if widget is not None:
                widget.deleteLater()
        # Show a label with the message
        label = QLabel(message)
        label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.graph_layout.addWidget(label)