import axios from "axios";
import FormData from "form-data";
import { TemplateHelper } from "../utils/template.helper";

const FROM_EMAIL = process.env.FROM_EMAIL_PURE || "noreply@easevotegh.com";
const SENDER_NAME = process.env.SENDER_NAME || "EaseVote";
const CURRENT_YEAR = new Date().getFullYear();

export class EmailService {
  // Using the production API URL provided by the user
  private static readonly NALO_EMAIL_URL = "https://email.nalosolutions.com/smsbackend/clientapi/Resl_Nalo/send-email/";

  private static async sendNaloEmail(options: {
    to: string;
    subject: string;
    html: string;
    attachments?: Array<{ filename: string; content: Buffer }>;
  }) {
    try {
      console.log(`[EmailService] Preparing to send email to ${options.to} via Nalo API...`);
      
      let response;

      if (options.attachments && options.attachments.length > 0) {
        // Use form-data for attachments as per Nalo docs
        const form = new FormData();
        form.append("username", process.env.NALO_USERNAME);
        form.append("password", process.env.NALO_PASSWORD);
        form.append("emailTo[0]", options.to);
        form.append("emailFrom", FROM_EMAIL);
        form.append("senderName", SENDER_NAME);
        form.append("subject", options.subject);
        form.append("emailBody", options.html);
        form.append("callBackUrl", "");

        // As per docs: "attach_file"
        options.attachments.forEach((att, index) => {
           if (index === 0) {
             form.append("attach_file", att.content, {
               filename: att.filename,
               contentType: "application/pdf",
             });
           }
        });

        response = await axios.post(this.NALO_EMAIL_URL, form, {
          headers: {
            ...form.getHeaders(),
          },
        });
      } else {
        // Use JSON for standard emails
        const payload = {
          username: process.env.NALO_USERNAME,
          password: process.env.NALO_PASSWORD,
          emailTo: [options.to],
          emailFrom: FROM_EMAIL,
          senderName: SENDER_NAME,
          subject: options.subject,
          emailBody: options.html,
          callBackUrl: "",
        };

        response = await axios.post(this.NALO_EMAIL_URL, payload, {
          headers: { 
            "Content-Type": "application/json",
          },
        });
      }

      // Success check based on Nalo response structure
      const success = response.data.status === true || response.status === 200;
      if (!success) {
        console.error(`[EmailService] Nalo error for ${options.to}:`, response.data);
      } else {
        console.log(`[EmailService] Email sent to ${options.to}. Job ID: ${response.data.email_job_id}`);
      }

      return {
        data: success ? { id: response.data.email_job_id } : null,
        error: success ? null : { message: response.data.message || "Nalo API failed", code: response.status }
      };
    } catch (error: any) {
      console.error(`[EmailService] Unexpected failure sending email to ${options.to}:`, error.response?.data || error.message);
      throw error;
    }
  }

  static async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    const html = TemplateHelper.render("verification", {
      verificationUrl,
      year: CURRENT_YEAR
    });

    return this.sendNaloEmail({
      to: email,
      subject: "Verify your email address",
      html
    });
  }

  static async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const html = TemplateHelper.render("password-reset", {
      resetUrl,
      year: CURRENT_YEAR
    });

    await this.sendNaloEmail({
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

    await this.sendNaloEmail({
      to: email,
      subject: "You've been invited as an Admin",
      html
    });
  }

  static async sendCustomEmail(options: { to: string; subject: string; html: string }) {
    await this.sendNaloEmail({
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

    return this.sendNaloEmail({
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

    await this.sendNaloEmail({
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

    return this.sendNaloEmail({
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

    return this.sendNaloEmail({
      to: data.to,
      subject: isApproved ? `Nomination Approved: ${data.eventTitle}` : `Nomination Update: ${data.eventTitle}`,
      html: html,
    });
  }
}
