import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

import { EmailService } from "../src/services/email.service";

async function comprehensiveSenderTest() {
  const targetEmail = "cojjojimmy12@gmail.com";
  
  console.log(`🚀 Comprehensive Sender Verification Test...`);
  console.log(`📧 Sender (Expected): ${process.env.FROM_EMAIL_PURE}`);
  console.log(`📩 Recipient: ${targetEmail}`);

  try {
    // 1. Verification Email
    console.log("\n- Sending Verification Email...");
    await EmailService.sendVerificationEmail(targetEmail, "comp-test-001");

    // 2. Ticket Delivery Email
    console.log("- Sending Ticket Delivery (Order) Email...");
    await EmailService.sendTicketEmail({
      to: targetEmail,
      customerName: "Jimmy Essel",
      eventTitle: "Miss Ghana 2026",
      eventDate: "Saturday, 21st June 2026",
      venue: "Accra International Conference Centre",
      tickets: [
        { ticketNumber: "EV-TKT-COMP", ticketTypeName: "VIP", qrData: "https://easevotegh.com/tkt/comp" }
      ],
      totalAmount: 150.00,
      reference: "ORDER_COMP_TEST"
    });

    console.log("\n✅ Both emails dispatched! Please check the inbox of cojjojimmy12@gmail.com.");
  } catch (error) {
    console.error("\n❌ Test Failed:", error);
  }
}

comprehensiveSenderTest();
