const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function checkRecentVote() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not found");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);

    const EventSchema = new mongoose.Schema({}, { strict: false });
    const PurchaseSchema = new mongoose.Schema({}, { strict: false });
    
    const Event = mongoose.models.Event || mongoose.model("Event", EventSchema);
    const Purchase = mongoose.models.Purchase || mongoose.model("Purchase", PurchaseSchema);

    // Find the latest VOTE purchase
    const latestPurchase = await Purchase.findOne({ type: "VOTE" })
      .sort({ createdAt: -1 });

    if (!latestPurchase) {
      console.log("No vote purchases found in the database.");
      process.exit(0);
    }

    // Find the associated event
    const event = await Event.findById(latestPurchase.eventId);

    console.log(`\n--- Most Recent Vote Attempt ---`);
    console.log(`Event: ${event ? event.title : "Unknown (" + latestPurchase.eventId + ")"}`);
    console.log(`Amount: GHS ${latestPurchase.amount}`);
    console.log(`Votes: ${latestPurchase.voteCount}`);
    console.log(`Status: ${latestPurchase.status}`);
    console.log(`Reference: ${latestPurchase.paymentReference}`);
    console.log(`Created At: ${new Date(latestPurchase.createdAt).toLocaleString()}`);
    console.log(`Customer: ${latestPurchase.customerName || "N/A"} (${latestPurchase.customerEmail || "N/A"})`);
    
    if (latestPurchase.status !== "PAID") {
      console.log(`\n⚠️  Status: ${latestPurchase.status}`);
      console.log(`RESULT: This vote has NOT been paid for and is NOT included in the revenue or vote tallies.`);
    } else {
      console.log(`\n✅ Status: PAID`);
      console.log(`RESULT: This vote was successfully paid and verified.`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Check failed:", err);
    process.exit(1);
  }
}

checkRecentVote();
