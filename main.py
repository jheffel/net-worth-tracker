# Net Worth Tracker
# Copyright (C) 2025 jheffel
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
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