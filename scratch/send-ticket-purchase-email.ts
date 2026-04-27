import dotenv from "dotenv";
import path from "path";

// Load environment variables from the root .env file
dotenv.config({ path: path.join(__dirname, "../.env") });

import { EmailService } from "../src/services/email.service";

async function sendTicketPurchaseEmail() {
  const targetEmail = "cojjojimmy12@gmail.com";
  console.log(`Sending ticket purchase email to ${targetEmail}...`);

  try {
    await EmailService.sendTicketEmail({
      to: targetEmail,
      customerName: "Jimmy Essel",
      eventTitle: "Miss Ghana 2026 Grand Finale",
      eventDate: "Saturday, 21st June 2026",
      venue: "Accra International Conference Centre",
      eventImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800",
      tickets: [
        { ticketNumber: "EV-TKT-1001", ticketTypeName: "VIP", qrData: "https://easevotegh.com/tkt/1001" },
        { ticketNumber: "EV-TKT-1002", ticketTypeName: "Regular", qrData: "https://easevotegh.com/tkt/1002" }
      ],
      totalAmount: 150.00,
      reference: "EV_ORD_TEST_999"
    });

    console.log("\n✅ Ticket purchase email sent successfully!");
  } catch (error) {
    console.error("\n❌ Failed to send ticket purchase email:", error);
  }
}

sendTicketPurchaseEmail();
