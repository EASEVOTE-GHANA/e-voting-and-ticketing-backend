import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

import { AppsMobileService } from "../src/services/appsmobile.service";

async function testAppsMobileUSSD() {
  console.log("🚀 Testing Apps&Mobile USSD Payment API...");
  
  const gateway = new AppsMobileService();
  
  const testData = {
    customerPhone: "233544123456", // Use a valid test phone number
    email: "test-ussd@easevote.com",
    amount: 1.0,                   // 1.0 GHS for testing
    reference: `TEST-USSD-${Date.now()}`,
    network: "MTN",
    callback_url: "https://example.com/callback"
  };

  console.log("\n📡 Sending Request to Apps&Mobile (Orchard)...");
  console.log(`📱 Phone: ${testData.customerPhone}`);
  console.log(`💰 Amount: ${testData.amount} GHS`);
  console.log(`🔗 Ref: ${testData.reference}`);

  try {
    const result = await gateway.initializeUSSDPayment(testData);

    console.log("\n✅ API Response Received:");
    console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
    console.log(`Message: ${result.message}`);
    console.log(`Reference: ${result.reference}`);
  } catch (error: any) {
    console.error("\n❌ API Request Failed:");
    console.error(error.message);
    if (error.response?.data) {
      console.error("Technical Details:", JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    process.exit();
  }
}

testAppsMobileUSSD();
