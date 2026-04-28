import { Resend } from "resend";
import { TemplateHelper } from "../utils/template.helper";

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@easevotegh.com";
const CURRENT_YEAR = new Date().getFullYear();

export class EmailService {
  private static _resend: Resend | null = null;

  private static get resend() {
    if (!this._resend) {
      if (!process.env.RESEND_API_KEY) {
        console.warn("[EmailService] RESEND_API_KEY is not defined in environment variables!");
      }
      this._resend = new Resend(process.env.RESEND_API_KEY);
    }
    return this._resend;
  }
  static async sendVerificationEmail(email: string, token: string) {
    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

      const html = TemplateHelper.render("verification", {
        verificationUrl,
        year: CURRENT_YEAR
      });

      console.log(`[EmailService] Sending verification email to ${email}`);
      const result = await EmailService.resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Verify your email address",
        html
      });

      if (result.error) {
        console.error(`[EmailService] Resend error for ${email}:`, result.error);
      } else {
        console.log(`[EmailService] Verification email sent to ${email}. ID: ${result.data?.id}`);
      }

      return result;
    } catch (error) {
      console.error(`[EmailService] Unexpected failure sending verification to ${email}:`, error);
      throw error;
    }
  }

  static async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const html = TemplateHelper.render("password-reset", {
      resetUrl,
      year: CURRENT_YEAR
    });

    await EmailService.resend.emails.send({
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

    await EmailService.resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "You've been invited as an Admin",
      html
    });
  }

  static async sendCustomEmail(options: { to: string; subject: string; html: string }) {
    await EmailService.resend.emails.send({
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
      data.tickets.map(async (ticket) => {
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

    console.log(`[EmailService] Sending ticket email to ${data.to} for reference ${data.reference}`);
    const result = await EmailService.resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `Your Official Tickets: ${data.eventTitle}`,
      html: html,
      attachments
    });

    if (result.error) {
      console.error(`[EmailService] Resend error for ticket email to ${data.to}:`, result.error);
    } else {
      console.log(`[EmailService] Ticket email sent to ${data.to}. ID: ${result.data?.id}`);
    }
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

    await EmailService.resend.emails.send({
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
    const whatsappSection = data.whatsappLink ? TemplateHelper.render("whatsapp-section", {
      whatsappLink: data.whatsappLink
    }) : "";

    const html = TemplateHelper.render("nomination-received", {
      nomineeName: data.nomineeName,
      eventTitle: data.eventTitle,
      categoryName: data.categoryName,
      whatsappSection,
      year: CURRENT_YEAR
    });

    console.log(`[EmailService] Sending nomination confirmation email to ${data.to}`);
    const result = await EmailService.resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `Nomination Received: ${data.eventTitle}`,
      html: html,
    });

    if (result.error) {
      console.error(`[EmailService] Resend error for nomination email to ${data.to}:`, result.error);
    } else {
      console.log(`[EmailService] Nomination email sent to ${data.to}. ID: ${result.data?.id}`);
    }
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
    const templateName = isApproved ? "nomination-approved" : "nomination-rejected";
    
    const whatsappSection = isApproved && data.whatsappLink ? TemplateHelper.render("whatsapp-section", {
      whatsappLink: data.whatsappLink
    }) : "";

    const html = TemplateHelper.render(templateName, {
      nomineeName: data.nomineeName,
      eventTitle: data.eventTitle,
      categoryName: data.categoryName,
      candidateCode: data.candidateCode || "",
      whatsappSection,
      year: CURRENT_YEAR
    });

    console.log(`[EmailService] Sending nomination ${data.status.toLowerCase()} email to ${data.to}`);
    const result = await EmailService.resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: isApproved ? `Nomination Approved: ${data.eventTitle}` : `Nomination Update: ${data.eventTitle}`,
      html: html,
    });

    if (result.error) {
      console.error(`[EmailService] Resend error for nomination outcome email to ${data.to}:`, result.error);
    } else {
      console.log(`[EmailService] Nomination outcome email sent to ${data.to}. ID: ${result.data?.id}`);
    }
  }
}
