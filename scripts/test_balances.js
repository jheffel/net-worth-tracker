const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/balances',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer ' + process.argv[2]
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        const parsed = JSON.parse(data);
        const accounts = Object.keys(parsed);
        console.log('Accounts in response:', accounts);
        if (accounts.length > 0) {
            const firstAccount = accounts[0];
            const dates = Object.keys(parsed[firstAccount]);
            console.log(`First account "${firstAccount}" has ${dates.length} dates`);
            console.log('Sample dates:', dates.slice(0, 3));
            console.log('Sample values:', dates.slice(0, 3).map(d => parsed[firstAccount][d]));
        }
    });
});
req.on('error', (e) => console.error('Error:', e.message));
req.end();
