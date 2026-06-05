import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), "../easevote/.env") });

async function testEmail() {
  const { EmailService } = await import("../src/services/email.service");
  try {
    console.log("Sending email...");
    await EmailService.sendAccountRestoredEmail("cojjojimmy12@gmail.com", "Jimmy Essel");
    console.log("Success!");
  } catch (err) {
    console.error("Failed:", err);
  }
}

testEmail();
