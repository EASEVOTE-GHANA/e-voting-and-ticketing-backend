import mongoose from "mongoose";
import { Event } from "../src/models/Event.model";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/easevote";

async function deduplicate() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    const events = await Event.find({ type: "VOTING", isDeleted: false });
    console.log(`Found ${events.length} voting events to check.`);

    for (const event of events) {
      console.log(`Checking event: ${event.title} (${event._id})`);
      const originalCategoryCount = event.categories?.length || 0;
      if (!event.categories || originalCategoryCount === 0) continue;

      const categoryMap = new Map<string, any>();
      let hasChanges = false;

      for (const cat of event.categories) {
        const catName = cat.name.trim();
        if (categoryMap.has(catName)) {
          console.log(`  ! Found duplicate category: "${catName}" - Merging...`);
          const existingCat = categoryMap.get(catName);
          hasChanges = true;
          
          // Merge candidates from the duplicate category into the existing one
          for (const cand of cat.candidates) {
            const candName = cand.name.trim();
            const existingCand = existingCat.candidates.find((c: any) => c.name.trim() === candName);
            
            if (existingCand) {
              console.log(`    - Merging candidate votes for "${candName}": ${existingCand.votes || 0} + ${cand.votes || 0}`);
              existingCand.votes = (existingCand.votes || 0) + (cand.votes || 0);
            } else {
              console.log(`    + Adding unique candidate "${candName}" from duplicate category`);
              existingCat.candidates.push(cand);
            }
          }
        } else {
          categoryMap.set(catName, cat);
        }
      }

      // Reconstruct categories array from the map
      const mergedCategories = Array.from(categoryMap.values());

      // Now deduplicate candidates within each merged category
      for (const cat of mergedCategories) {
        const candMap = new Map<string, any>();
        const dedupedCandidates: any[] = [];
        const originalCandCount = cat.candidates.length;

        for (const cand of cat.candidates) {
          const candName = cand.name.trim();
          if (candMap.has(candName)) {
            console.log(`    ! Found duplicate candidate in "${cat.name}": "${candName}" - Merging votes...`);
            const existingCand = candMap.get(candName);
            existingCand.votes = (existingCand.votes || 0) + (cand.votes || 0);
            hasChanges = true;
          } else {
            candMap.set(candName, cand);
            dedupedCandidates.push(cand);
          }
        }
        
        if (dedupedCandidates.length !== originalCandCount) {
          cat.candidates = dedupedCandidates;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        event.categories = mergedCategories;
        event.markModified('categories');
        
        // Recalculate total votes if possible (optional but good for consistency)
        let totalVotes = 0;
        mergedCategories.forEach(c => {
          c.candidates.forEach((cand: any) => {
            totalVotes += (cand.votes || 0);
          });
        });
        
        console.log(`  -> Saving event. Final Categories: ${mergedCategories.length}, Total Calculated Votes: ${totalVotes}`);
        await event.save();
      } else {
        console.log("  - No duplicates found.");
      }
    }

    console.log("\n✅ Deduplication process complete.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Deduplication failed:", error);
    process.exit(1);
  }
}

deduplicate();
