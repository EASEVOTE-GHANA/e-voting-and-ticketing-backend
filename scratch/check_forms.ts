import mongoose from "mongoose";
import dotenv from "dotenv";
import { NominationForm } from "../src/models/NominationForm.model";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log("Connected to MongoDB");
  
  const forms = await NominationForm.find({});
  console.log(`Found ${forms.length} forms`);
  
  let needsUpdateCount = 0;
  for (const form of forms) {
    const hasEmail = form.customFields?.find(f => f.type === 'email' || f.question.toLowerCase().includes('email'));
    if (hasEmail && hasEmail.required) {
      console.log(`Form for event ${form.eventId} has REQUIRED email field:`, hasEmail);
      needsUpdateCount++;
    }
  }
  console.log(`Total forms needing update: ${needsUpdateCount}`);
  
  await mongoose.disconnect();
}

run().catch(console.error);
