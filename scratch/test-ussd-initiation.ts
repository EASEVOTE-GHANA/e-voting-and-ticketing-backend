import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

import { Event } from "../src/models/Event.model";
import { PurchaseService } from "../src/services/purchase.service";

async function testUSSDInitiation() {
  console.log("🚀 Testing USSD Payment Initiation...");
  
  try {
    // 1. Connect to DB
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("✅ Connected to MongoDB");

    // 2. Find Candidate HG1
    const event = await Event.findOne({ "categories.candidates.code": "HG1" });
    if (!event) {
      console.error("❌ Candidate HG1 not found in any event.");
      process.exit(1);
    }

    const category = event.categories.find(c => c.candidates.some(cand => cand.code === "HG1"));
    const candidate = category?.candidates.find(cand => cand.code === "HG1");

    if (!category || !candidate) {
      console.error("❌ Category or Candidate metadata not found.");
      process.exit(1);
    }

    console.log(`📍 Found Candidate: ${candidate.name} in Event: ${event.title}`);
    console.log(`💰 Category: ${category.name}`);

    // 3. Initiate USSD Purchase
    // Using a test phone number and 20 votes
    const testPhone = "233544123456"; 
    const voteCount = 20;

    console.log(`\n🔄 Initiating USSD payment for ${voteCount} votes...`);
    console.log(`📱 Phone: ${testPhone}`);

    const result = await PurchaseService.initializeVotePurchaseUSSD({
      eventId: event._id.toString(),
      candidateId: candidate._id.toString(),
      categoryId: category._id!.toString(),
      voteCount: voteCount,
      customerPhone: testPhone,
      network: "MTN",
      source: "ussd"
    });

    console.log("\n✅ USSD Payment Initialized Successfully!");
    console.log(`🔗 Reference: ${result.reference}`);
    console.log(`💬 Message: ${result.message}`);
    console.log(`🌐 Status: ${result.paymentUrl}`);

  } catch (error: any) {
    console.error("\n❌ USSD Initiation Failed:");
    console.error(error.message);
    if (error.response?.data) {
      console.error("API Response:", JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

testUSSDInitiation();
