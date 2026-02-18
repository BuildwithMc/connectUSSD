const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');
const PAYSTACK_SECRET = 'sk_test_a9218d5c3caa55878f8646cd08cc79682f4d6195';

// --- Database Logic ---
function loadDB() {
    try {
        if (!fs.existsSync(DB_FILE)) return [];
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getUserByPhone(phone) {
    const db = loadDB();
    const user = db.find(u => u.phone === phone);
    // Return mock user if not found sometimes? No, enforce registration.
    return user;
}

function createUser(phone, name, account, bank) {
    const db = loadDB();
    const newUser = {
        phone,
        name,
        account,
        bank,
        balance: 1000, // Welcome bonus
        status: 'ON'
    };
    db.push(newUser);
    saveDB(db);
    return newUser;
}

function updateBalance(phone, amount) {
    const db = loadDB();
    const user = db.find(u => u.phone === phone);
    if (user) {
        user.balance += amount; // Simulation (add logic for deduction?)
        // If buying power, deduct?
        // Wait, "Buy Power" usually deducts.
        // User flow: "Input amount... paystack generated... validated... transaction successful".
        // This implies Adding Funds or Paying Bill?
        // "Buy Power" usually means paying for electricity.
        // I'll deduct for now.
        user.balance -= amount;
        saveDB(db);
    }
}

// --- Paystack Logic ---
async function resolveAccount(accountNumber, bankCode) {
    try {
        console.log(`Verifying Account: ${accountNumber} at ${bankCode} (Service API)`);
        const response = await axios.get(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
        });

        // Log the full response to debug
        console.log("Paystack Response:", JSON.stringify(response.data));

        if (response.data && response.data.status) {
            return response.data.data.account_name;
        }
        return null;
    } catch (error) {
        console.error("Paystack API Error:", error.response?.data || error.message);
        return null;
    }
}

// Hardcoded Banks for USSD (To save API calls/latency)
const BANKS = [
    { name: 'Access Bank', code: '044' },
    { name: 'GTBank', code: '058' },
    { name: 'Zenith Bank', code: '057' },
    { name: 'First Bank', code: '011' },
    { name: 'UBA', code: '033' }
];

module.exports = {
    getUserByPhone,
    createUser,
    resolveAccount,
    updateBalance,
    BANKS
};
