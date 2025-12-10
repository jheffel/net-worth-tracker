const axios = require('axios');
const assert = require('assert');

const API_URL = 'http://localhost:5000/api';

async function testAuth() {
    console.log('Starting Auth Test...');

    const username = `testuser_${Date.now()}`;
    const password = 'password123';

    // 1. Register
    try {
        console.log('1. Testing Registration...');
        const regRes = await axios.post(`${API_URL}/auth/register`, { username, password });
        assert.strictEqual(regRes.status, 201, 'Registration should return 201');
        console.log('   Registration successful.');
    } catch (err) {
        console.error('   Registration failed:', err.response?.data || err.message);
        process.exit(1);
    }

    // 2. Login
    let token;
    try {
        console.log('2. Testing Login...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, { username, password });
        assert.strictEqual(loginRes.status, 200, 'Login should return 200');
        assert.ok(loginRes.data.token, 'Login should return a token');
        token = loginRes.data.token;
        console.log('   Login successful. Token received.');
    } catch (err) {
        console.error('   Login failed:', err.response?.data || err.message);
        process.exit(1);
    }

    // 3. Access Protected Route (Accounts) without token
    try {
        console.log('3. Testing Protected Route (No Token)...');
        await axios.get(`${API_URL}/accounts`);
        console.error('   Failed: Should have been rejected.');
        process.exit(1);
    } catch (err) {
        if (err.response && err.response.status === 401) {
            console.log('   Access correctly denied (401).');
        } else {
            console.error('   Unexpected error:', err.message);
            process.exit(1);
        }
    }

    // 4. Access Protected Route (Accounts) with token
    try {
        console.log('4. Testing Protected Route (With Token)...');
        const accRes = await axios.get(`${API_URL}/accounts`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.strictEqual(accRes.status, 200, 'Should access protected route');
        console.log('   Access successful.');
        console.log('   Accounts:', accRes.data);
    } catch (err) {
        console.error('   Access failed with token:', err.response?.data || err.message);
        process.exit(1);
    }

    console.log('\nALL TESTS PASSED!');
}

// Wait for server to start if we were running it, but here we assume it's running. 
// Since I can't guarantee it's running, I'll print a message.
testAuth();
