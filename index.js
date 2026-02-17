const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', (req, res) => {
    res.send('Connect USSD Server is RUNNING! 🚀');
});

app.post('/ussd', (req, res) => {
    // 1. Log incoming request details for debugging
    console.log('--- NEW USSD REQUEST ---');
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Body:', JSON.stringify(req.body));

    try {
        // Read the variables sent from the API
        const {
            sessionId,
            serviceCode,
            phoneNumber,
            text,
        } = req.body;

        // 2. Ensuring 'text' is always a string to prevent crashes
        const cleanText = text || '';

        console.log(`Processing: text='${cleanText}', phone='${phoneNumber}'`);

        let response = '';

        // Logic: The "text" field contains the user's input chain (e.g., "1*500")
        if (cleanText == '') {
            // This is the first request. Note how we start the response with CON
            response = 'CON Welcome to Connect Energy\n1. Buy Power\n2. Check Balance';
        } else if (cleanText == '1') {
            // Business logic for first level response
            response = 'CON Enter Amount (Naira):';
        } else if (cleanText == '2') {
            // Business logic for check balance
            response = 'END Your Wallet Balance is N2,500.\nPower Status: ON';
        } else if (cleanText.startsWith('1*')) {
            // If text is like "1*500", it means they entered an amount
            const amount = cleanText.split('*')[1];
            // Here you would typically save to DB or check balance
            response = `END Payment of N${amount} Successful!\nPower has been turned ON.`;
        } else {
            response = 'END Invalid option. Please try again.';
        }

        console.log(`Sending response: '${response}'`);

        // Send the response back to the API
        res.set('Content-Type', 'text/plain');
        res.send(response);
    } catch (error) {
        console.error('CRITICAL ERROR processing USSD:', error);
        res.set('Content-Type', 'text/plain');
        res.send('END System Error. Please try again later.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
