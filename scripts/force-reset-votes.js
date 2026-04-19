const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function forceReset() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const eventsCol = db.collection("events");
  const purchasesCol = db.collection("purchases");

  // Get all voting events
  const events = await eventsCol.find({ type: { $in: ["VOTING", "HYBRID"] } }).toArray();
  let fixed = 0;

  for (const event of events) {
    // Get PAID votes per candidate
    const paidVotes = await purchasesCol.aggregate([
      { $match: { eventId: event._id, type: "VOTE", status: "PAID" } },
      { $group: { _id: "$candidateId", total: { $sum: "$voteCount" } } }
    ]).toArray();

    const votesMap = {};
    paidVotes.forEach(v => { votesMap[v._id?.toString()] = v.total; });

    let needsUpdate = false;
    const fixedCats = event.categories?.map(cat => ({
      ...cat,
      candidates: cat.candidates.map(c => {
        const paid = votesMap[c._id?.toString()] || 0;
        if (c.votes !== paid) {
          console.log(`[FIX] ${event.title} > ${c.name}: ${c.votes} → ${paid}`);
          needsUpdate = true;
        }
        return { ...c, votes: paid };
      })
    }));

    if (needsUpdate && fixedCats) {
      await eventsCol.updateOne(
        { _id: event._id },
        { $set: { categories: fixedCats } }
      );
      fixed++;
    }
  }

  // Verify the fix
  console.log("\n--- Verification ---");
  const verify = await eventsCol.findOne({ eventCode: "A953A6" });
  verify.categories?.forEach(cat => {
    cat.candidates.forEach(c => {
      console.log(`  ${c.name}: ${c.votes} votes`);
    });
  });

  console.log(`\n✅ Done. ${fixed} event(s) fixed.`);
  process.exit(0);
}

forceReset().catch(err => { console.error(err); process.exit(1); });
