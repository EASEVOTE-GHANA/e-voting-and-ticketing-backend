import dotenv from "dotenv";
import path from "path";

// Load environment variables from the root .env file
dotenv.config({ path: path.join(__dirname, "../.env") });

import { EmailService } from "../src/services/email.service";

async function sendTestEmails() {
  const targetEmail = "cojjojimmy12@gmail.com";
  console.log(`Sending test emails to ${targetEmail}...`);

  try {
    // 1. Verification Email
    console.log("- Sending Verification Email...");
    await EmailService.sendVerificationEmail(targetEmail, "test-token-123");

    // 2. Password Reset Email
    console.log("- Sending Password Reset Email...");
    await EmailService.sendPasswordResetEmail(targetEmail, "reset-token-456");

    // 3. Admin Invitation Email
    console.log("- Sending Admin Invitation Email...");
    await EmailService.sendAdminInvitationEmail(targetEmail, "invite-token-789");

    // 4. Ticket Delivery Email
    console.log("- Sending Ticket Email...");
    await EmailService.sendTicketEmail({
      to: targetEmail,
      customerName: "Jimmy Essel",
      eventTitle: "Miss Ghana 2026 Grand Finale",
      eventDate: "Saturday, 21st June 2026",
      venue: "Accra International Conference Centre",
      eventImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800",
      tickets: [
        { ticketNumber: "EV-TKT-001", ticketTypeName: "VIP", qrData: "https://easevotegh.com/tkt/001" },
        { ticketNumber: "EV-TKT-002", ticketTypeName: "VIP", qrData: "https://easevotegh.com/tkt/002" }
      ],
      totalAmount: 200.00,
      reference: "EV_ORD_123456"
    });

    // 5. Vote Confirmation Email
    console.log("- Sending Vote Confirmation Email...");
    await EmailService.sendVoteEmail({
      to: targetEmail,
      customerName: "Jimmy Essel",
      eventTitle: "Tech Innovators Awards",
      candidateName: "Justice Appiah",
      voteCount: 50,
      totalAmount: 50.00,
      reference: "EV_VOTE_987654"
    });

    // 6. Nomination Received Email
    console.log("- Sending Nomination Received Email...");
    await EmailService.sendNominationEmail({
      to: targetEmail,
      nomineeName: "Bright Amoako",
      eventTitle: "Young Entrepreneurs Summit",
      categoryName: "Tech Visionary",
      whatsappLink: "https://chat.whatsapp.com/testlink"
    });

    // 7. Nomination Outcome (Approved)
    console.log("- Sending Nomination Outcome (Approved) Email...");
    await EmailService.sendNominationOutcomeEmail({
      to: targetEmail,
      nomineeName: "Bright Amoako",
      eventTitle: "Young Entrepreneurs Summit",
      categoryName: "Tech Visionary",
      status: "APPROVED",
      candidateCode: "BEV-001",
      whatsappLink: "https://chat.whatsapp.com/testlink"
    });

    // 8. Nomination Outcome (Rejected)
    console.log("- Sending Nomination Outcome (Rejected) Email...");
    await EmailService.sendNominationOutcomeEmail({
      to: targetEmail,
      nomineeName: "Bright Amoako",
      eventTitle: "Young Entrepreneurs Summit",
      categoryName: "Tech Visionary",
      status: "REJECTED"
    });

    console.log("\n✅ All test emails sent successfully!");
  } catch (error) {
    console.error("\n❌ Failed to send test emails:", error);
  }
}

sendTestEmails();
