#!/usr/bin/env node

// Net Worth Tracker
// Copyright (C) 2025 jheffel
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

// Small helper: wait a bit then open the dev app at the correct path
const { exec } = require('child_process');

const url = process.env.DEV_URL || 'http://localhost:3000/net-worth-tracker';
const delay = parseInt(process.env.DEV_OPEN_DELAY || '2500', 10);

setTimeout(() => {
  let cmd;
  const platform = process.platform;
  if (platform === 'win32') {
    // Use cmd start via /c to ensure it runs
    cmd = `cmd /c start "" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    // linux
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      // best-effort: just log, do not crash
      console.error('Failed to open browser to', url, err && err.message);
    }
  });
}, delay);
