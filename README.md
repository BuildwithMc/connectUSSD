# Connect Energy USSD Service ⚡️

Welcome to the **Connect Energy** USSD service. This service allows users to easily buy power, verify their bank accounts, and check their wallet balance using simple USSD codes—working even without an internet connection!

## 📱 How to Use

### **USSD Code:**
# `*384*04227#`

---

## 🚀 How to Test (Live Simulator)

You can test this service cleanly using the Africa's Talking Simulator.

1.  **Go to the Simulator:**
    [https://developers.africastalking.com/simulator](https://developers.africastalking.com/simulator)

2.  **Enter a Phone Number:**
    *   Use any random number (e.g., `08012345678`) to test the **Registration Flow**.
    *   Use `+2348106212765` to test the **Returning User Flow**.

3.  **Dial the Code:**
    Type `*384*04227#` and hit **Call**.

---

## 🌟 Features

### 1. **New User Registration (KYC)**
*   If you are new, the system will ask you to register.
*   **Select Bank:** Choose from the list (Access, GTB, Zenith, etc.).
*   **Verify Account:** Enter your **10-digit NUBAN Account Number**.
*   **Real-time Validation:** The system connects to **Paystack** to verify your name matches the account number instantly.
*   **Confirm:** Once verified, your account is created!

### 2. **Buy Power**
*   Select "Buy Power" from the main menu.
*   Enter the amount (e.g., `500`).
*   Confirm with your 4-digit PIN (default: `1234`).
*   Receive your **Electricity Token** instantly via SMS/Screen.

### 3. **Check Balance**
*   View your current wallet balance and power status (ON/OFF).

---

## 🛠 Tech Stack
*   **Node.js & Express:** Backend Logic.
*   **Africa's Talking:** USSD Gateway.
*   **Paystack API:** Bank Account Verification.
*   **Local JSON DB:** Fast simulation of user profiles.

---

> *Built for the Connect Energy Hackathon.*
