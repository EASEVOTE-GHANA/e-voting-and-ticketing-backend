import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import crypto from "crypto";
import axios from "axios";

async function testNaloDirect() {
    console.log("Starting Nalo USSD Payment Test directly...");
    
    // The user's auth key might include "Basic ", strip it for the secret
    let basicAuth = process.env.NALOPAY_AUTH_KEY || process.env.NALOPAY_BASIC_AUTH || "";
    if (basicAuth.startsWith("Basic ")) {
        basicAuth = basicAuth.replace("Basic ", "").trim();
    }
    const secretKey = basicAuth; // Try using the basic auth key as the HMAC secret
    const merchantId = process.env.NALOPAY_MERCHANT_ID || "";
    
    const amount = 0.1;
    const customerPhone = "0592407690";
    const reference = "TEST_NALO_" + Date.now();
    
    // Test 1: Without decimal
    const message1 = `${merchantId}${customerPhone}${amount}${reference}`;
    const hash1 = crypto.createHmac("sha256", secretKey).update(message1).digest("hex");
    
    // Test 2: With decimal .toFixed(2)
    const message2 = `${merchantId}${customerPhone}${amount.toFixed(2)}${reference}`;
    const hash2 = crypto.createHmac("sha256", secretKey).update(message2).digest("hex");

    console.log("Secret used:", secretKey.substring(0, 10) + "...");
    console.log("Hash 1 (Raw):", hash1);
    console.log("Hash 2 (Fixed 2):", hash2);
    
    try {
        // Fetch JWT Token first
        const tokenResp = await axios.post(
            `https://api.nalopay.com/clientapi/generate-payment-token/`,
            { merchant_id: merchantId },
            { headers: { "Authorization": `Basic ${basicAuth}` } }
        );
        const jwtToken = tokenResp.data.data.token;
        
        console.log("Successfully fetched JWT.");

        // Try Hash 1 (Raw)
        try {
            console.log("\nAttempting Hash 1 (Raw amount)...");
            const res1 = await axios.post(
                `https://api.nalopay.com/clientapi/collection/`,
                {
                  merchant_id: merchantId,
                  service_name: "MOMO_TRANSACTION",
                  trans_hash: hash1,
                  account_number: customerPhone,
                  account_name: "Test User",
                  network: "MTN",
                  amount: amount,
                  reference: reference,
                  callback: "https://api-dev.easevotegh.com/api/purchases/webhook/payment"
                },
                { headers: { "token": jwtToken, "Content-Type": "application/json" } }
            );
            console.log("Hash 1 Succeeded!");
            console.log(res1.data);
            return;
        } catch (e: any) {
            console.error("Hash 1 Failed:", e.response?.data?.error?.description || e.message);
        }
        
        // Try Hash 2 (Fixed)
        try {
            console.log("\nAttempting Hash 2 (Fixed amount)...");
            const res2 = await axios.post(
                `https://api.nalopay.com/clientapi/collection/`,
                {
                  merchant_id: merchantId,
                  service_name: "MOMO_TRANSACTION",
                  trans_hash: hash2,
                  account_number: customerPhone,
                  account_name: "Test User",
                  network: "MTN",
                  amount: amount,
                  reference: reference,
                  callback: "https://api-dev.easevotegh.com/api/purchases/webhook/payment"
                },
                { headers: { "token": jwtToken, "Content-Type": "application/json" } }
            );
            console.log("Hash 2 Succeeded!");
            console.log(res2.data);
            return;
        } catch (e: any) {
            console.error("Hash 2 Failed:", e.response?.data?.error?.description || e.message);
        }

    } catch (e: any) {
        console.error("Failed entirely:", e.response?.data || e.message);
    }
}

testNaloDirect();
