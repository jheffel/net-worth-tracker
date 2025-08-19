#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Net Worth Tracker Setup');
console.log('==========================\n');

// Check if Node.js is installed
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' });
  console.log(`✅ Node.js ${nodeVersion.trim()} detected`);
} catch (error) {
  console.error('❌ Node.js is not installed. Please install Node.js 16+ first.');
  process.exit(1);
}

// Check if npm is installed
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' });
  console.log(`✅ npm ${npmVersion.trim()} detected`);
} catch (error) {
  console.error('❌ npm is not installed. Please install npm first.');
  process.exit(1);
}

// Install server dependencies
console.log('\n📦 Installing server dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Server dependencies installed');
} catch (error) {
  console.error('❌ Failed to install server dependencies');
  process.exit(1);
}

// Install client dependencies
console.log('\n📦 Installing client dependencies...');
try {
  execSync('npm install', { cwd: path.join(__dirname, 'client'), stdio: 'inherit' });
  console.log('✅ Client dependencies installed');
} catch (error) {
  console.error('❌ Failed to install client dependencies');
  process.exit(1);
}

// Create data directory
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Data directory created');
}

console.log('\n🎉 Setup complete!');
console.log('\nTo start the application:');
console.log('  npm run dev    # Start both server and client');
console.log('  npm run server # Start only the backend server');
console.log('  npm run client # Start only the frontend client');
console.log('\nThe application will be available at:');
console.log('  Frontend: http://localhost:3000');
console.log('  Backend:  http://localhost:5000');
console.log('\nFor the Python version, run:');
console.log('  python main.py');
