import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Load env vars
dotenv.config({ path: path.join(__dirname, "../.env") });

import { Gateway } from "../src/models/Gateway.model";

async function addNaloGateway() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/easevote";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const existingNalo = await Gateway.findOne({ provider: "nalo", type: "USSD" });

    if (existingNalo) {
      console.log("Nalo USSD gateway already exists in the database.");
    } else {
      console.log("Inserting Nalo USSD gateway...");
      await Gateway.create({
        provider: "nalo",
        type: "USSD",
        isPrimary: false,
        isEnabled: true,
        failureCount: 0
      });
      console.log("Successfully added Nalo USSD gateway!");
    }

  } catch (error) {
    console.error("Error updating gateways:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

addNaloGateway();
