from controller import FinanceController
from PyQt6.QtWidgets import QApplication
from PyQt6.QtGui import QIcon
import sys

# Run the application
if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    app.setStyle("Fusion")
    app.setWindowIcon(QIcon('images/logo.webp'))
    
    window = FinanceController()
    window.show()
    sys.exit(app.exec())