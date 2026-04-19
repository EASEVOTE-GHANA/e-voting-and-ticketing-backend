const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function checkEvent() {
  await mongoose.connect(process.env.MONGO_URI);

  const EventSchema = new mongoose.Schema({}, { strict: false });
  const PurchaseSchema = new mongoose.Schema({}, { strict: false });
  const Event = mongoose.models.Event || mongoose.model("Event", EventSchema);
  const Purchase = mongoose.models.Purchase || mongoose.model("Purchase", PurchaseSchema);

  // Find the event by code
  const event = await Event.findOne({ eventCode: "A953A6" });
  if (!event) { console.log("Event not found"); process.exit(1); }

  console.log(`\n=== EVENT: ${event.title} (${event.eventCode}) ===`);
  console.log(`Verified totalRevenue: GHS ${event.totalRevenue || 0}`);
  console.log(`Verified totalPaidVotes: ${event.totalPaidVotes || 0}`);
  console.log("");

  // Show what candidate.votes says (this is what the public page displays)
  console.log("--- What the PUBLIC page shows (candidate.votes from Event model) ---");
  event.categories?.forEach(cat => {
    console.log(`\nCategory: ${cat.name}`);
    cat.candidates.forEach(c => {
      console.log(`  ${c.name}: ${c.votes || 0} votes (code: ${c.code})`);
    });
  });

  // Now check actual PAID purchases
  console.log("\n--- What is ACTUALLY PAID (from Purchase collection) ---");
  const paidPurchases = await Purchase.find({
    eventId: event._id,
    type: "VOTE",
    status: "PAID"
  });

  if (paidPurchases.length === 0) {
    console.log("  NO PAID PURCHASES FOUND for this event!");
  } else {
    const votesByCandidateId = {};
    paidPurchases.forEach(p => {
      const cid = p.candidateId?.toString();
      votesByCandidateId[cid] = (votesByCandidateId[cid] || 0) + (p.voteCount || 0);
    });

    event.categories?.forEach(cat => {
      cat.candidates.forEach(c => {
        const cid = c._id?.toString();
        const paidVotes = votesByCandidateId[cid] || 0;
        const displayedVotes = c.votes || 0;
        const ghostVotes = displayedVotes - paidVotes;
        console.log(`  ${c.name}: ${paidVotes} PAID votes | ${displayedVotes} displayed | ${ghostVotes > 0 ? "⚠️ " + ghostVotes + " GHOST VOTES" : "✅ CLEAN"}`);
      });
    });
  }

  // Show ALL purchases (paid and unpaid)
  console.log("\n--- All purchase records for this event ---");
  const allPurchases = await Purchase.find({ eventId: event._id, type: "VOTE" }).sort({ createdAt: -1 });
  allPurchases.forEach(p => {
    console.log(`  [${p.status}] ${p.voteCount} votes | GHS ${p.amount} | ${p.customerName || "N/A"} | ${new Date(p.createdAt).toLocaleString()} | Candidate: ${p.candidateId}`);
  });

  process.exit(0);
}

checkEvent();
