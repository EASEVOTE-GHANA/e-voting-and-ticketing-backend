import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), "../easevote/.env") });

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/easevote";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const result = await db.collection("users").updateOne(
    { email: "cojjojimmy12@gmail.com" },
    { $set: { status: "PENDING" } }
  );
  console.log("Updated:", result.modifiedCount);
  process.exit(0);
}

main().catch(console.error);
