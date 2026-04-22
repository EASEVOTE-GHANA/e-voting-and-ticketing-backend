import { Resend } from "resend";
import { TemplateHelper } from "../utils/template.helper";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@easevotegh.com";
const CURRENT_YEAR = new Date().getFullYear();

export class EmailService {
  static async sendVerificationEmail(email: string, token: string) {
    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

      const html = TemplateHelper.render("verification", {
        verificationUrl,
        year: CURRENT_YEAR
      });

      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Verify your email address",
        html
      });

      return result;
    } catch (error) {
      console.error("Failed to send verification email:", error);
      throw error;
    }
  }

  static async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const html = TemplateHelper.render("password-reset", {
      resetUrl,
      year: CURRENT_YEAR
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset your password",
      html
    });
  }

  static async sendAdminInvitationEmail(email: string, token: string) {
    const inviteUrl = `${process.env.FRONTEND_URL}/accept-invitation?token=${token}`;

    const html = TemplateHelper.render("admin-invitation", {
      inviteUrl,
      year: CURRENT_YEAR
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "You've been invited as an Admin",
      html
    });
  }

  static async sendCustomEmail(options: { to: string; subject: string; html: string }) {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }

  static async sendTicketEmail(data: {
    to: string;
    customerName: string;
    eventTitle: string;
    eventDate: string;
    venue: string;
    tickets: any[];
    totalAmount: number;
    reference: string;
    eventImage?: string;
  }) {
    const { PDFService } = await import("./pdf.service");

    const html = TemplateHelper.render("ticket", {
      customerName: data.customerName || 'Valued Customer',
      eventTitle: data.eventTitle,
      eventDate: data.eventDate,
      venue: data.venue || 'TBA',
      totalAmount: data.totalAmount.toFixed(2),
      reference: data.reference,
      eventImage: data.eventImage || "https://www.easevotegh.com/img/EaseVote_named.png",
      year: CURRENT_YEAR
    });

    // Generate PDFs for each ticket
    const attachments = await Promise.all(
      data.tickets.map(async (ticket, index) => {
        const pdfBuffer = await PDFService.generateTicketPDF({
          eventTitle: data.eventTitle,
          eventDate: data.eventDate,
          venue: data.venue,
          customerName: data.customerName,
          ticketNumber: ticket.ticketNumber,
          ticketTypeName: ticket.ticketTypeName,
          qrData: ticket.qrData,
          eventImage: data.eventImage
        });
        return {
          filename: `Ticket_${ticket.ticketNumber}.pdf`,
          content: pdfBuffer,
        };
      })
    );

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `Your Official Tickets: ${data.eventTitle}`,
      html: html,
      attachments
    });
  }

  static async sendVoteEmail(data: {
    to: string;
    customerName: string;
    eventTitle: string;
    candidateName: string;
    voteCount: number;
    totalAmount: number;
    reference: string;
  }) {
    const html = TemplateHelper.render("vote", {
      customerName: data.customerName || 'Valued Supporter',
      eventTitle: data.eventTitle,
      candidateName: data.candidateName,
      voteCount: data.voteCount,
      totalAmount: data.totalAmount.toFixed(2),
      reference: data.reference,
      year: CURRENT_YEAR
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `Vote Confirmation: ${data.candidateName}`,
      html: html,
    });
  }

  static async sendNominationEmail(data: {
    to: string;
    nomineeName: string;
    eventTitle: string;
    categoryName: string;
    whatsappLink?: string;
  }) {
    const whatsappSection = data.whatsappLink ? `
      <div style="text-align: center; margin-top: 30px;">
        <p style="font-weight: 700; margin-bottom: 20px; color: #171717; font-size: 15px;">Join the official candidates group to stay updated:</p>
        <a href="${data.whatsappLink}" class="button" style="background-color: #25d366;">Join WhatsApp Group</a>
      </div>
    ` : "";

    const html = TemplateHelper.render("nomination-received", {
      nomineeName: data.nomineeName,
      eventTitle: data.eventTitle,
      categoryName: data.categoryName,
      whatsappSection,
      year: CURRENT_YEAR
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `Nomination Received: ${data.eventTitle}`,
      html: html,
    });
  }

  static async sendNominationOutcomeEmail(data: {
    to: string;
    nomineeName: string;
    eventTitle: string;
    categoryName: string;
    status: "APPROVED" | "REJECTED";
    candidateCode?: string;
    whatsappLink?: string;
  }) {
    const isApproved = data.status === "APPROVED";
    const statusTitle = isApproved ? "Nomination Approved" : "Nomination Status Update";
    
    let statusContent = "";
    if (isApproved) {
      statusContent = `
        <p style="font-size: 16px; line-height: 26px; margin: 0 0 20px 0; color: #495057;">Great news! Your nomination for <strong>${data.eventTitle}</strong> has been approved. You are now officially a candidate.</p>
        <div style="background-color: #f8f0f8; border: 1px solid #fbd5eb; border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
          <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: 800; color: #5b0058; text-transform: uppercase; letter-spacing: 1.5px;">YOUR VOTING ID</p>
          <div class="badge" style="margin-bottom: 15px;">${data.candidateCode}</div>
          <p style="margin: 0; color: #495057; font-size: 16px;">Category: <strong>${data.categoryName}</strong></p>
        </div>
        ${data.whatsappLink ? `
          <div style="text-align: center; margin-bottom: 30px;">
            <p style="font-weight: 700; margin-bottom: 15px; color: #171717;">Join the official candidates group:</p>
            <a href="${data.whatsappLink}" class="button" style="background-color: #25d366;">Join WhatsApp Group</a>
          </div>
        ` : ""}
        <p style="font-size: 14px; line-height: 22px; color: #6c757d;">You can now start sharing your code with supporters to receive votes. We wish you the very best in the competition.</p>
      `;
    } else {
      statusContent = `
        <p style="font-size: 16px; line-height: 26px; margin: 0 0 20px 0; color: #495057;">Thank you for your interest in <strong>${data.eventTitle}</strong>.</p>
        <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
          <p style="margin: 0; color: #495057; font-size: 15px; line-height: 1.6;">We regret to inform you that your nomination for the <strong>${data.categoryName}</strong> category was not successful at this time.</p>
        </div>
        <p style="font-size: 14px; line-height: 22px; color: #6c757d;">While this might be disappointing, we appreciate your interest and encourage you to participate in future opportunities on EaseVote.</p>
      `;
    }

    const html = TemplateHelper.render("nomination-outcome", {
      statusTitle,
      nomineeName: data.nomineeName,
      statusContent,
      year: CURRENT_YEAR
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: isApproved ? `Nomination Approved: ${data.eventTitle}` : `Nomination Update: ${data.eventTitle}`,
      html: html,
    });
  }
}
