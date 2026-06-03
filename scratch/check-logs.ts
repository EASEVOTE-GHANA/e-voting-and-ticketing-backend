import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/easevote";

async function run() {
  await mongoose.connect(MONGO_URI);
  
  // Try to find any log with the reference
  const logs = await mongoose.connection.db.collection('logs').find({
    $or: [
      { message: { $regex: 'EV_0D4C6BEAB527DD9D' } },
      { 'metadata.reference': 'EV_0D4C6BEAB527DD9D' },
      { message: { $regex: 'EV_46792F7CEACC9E3C' } },
      { 'metadata.reference': 'EV_46792F7CEACC9E3C' }
    ]
  }).toArray();
  
  console.log("Logs found:", JSON.stringify(logs, null, 2));

  // If logs are empty, let's just search all collections for the string
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {
    if (c.collectionName !== 'purchases') {
      const docs = await c.find({
        $text: { $search: "EV_0D4C6BEAB527DD9D EV_46792F7CEACC9E3C" }
      }).toArray().catch(() => []); // text search might fail if no index, fallback to string match
      
      const regexDocs = await c.find({
        $or: [
          { message: { $regex: 'EV_0D4C6BEAB527DD9D' } },
          { data: { $regex: 'EV_0D4C6BEAB527DD9D' } }
        ]
      }).toArray().catch(() => []);
      
      if (regexDocs.length > 0) {
        console.log(`Found in collection ${c.collectionName}:`, JSON.stringify(regexDocs, null, 2));
      }
    }
  }

  process.exit(0);
}
run().catch(console.error);
