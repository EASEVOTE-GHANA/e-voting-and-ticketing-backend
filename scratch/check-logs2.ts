import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/easevote";

async function run() {
  await mongoose.connect(MONGO_URI);
  
  const db = mongoose.connection.db;
  if (!db) process.exit(1);

  const collections = await db.collections();
  for (const c of collections) {
    if (c.collectionName !== 'purchases') {
      const regexDocs = await c.find({
        $or: [
          { message: { $regex: 'EV_0D4C6BEAB527DD9D' } },
          { data: { $regex: 'EV_0D4C6BEAB527DD9D' } },
          { 'metadata.reference': 'EV_0D4C6BEAB527DD9D' },
          { 'metadata.externalref': 'EV_0D4C6BEAB527DD9D' },
          { 'data.externalref': 'EV_0D4C6BEAB527DD9D' },
          { 'data.order_id': 'EV_0D4C6BEAB527DD9D' },
          { 'order_id': 'EV_0D4C6BEAB527DD9D' }
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
