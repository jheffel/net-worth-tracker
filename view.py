from PyQt6.QtWidgets import (QSplitter, QTextEdit, QWidget, QVBoxLayout, QHBoxLayout, QFrame, QScrollArea, QCheckBox, QLabel, QPushButton, QComboBox)
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from PyQt6.QtCore import Qt

class FinanceView(QWidget):
    def __init__(self, controller, parent=None):
        super().__init__(parent)
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

        # Set initial widget sizes
        self.splitter1.setSizes([100, 200])  

        # Create vertical splitter to divide left and bottom areas
        self.splitter2 = QSplitter(Qt.Orientation.Vertical)
        self.splitter2.addWidget(self.splitter1)
        self.splitter2.addWidget(self.bottom)

        # Create a central widget and layout to hold the splitters
        self.central_widget = QWidget()
        self.hbox = QHBoxLayout(self.central_widget)
        self.hbox.addWidget(self.splitter2)
        self.setLayout(self.hbox)

        # Apply cleanlooks style for visual consistency
        # QApplication.setStyle("cleanlooks")

        # Left panel for account selection
        self.account_frame = QFrame(self.topleft)
        self.account_layout = QVBoxLayout(self.account_frame)
        self.topleft.setLayout(self.account_layout)



        # Time filter dropdown
        self.time_filter_label = QLabel("Select Timeframe:", self.account_frame)
        self.account_layout.addWidget(self.time_filter_label)
        self.time_filter_var = QComboBox(self.account_frame)
        self.time_filter_var.addItems(["All Data", "Last Year", "Last 6 Months", "Last 3 Months", "Last Month"])
        self.time_filter_var.currentIndexChanged.connect(self.controller.plot_net_worth)
        self.account_layout.addWidget(self.time_filter_var)

        # "Check/Uncheck All" Button
        self.toggle_button = QPushButton("Check/Uncheck All", self.account_frame)
        self.toggle_button.clicked.connect(self.controller.toggle_all_accounts)
        self.account_layout.addWidget(self.toggle_button)

        # Import ODS Button
        self.import_button = QPushButton("Import ODS", self.account_frame)
        self.import_button.clicked.connect(self.controller.import_from_ods)
        self.account_layout.addWidget(self.import_button)

        # Create a scroll area for the account subframe
        self.scroll_area = QScrollArea(self.account_frame)
        self.scroll_area.setWidgetResizable(True)
        self.account_subframe = QWidget()
        self.account_subframe_layout = QVBoxLayout(self.account_subframe)
        self.scroll_area.setWidget(self.account_subframe)
        self.account_layout.addWidget(self.scroll_area)

        # Account checkboxes
        self.account_check_vars = {}

        # Right panel for graph
        self.graph_frame = QFrame(self.splitter1)
        self.graph_layout = QVBoxLayout(self.graph_frame)
        self.topleft.setLayout(self.graph_layout)

        # Bottom panel for pie charts
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

    def update_account_checkboxes(self, accounts):
        """Updates the account checkboxes dynamically."""
        for i in reversed(range(self.account_subframe_layout.count())):
            widget = self.account_subframe_layout.itemAt(i).widget()
            if widget is not None:
                widget.deleteLater()

        for account in accounts:
            var = QCheckBox(account, self.account_subframe)
            var.setChecked(True)
            var.stateChanged.connect(self.controller.plot_net_worth)
            self.account_check_vars[account] = var
            self.account_subframe_layout.addWidget(var)

    def display_graph(self, fig):
        """Displays the Matplotlib graph inside the PyQt GUI."""
        for i in reversed(range(self.graph_layout.count())):
            widget = self.graph_layout.itemAt(i).widget()
            if widget is not None:
                widget.deleteLater()

        # Set the figure and axes background to transparent
        fig.patch.set_facecolor('black')
        fig.patch.set_alpha(0.5)
        fig.patch.set_edgecolor('none')
        for ax in fig.get_axes():
            ax.patch.set_facecolor('black')
            ax.patch.set_alpha(0.5)
            ax.patch.set_edgecolor('none')
        
        canvas = FigureCanvas(fig)
        self.graph_layout.addWidget(canvas)

    def display_investing_graph(self, fig):
        """Displays the Matplotlib graph inside the PyQt GUI."""
        for i in reversed(range(self.investing_layout.count())):
            widget = self.investing_layout.itemAt(i).widget()
            if widget is not None:
                widget.deleteLater()

        # Set the figure and axes background to transparent
        fig.patch.set_facecolor('black')
        fig.patch.set_alpha(0.5)
        fig.patch.set_edgecolor('none')
        for ax in fig.get_axes():
            ax.patch.set_facecolor('black')
            ax.patch.set_alpha(0.5)
            ax.patch.set_edgecolor('none')

        canvas = FigureCanvas(fig)
        self.investing_layout.addWidget(canvas)

    def display_crypto_graph(self, fig):
        """Displays the Matplotlib graph inside the PyQt GUI."""
        for i in reversed(range(self.crypto_layout.count())):
            widget = self.crypto_layout.itemAt(i).widget()
            if widget is not None:
                widget.deleteLater()

        # Set the figure and axes background to transparent
        fig.patch.set_facecolor('black')
        fig.patch.set_alpha(0.5)
        fig.patch.set_edgecolor('none')
        for ax in fig.get_axes():
            ax.patch.set_facecolor('black')
            ax.patch.set_alpha(0.5)
            ax.patch.set_edgecolor('none')

        canvas = FigureCanvas(fig)
        self.crypto_layout.addWidget(canvas)

    def display_operating_graph(self, fig):
        """Displays the Matplotlib graph inside the PyQt GUI."""
        for i in reversed(range(self.operating_layout.count())):
            widget = self.operating_layout.itemAt(i).widget()
            if widget is not None:
                widget.deleteLater()

        # Set the figure and axes background to transparent
        fig.patch.set_facecolor('black')
        fig.patch.set_alpha(0.5)
        fig.patch.set_edgecolor('none')
        for ax in fig.get_axes():
            ax.patch.set_facecolor('black')
            ax.patch.set_alpha(0.5)
            ax.patch.set_edgecolor('none')

        canvas = FigureCanvas(fig)
        self.operating_layout.addWidget(canvas)

    def display_equity_graph(self, fig):
        """Displays the Matplotlib graph inside the PyQt GUI."""
        for i in reversed(range(self.equity_layout.count())):
            widget = self.equity_layout.itemAt(i).widget()
            if widget is not None:
                widget.deleteLater()

        # Set the figure and axes background to transparent
        fig.patch.set_facecolor('black')
        fig.patch.set_alpha(0.5)
        fig.patch.set_edgecolor('none')
        for ax in fig.get_axes():
            ax.patch.set_facecolor('black')
            ax.patch.set_alpha(0.5)
            ax.patch.set_edgecolor('none')

        canvas = FigureCanvas(fig)
        self.equity_layout.addWidget(canvas)