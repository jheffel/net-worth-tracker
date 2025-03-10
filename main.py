from controller import FinanceController
from PyQt6.QtWidgets import QApplication
import sys

# Run the application
if __name__ == "__main__":
    app = QApplication(sys.argv)
    #app.setStyle("cleanlooks")
    app.setStyle("Fusion")
    window = FinanceController()
    window.show()
    sys.exit(app.exec())