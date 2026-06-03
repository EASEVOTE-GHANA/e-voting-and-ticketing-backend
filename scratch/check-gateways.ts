import mongoose from "mongoose";
import dotenv from "dotenv";
import { Gateway } from "../src/models/Gateway.model";

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/easevote";

async function run() {
  await mongoose.connect(MONGO_URI);
  const ussdGateways = await Gateway.find({ type: "USSD" });
  console.log("USSD Gateways in DB:", ussdGateways.map(g => ({ provider: g.provider, isPrimary: g.isPrimary, isEnabled: g.isEnabled })));
  process.exit(0);
}
run().catch(console.error);
