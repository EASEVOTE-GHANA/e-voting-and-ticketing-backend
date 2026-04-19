const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function checkVisibility() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const eventsCol = db.collection("events");

  const events = await eventsCol.find({ type: "VOTING" }).toArray();
  console.log(`\nChecking showVoteCount for ${events.length} voting events:\n`);

  events.forEach(e => {
    console.log(`Event: ${e.title} (${e.eventCode})`);
    console.log(`  showVoteCount: ${e.showVoteCount === undefined ? "undefined (default: true)" : e.showVoteCount}`);
    console.log(`  totalPaidVotes: ${e.totalPaidVotes}`);
    console.log(`  Categories: ${e.categories?.length || 0}`);
    e.categories?.forEach(cat => {
      cat.candidates.forEach(c => {
         console.log(`    - ${c.name}: ${c.votes} votes`);
      });
    });
    console.log("------------------------------------------");
  });

  process.exit(0);
}

checkVisibility().catch(err => { console.error(err); process.exit(1); });
