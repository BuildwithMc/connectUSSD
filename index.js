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
                if (!user.pin) {
                    // User exists but has NO PIN — prompt to set one
                    response = `CON Welcome ${user.name}!
Your account needs a PIN to continue.
Set Your 4-Digit Transaction PIN:`;
                    session.step = 'EXISTING_SET_PIN';
                } else {
                    // User exists with PIN -> Main Menu
                    response = `CON Welcome Back ${user.name}
1. Buy Power
2. Check Balance
3. Manage Account`;
                    session.step = 'MAIN_MENU';
                }
            } else {
                // New User -> Register
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
                // Verify account with Paystack first, then respond
                const name = await services.resolveAccount(accountNo, session.bankCode);
                if (name) {
                    session.accountName = name;
                    session.accountNumber = accountNo;
                    response = `CON Account Found: ${name}\n1. Confirm & Register\n2. Cancel`;
                    session.step = 'REGISTER_CONFIRM';
                } else {
                    response = `CON Account not found. Check details & re-enter 10-digit Account Number:`;
                    // Stay in same step so user can retry
                }
            } else {
                response = `CON Invalid Account Number. Must be exactly 10 digits:\nEnter Account Number:`;
                // Remain in step
            }
        } else if (session.step === 'REGISTER_CONFIRM') {
            const choice = text.split('*').pop();
            if (choice === '1') {
                // Account confirmed — now ask them to set a PIN
                response = `CON Account Verified!\nSet Your 4-Digit Transaction PIN:\n(This PIN secures all future transactions)`;
                session.step = 'REGISTER_SET_PIN';
            } else {
                response = `END Registration Cancelled.`;
                delete sessions[sessionId];
            }
        } else if (session.step === 'REGISTER_SET_PIN') {
            const pin = text.split('*').pop();
            if (pin.length !== 4 || isNaN(pin)) {
                response = `CON Invalid PIN. Must be exactly 4 digits:\nSet Your 4-Digit Transaction PIN:`;
                // Stay in same step
            } else {
                session.newPin = pin;
                response = `CON Confirm Your 4-Digit PIN:\n(Re-enter the same PIN to confirm)`;
                session.step = 'REGISTER_CONFIRM_PIN';
            }
        } else if (session.step === 'REGISTER_CONFIRM_PIN') {
            const confirmPin = text.split('*').pop();
            if (confirmPin !== session.newPin) {
                response = `CON PINs do not match. Try again:\nSet Your 4-Digit Transaction PIN:`;
                session.newPin = null;
                session.step = 'REGISTER_SET_PIN';
            } else {
                // PINs match — create the user with hashed PIN
                services.createUser(
                    phoneNumber,
                    session.accountName,
                    session.accountNumber,
                    session.bankName,
                    session.newPin
                );
                response = `END Registration Successful!\nWelcome ${session.accountName}.\nPIN set securely. Dial again to Buy Power.`;
                delete sessions[sessionId];
            }
        } else if (session.step === 'EXISTING_SET_PIN') {
            const pin = text.split('*').pop();
            if (pin.length !== 4 || isNaN(pin)) {
                response = `CON Invalid PIN. Must be exactly 4 digits:
Set Your 4-Digit Transaction PIN:`;
            } else {
                session.newPin = pin;
                response = `CON Confirm Your 4-Digit PIN:
(Re-enter the same PIN to confirm)`;
                session.step = 'EXISTING_CONFIRM_PIN';
            }
        } else if (session.step === 'EXISTING_CONFIRM_PIN') {
            const confirmPin = text.split('*').pop();
            if (confirmPin !== session.newPin) {
                response = `CON PINs do not match. Try again:
Set Your 4-Digit Transaction PIN:`;
                session.newPin = null;
                session.step = 'EXISTING_SET_PIN';
            } else {
                // Save PIN for existing user
                services.setPin(phoneNumber, session.newPin);
                response = `END PIN Set Successfully!
Dial again to access your account.`;
                delete sessions[sessionId];
            }
        } else if (session.step === 'MAIN_MENU') {
            const choice = text.split('*').pop();
            if (choice === '1') {
                response = `CON Buy Power
Enter Amount (Naira):`;
                session.step = 'BUY_ENTER_AMOUNT';
            } else if (choice === '2') {
                // Ask for PIN before showing balance
                response = `CON Check Balance
Enter Your 4-Digit Transaction PIN:`;
                session.step = 'CHECK_BALANCE_PIN';
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
        } else if (session.step === 'CHECK_BALANCE_PIN') {
            const pin = text.split('*').pop();
            const pinValid = services.verifyPin(phoneNumber, pin);
            if (pinValid) {
                const user = services.getUserByPhone(phoneNumber);
                response = `END Account Balance: N${user.balance}
Meter Status: ${user.status}
Account: ${user.bank} - *${user.account.slice(-4)}`;
            } else {
                response = `END Incorrect PIN. Access Denied.
Dial again to retry.`;
            }
            delete sessions[sessionId];
        } else if (session.step === 'BUY_ENTER_PIN') {
            const pin = text.split('*').pop();
            const pinValid = services.verifyPin(phoneNumber, pin);
            if (pinValid) {
                const amount = parseInt(session.amount);
                services.updateBalance(phoneNumber, amount);
                // Fetch updated balance from DB
                const updatedUser = services.getUserByPhone(phoneNumber);
                // Generate electricity token
                const token = Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000);
                response = `END Payment Successful! N${session.amount} received.
Your meter has been automatically recharged.
Token: ${token}
New Balance: N${updatedUser.balance}
Power Status: ON`;
                delete sessions[sessionId];
            } else {
                response = `END Incorrect PIN. Transaction Failed.
Dial again to retry.`;
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
