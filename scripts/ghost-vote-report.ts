import mongoose from "mongoose";
import { Event } from "../src/models/Event.model";
import { Purchase } from "../src/models/Purchase.model";
import dotenv from "dotenv";
import path from "path";

// Load env from the parent directory of a script usually
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;

async function generateReport() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not found in environment variables.");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.\n");

    const events = await Event.find({ type: "VOTING", isDeleted: false });
    
    const reportData = [];

    for (const event of events) {
      // 1. Calculate votes reported in event candidates
      let votesInResults = 0;
      event.categories?.forEach(cat => {
        cat.candidates.forEach(cand => {
          votesInResults += (cand.votes || 0);
        });
      });

      // 2. Calculate votes verified in PAID purchases
      const purchaseStats = await Purchase.aggregate([
        { 
          $match: { 
            eventId: event._id, 
            type: "VOTE", 
            status: "PAID" 
          } 
        },
        { $group: { _id: null, total: { $sum: "$voteCount" } } }
      ]);

      const paidVotes = purchaseStats[0]?.total || 0;
      const difference = votesInResults - paidVotes;

      if (votesInResults > 0 || paidVotes > 0) {
        reportData.push({
          title: event.title,
          eventCode: event.eventCode,
          resultsVotes: votesInResults,
          verifiedPaidVotes: paidVotes,
          ghostVotes: difference,
          status: difference === 0 ? "✅ MATCH" : (difference > 0 ? "⚠️ UNPAID VOTES FOUND" : "❓ EXTRA PAYMENTS")
        });
      }
    }

    if (reportData.length === 0) {
      console.log("No voting data found.");
    } else {
      console.table(reportData);
    }

    process.exit(0);
  } catch (error) {
    console.error("Report generation failed:", error);
    process.exit(1);
  }
}

generateReport();
