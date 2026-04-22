import dotenv from "dotenv";
dotenv.config();

import { EmailService } from "../src/services/email.service";
import { SMSService } from "../src/services/sms.service";

async function testNotifications() {
  console.log("Testing notifications...");

  const testEmail = "cojjojimmy12@gmail.com"; 
  const testPhone = "+233240000000"; 

  try {
    // 1. Test Ticket Email
    console.log("Sending test ticket email...");
    await EmailService.sendTicketEmail({
      to: testEmail,
      customerName: "Jimmy Test",
      eventTitle: "Grand Annual Concert 2026",
      eventDate: "Friday, May 15, 2026",
      venue: "Accra International Conference Center",
      tickets: [
        {
          ticketNumber: "TK123456789",
          ticketTypeName: "VIP Gold",
          qrData: "TICKET_DATA_MOCK_1"
        },
        {
          ticketNumber: "TK987654321",
          ticketTypeName: "VIP Gold",
          qrData: "TICKET_DATA_MOCK_2"
        }
      ],
      totalAmount: 500.00,
      reference: "TEST_REF_123"
    });
    console.log("Ticket email sent successfully!");

    // 2. Test Vote Email
    console.log("Sending test vote email...");
    await EmailService.sendVoteEmail({
      to: testEmail,
      customerName: "Jimmy Test",
      eventTitle: "Tech Innovator Awards",
      candidateName: "John Doe",
      voteCount: 50,
      totalAmount: 100.00,
      reference: "TEST_REF_456"
    });
    console.log("Vote email sent successfully!");

    // 3. Test SMS
    console.log("Sending test SMS (Mocked if keys are missing)...");
    await SMSService.sendTicketConfirmation(testPhone, "Grand Annual Concert 2026", 2);
    console.log("SMS sent successfully!");

  } catch (error) {
    console.error("Test failed:", error);
  }
}

testNotifications();
