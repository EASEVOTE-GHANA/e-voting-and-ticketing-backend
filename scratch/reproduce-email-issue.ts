import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

import { EmailService } from "../src/services/email.service";

async function reproduceEmailIssue() {
  console.log("🚀 Reproducing Ticket Email Dispatch Issue...");
  
  const targetEmail = "cojjojimmy12@gmail.com";
  const customerName = "Kofi Mensah";
  const eventTitle = "Miss Ghana 2026"; // Mocking event title
  
  const ticketData = [
    {
      ticketNumber: "TK-FA7D7E381E",
      ticketTypeName: "Standard Ticket",
      qrData: "{\"eventId\":\"696623a1b52a946e1dde6ec7\",\"ticketNumber\":\"TK-FA7D7E381E\",\"purchaseId\":\"6a01def173f7bc2d2aa9e9f5\",\"customerEmail\":\"cojjojimmy12@gmail.com\"}"
    }
  ];

  try {
    console.log(`\n🔄 Attempting to send ticket email to ${targetEmail}...`);
    
    const result = await EmailService.sendTicketEmail({
      to: targetEmail,
      customerName: customerName,
      eventTitle: eventTitle,
      eventDate: "Sat Dec 12 2026",
      venue: "Accra International Conference Centre",
      tickets: ticketData,
      totalAmount: 150.00,
      reference: "EV_9AB48AC829FB420C"
    });

    console.log("\n✅ Result:", JSON.stringify(result, null, 2));

  } catch (error: any) {
    console.error("\n❌ Email Dispatch Failed:");
    console.error(error.message);
    if (error.response?.data) {
      console.error("API Response:", JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    process.exit();
  }
}

reproduceEmailIssue();
