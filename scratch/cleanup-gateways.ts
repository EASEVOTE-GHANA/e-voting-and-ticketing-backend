import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function cleanupGateways() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI not found in environment.");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection failed");
    
    console.log("Identifying gateways to remove...");
    const collection = db.collection("gateways");

    // Remove flutterwave entirely
    const res1 = await collection.deleteMany({ provider: "flutterwave" });
    console.log(`- Removed ${res1.deletedCount} flutterwave gateway records.`);

    // Remove paystack USSD
    const res2 = await collection.deleteMany({ provider: "paystack", type: "USSD" });
    console.log(`- Removed ${res2.deletedCount} paystack USSD gateway records.`);

    console.log("Cleanup complete!");
    process.exit(0);
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  }
}

cleanupGateways();
