import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { NaloPaymentService } from "../src/services/nalo-payment.service";

async function testNalo() {
    console.log("Starting Nalo USSD Payment Test...");
    const service = new NaloPaymentService();
    
    try {
        const result = await service.initializeUSSDPayment({
            email: "test@easevote.com",
            amount: 0.1, // Smallest amount for testing
            reference: "TEST_NALO_" + Date.now(),
            network: "MTN", // 059 is usually MTN
            customerPhone: "0592407690",
            callback_url: "https://api-dev.easevotegh.com/api/purchases/webhook/payment",
            metadata: {
                test: true,
                customerName: "Test User"
            }
        });
        
        console.log("\n================ TEST RESULT ================\n");
        console.log(JSON.stringify(result, null, 2));
        console.log("\n=============================================\n");
        
    } catch (e: any) {
        console.error("\n================ TEST FAILED ================\n");
        console.error(e.message);
        if (e.response) {
            console.error("Response data:", JSON.stringify(e.response.data, null, 2));
        }
        console.error("\n=============================================\n");
    }
}

testNalo();
