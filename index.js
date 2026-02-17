const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', (req, res) => {
    res.send('Connect USSD Server is RUNNING! 🚀');
});

app.post('/ussd', (req, res) => {
    try {
        // Read the variables sent from the API
        const {
            sessionId,
            serviceCode,
            phoneNumber,
            text,
        } = req.body;

        console.log(`Received USSD request: text='${text}', phone='${phoneNumber}'`);


        let response = '';

        // Logic: The "text" field contains the user's input chain (e.g., "1*500")
        if (text == '') {
            // This is the first request. Note how we start the response with CON
            response = `CON Welcome to Connect Energy
            1. Buy Power
            2. Check Balance`;
        } else if (text == '1') {
            // Business logic for first level response
            response = `CON Enter Amount (Naira):`;
        } else if (text == '2') {
            // Business logic for check balance
            response = `END Your Wallet Balance is N2,500.
            Power Status: ON`;
        } else if (text.startsWith('1*')) {
            // If text is like "1*500", it means they entered an amount
            const amount = text.split('*')[1];
            // Here you would typically save to DB or check balance
            response = `END Payment of N${amount} Successful!
            Power has been turned ON.`;
        } else {
            response = `END Invalid option. Please try again.`;
        }

        // Send the response back to the API
        res.set('Content-Type', 'text/plain');
        res.send(response);
    } catch (error) {
        console.error('Error processing USSD:', error);
        res.status(500).send('END System Error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
