import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/easevote");
  const db = mongoose.connection.db;
  if (!db) return;
  const purchases = db.collection('purchases');
  console.log("PAID count:", await purchases.countDocuments({ status: "PAID" }));
  console.log("ALL count:", await purchases.countDocuments());
  const sample = await purchases.findOne();
  console.log("Sample status:", sample?.status);
  
  const events = db.collection('events');
  console.log("Events count:", await events.countDocuments());

  process.exit(0);
}
run().catch(console.error);
