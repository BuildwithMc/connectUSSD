const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const services = require('./services');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// In-Memory Session Storage
const sessions = {};

app.post('/ussd', async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    console.log(`USSD Session: ${sessionId} Phone: ${phoneNumber} Text: ${text}`);

    // If text is empty, reset session
    let session = sessions[sessionId] || { step: 'WELCOME' };
    if (text === '') {
        session = { step: 'WELCOME' };
    }

    let response = '';

    try {
        if (session.step === 'WELCOME') {
            const user = services.getUserByPhone(phoneNumber);
            if (user) {
                // User Exists -> Main Menu
                response = `CON Welcome Back ${user.name}
1. Buy Power
2. Check Balance
3. Manage Account`;
                session.step = 'MAIN_MENU';
            } else {
                // User New -> Register
                response = `CON Welcome to Connect Energy
Please Register to proceed.
Select Your Bank:
1. Access Bank
2. GTBank
3. Zenith Bank
4. First Bank
5. UBA`;
                session.step = 'REGISTER_SELECT_BANK';
            }
        } else if (session.step === 'REGISTER_SELECT_BANK') {
            const selection = parseInt(text.split('*').pop());
            const bank = services.BANKS[selection - 1];
            if (bank) {
                session.bankCode = bank.code;
                session.bankName = bank.name;
                response = `CON Enter your 10-digit Account Number:`;
                session.step = 'REGISTER_ENTER_ACCOUNT';
            } else {
                response = `END Invalid Bank Selection.`;
                delete sessions[sessionId];
            }
        } else if (session.step === 'REGISTER_ENTER_ACCOUNT') {
            const accountNo = text.split('*').pop();
            if (accountNo.length === 10) {
                response = `CON Verifying Account...
(Press 1 to continue)`;
                // In real USSD, blocking operations > 2s timeout.
                // We ask user to "Press 1" to give us time or just try?
                // Let's try async verify in one go if fast.
                // If slow, user sees "Connection Problem".
                // I'll try direct verify.
                const name = await services.resolveAccount(accountNo, session.bankCode);
                if (name) {
                    session.accountName = name;
                    session.accountNumber = accountNo;
                    response = `CON Account Found: ${name}
1. Confirm & Register
2. Cancel`;
                    session.step = 'REGISTER_CONFIRM';
                } else {
                    response = `END Account verification failed. Name not found.`;
                    delete sessions[sessionId];
                }
            } else {
                response = `CON Invalid Account Number. Enter 10 digits:`;
                // Remain in step
            }
        } else if (session.step === 'REGISTER_CONFIRM') {
            const choice = text.split('*').pop();
            if (choice === '1') {
                services.createUser(phoneNumber, session.accountName, session.accountNumber, session.bankName);
                response = `END Registration Successful!
Welcome ${session.accountName}.
Dial again to Buy Power.`;
                delete sessions[sessionId];
            } else {
                response = `END Registration Cancelled.`;
                delete sessions[sessionId];
            }
        } else if (session.step === 'MAIN_MENU') {
            const choice = text.split('*').pop();
            if (choice === '1') {
                response = `CON Buy Power
Enter Amount (Naira):`;
                session.step = 'BUY_ENTER_AMOUNT';
            } else if (choice === '2') {
                const user = services.getUserByPhone(phoneNumber);
                response = `END Wallet Balance: N${user.balance}
Status: ${user.status}`;
                delete sessions[sessionId];
            } else {
                response = `END Invalid Choice.`;
                delete sessions[sessionId];
            }
        } else if (session.step === 'BUY_ENTER_AMOUNT') {
            const amount = text.split('*').pop();
            if (!amount || isNaN(amount)) {
                response = `CON Invalid Amount. Enter Numbers only:`;
                // Do not change step
            } else {
                session.amount = amount;
                // Get user bank details to show
                const user = services.getUserByPhone(phoneNumber);
                if (user && user.account) {
                    const maskedAcct = user.account.length > 4 ? user.account.slice(-4) : user.account;
                    response = `CON Buy N${amount} Power?
Bank: ${user.bank || 'Saved Bank'} - *${maskedAcct}
Enter 4-Digit PIN to confirm:`;
                    session.step = 'BUY_ENTER_PIN';
                } else {
                    // Fallback if user data is missing (should not happen if registered)
                    response = `END Error: Bank details missing. Please register again.`;
                    delete sessions[sessionId];
                }
            }
        } else if (session.step === 'BUY_ENTER_PIN') {
            const pin = text.split('*').pop();
            // Verify PIN (Simulation: Any 4 digits)
            if (pin.length === 4) {
                // Deduct balance? Or charge?
                // Simulation: Success
                services.updateBalance(phoneNumber, parseInt(session.amount));
                // Generate Token
                const token = Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000);
                response = `END Transaction Successful!
Token: ${token}
Power Status: ON`;
                delete sessions[sessionId];
            } else {
                response = `END Invalid PIN Format. Transaction Failed.`;
                delete sessions[sessionId];
            }
        } else {
            response = `END Invalid Session State.`;
            delete sessions[sessionId];
        }

        // Save session state
        if (!response.startsWith('END')) {
            sessions[sessionId] = session;
        }

    } catch (e) {
        console.error(e);
        response = `END System Error. Please try again.`;
        delete sessions[sessionId];
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

// Start Server
app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on port 3000');
    // Auto-detect Ngrok
    checkNgrok();
});

// Ngrok Poller (Keep this helper!)
async function checkNgrok() {
    try {
        const resp = await fetch('http://127.0.0.1:4040/api/tunnels');
        if (resp.ok) {
            const data = await resp.json();
            const url = data.tunnels[0]?.public_url;
            if (url) console.log(`\nCallback URL: ${url}/ussd\n`);
        }
    } catch (e) { }
}
