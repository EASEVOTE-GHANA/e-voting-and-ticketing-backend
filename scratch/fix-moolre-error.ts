import mongoose from "mongoose";
import dotenv from "dotenv";
import { Purchase } from "../src/models/Purchase.model";

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/easevote";

async function run() {
  await mongoose.connect(MONGO_URI);
  const purchases = await Purchase.find({ paymentReference: { $in: ["EV_0D4C6BEAB527DD9D", "EV_46792F7CEACC9E3C"] } });
  
  for (const purchase of purchases) {
    purchase.paymentGateway = "APPSMOBILE";
    await purchase.save();
    console.log(`Updated ${purchase.paymentReference} to APPSMOBILE`);
  }
  
  process.exit(0);
}
run().catch(console.error);
