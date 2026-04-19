const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function fixVisibility() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const eventsCol = db.collection("events");

  console.log("Setting showVoteCount and liveResults to true for all voting/hybrid events...");

  const result = await eventsCol.updateMany(
    { 
      type: { $in: ["VOTING", "HYBRID"] },
      isDeleted: { $ne: true }
    },
    { 
      $set: { 
        showVoteCount: true,
        liveResults: true
      } 
    }
  );

  console.log(`Matched ${result.matchedCount} events, updated ${result.modifiedCount} events.`);
  
  process.exit(0);
}

fixVisibility().catch(err => { console.error(err); process.exit(1); });
