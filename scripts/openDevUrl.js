#!/usr/bin/env node
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
