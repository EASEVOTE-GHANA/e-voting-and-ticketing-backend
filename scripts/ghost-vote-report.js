const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not found");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected.\n");

    const EventSchema = new mongoose.Schema({}, { strict: false });
    const PurchaseSchema = new mongoose.Schema({}, { strict: false });

    // Use existing names to match DB collections
    const Event = mongoose.models.Event || mongoose.model("Event", EventSchema);
    const Purchase = mongoose.models.Purchase || mongoose.model("Purchase", PurchaseSchema);

    const events = await Event.find({ type: "VOTING", isDeleted: { $ne: true } });
    const report = [];

    for (const event of events) {
      let totalVotes = 0;
      if (event.categories) {
        event.categories.forEach(cat => {
          if (cat.candidates) {
            cat.candidates.forEach(cand => {
              totalVotes += (cand.votes || 0);
            });
          }
        });
      }

      const purchases = await Purchase.aggregate([
        { 
          $match: { 
            eventId: event._id, 
            type: "VOTE", 
            status: "PAID" 
          } 
        },
        { $group: { _id: null, total: { $sum: "$voteCount" } } }
      ]);

      const paidVotes = purchases[0]?.total || 0;
      const diff = totalVotes - paidVotes;

      if (totalVotes > 0 || paidVotes > 0) {
        report.push({
          Title: event.title,
          Code: event.eventCode,
          "Votes in Results": totalVotes,
          "Paid Votes": paidVotes,
          "Ghost Votes": diff,
          Status: diff === 0 ? "✅ MATCH" : (diff > 0 ? "⚠️ MISMATCH" : "❓ OVERPAID")
        });
      }
    }

    if (report.length === 0) {
      console.log("No voting data found.");
    } else {
      console.table(report);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
