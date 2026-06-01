import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { AppsMobileService } from "../src/services/appsmobile.service";

async function testAppsMobileWeb() {
    console.log("Starting AppsMobile Web Payment Test...");
    const service = new AppsMobileService();
    
    try {
        const result = await service.initializePayment({
            email: "test@easevote.com",
            amount: 0.1, // Smallest amount for testing
            reference: "TEST_APPSMOBILE_" + Date.now(),
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

testAppsMobileWeb();
