const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function checkMaxwell() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // Find the event
  const event = await db.collection("events").findOne({ eventCode: "A953A6" });
  
  // Find Maxwell's candidate ID
  let maxwellId = null;
  event.categories?.forEach(cat => {
    cat.candidates.forEach(c => {
      if (c.name === "Maxwell Sarpong") {
        maxwellId = c._id;
        console.log(`Maxwell's candidate ID: ${c._id}`);
        console.log(`Maxwell's current votes in Event model: ${c.votes}`);
      }
    });
  });

  // Find ALL purchases for Maxwell (any status)
  console.log("\n--- ALL purchases for Maxwell Sarpong ---");
  const purchases = await db.collection("purchases").find({
    eventId: event._id,
    candidateId: maxwellId
  }).sort({ createdAt: -1 }).toArray();

  if (purchases.length === 0) {
    console.log("  No purchases found for Maxwell at all.");
  } else {
    purchases.forEach(p => {
      console.log(`  [${p.status}] ${p.voteCount} votes | GHS ${p.amount} | ${p.customerName || "N/A"} | ${p.customerEmail || "N/A"} | ${new Date(p.createdAt).toLocaleString()} | Ref: ${p.paymentReference}`);
    });
  }

  // Also check if candidateId might be stored as a string vs ObjectId
  console.log("\n--- Checking with string match ---");
  const stringPurchases = await db.collection("purchases").find({
    eventId: event._id,
    type: "VOTE",
    status: "PAID"
  }).toArray();

  console.log(`Total PAID vote purchases for this event: ${stringPurchases.length}`);
  stringPurchases.forEach(p => {
    console.log(`  Candidate: ${p.candidateId} | ${p.voteCount} votes | ${p.customerName}`);
  });

  process.exit(0);
}

checkMaxwell().catch(err => { console.error(err); process.exit(1); });
