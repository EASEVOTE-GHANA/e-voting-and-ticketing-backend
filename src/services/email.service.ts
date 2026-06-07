import axios from "axios";
import FormData from "form-data";
import { TemplateHelper } from "../utils/template.helper";
import { AppError } from "../middleware/error.middleware";

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
      const fromEmail = process.env.FROM_EMAIL_PURE || "noreply@easevotegh.com";
      const senderName = process.env.SENDER_NAME || "EaseVote Ghana";
      
      // Prevent sending to placeholder/internal emails to save costs
      if (options.to.toLowerCase().endsWith('@easevote.com') || options.to.toLowerCase().endsWith('@easevotegh.com')) {
        console.log(`[EmailService] Skipping placeholder email address to save costs: ${options.to}`);
        return { data: { id: "skipped_placeholder" }, error: null };
      }
      
      console.log(`[EmailService] Preparing to send email to ${options.to} via Nalo API from ${fromEmail}...`);
      
      let response;

      // Nalo documentation specifically uses this User-Agent for multipart requests
      const NALO_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36";

      if (options.attachments && options.attachments.length > 0) {
        // Use form-data for attachments as per Nalo docs
        const form = new FormData();
        form.append("username", process.env.NALO_USERNAME);
        form.append("password", process.env.NALO_PASSWORD);
        form.append("emailTo[0]", options.to);
        form.append("emailFrom", fromEmail);
        form.append("senderName", senderName);
        form.append("subject", options.subject);
        form.append("emailBody", options.html);
        form.append("callBackUrl", "");

        // As per docs: "attach_file"
        // Using indexed keys for multiple attachments
        options.attachments.forEach((att, index) => {
          form.append(`attach_file[${index}]`, att.content, {
            filename: att.filename,
            contentType: "application/pdf",
          });
        });

        response = await axios.post(this.NALO_EMAIL_URL, form, {
          headers: {
            ...form.getHeaders(),
            "User-Agent": NALO_USER_AGENT
          },
        });
      } else {
        // Use JSON for standard emails
        const payload = {
          username: process.env.NALO_USERNAME,
          password: process.env.NALO_PASSWORD,
          emailTo: [options.to],
          emailFrom: fromEmail,
          senderName: senderName,
          subject: options.subject,
          emailBody: options.html,
          callBackUrl: "",
        };

        response = await axios.post(this.NALO_EMAIL_URL, payload, {
          headers: { 
            "Content-Type": "application/json",
            "User-Agent": NALO_USER_AGENT
          },
        });
      }

      // Success check based on Nalo response structure
      // Nalo might return HTTP 200 but have status: false in the JSON body.
      const isApiSuccess = response.data && response.data.status === true;
      const success = isApiSuccess || (response.status === 200 && response.data && !("status" in response.data));
      
      if (!success) {
        console.error(`[EmailService] Nalo error for ${options.to}:`, response.data);
        throw new Error(response.data?.message || "Failed to send email via Nalo API");
      } else {
        console.log(`[EmailService] Email sent to ${options.to}. Job ID: ${response.data.email_job_id}`);
      }

      return {
        data: { id: response.data.email_job_id },
        error: null
      };
    } catch (error: any) {
      console.error(`[EmailService] Unexpected failure sending email to ${options.to}:`, error.response?.data || error.message);
      
      let errMsg = "Failed to send email. The address may be invalid or previously bounced.";
      if (error.response?.data) {
        if (typeof error.response.data.emailTo === 'string') {
          errMsg = error.response.data.emailTo;
        } else if (error.response.data.message) {
          errMsg = error.response.data.message;
        }
      }
      
      throw new AppError(errMsg, 400);
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

  static async sendAccountDeletedEmail(email: string, userName: string) {
    const html = TemplateHelper.render("account-deleted", {
      userName,
      year: CURRENT_YEAR
    });

    await this.sendNaloEmail({
      to: email,
      subject: "Your Account has been Deactivated",
      html
    });
  }

  static async sendAccountRestoredEmail(email: string, userName: string) {
    const loginUrl = `${process.env.FRONTEND_URL}/login`;
    const html = TemplateHelper.render("account-restored", {
      userName,
      loginUrl,
      year: CURRENT_YEAR
    });

    await this.sendNaloEmail({
      to: email,
      subject: "Your Account has been Restored",
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

    // Pre-fetch image to avoid multiple downloads
    let imageBuffer: Buffer | undefined;
    let finalImageUrl = data.eventImage;

    // PDFKit doesn't support WEBP. If it's a Cloudinary URL, convert to JPG
    if (finalImageUrl && finalImageUrl.includes('cloudinary.com') && finalImageUrl.endsWith('.webp')) {
      finalImageUrl = finalImageUrl.replace('.webp', '.jpg');
    }

    if (finalImageUrl && finalImageUrl.startsWith('http')) {
      try {
        const response = await axios.get(finalImageUrl, { 
          responseType: "arraybuffer",
          timeout: 3000
        });
        imageBuffer = Buffer.from(response.data);
      } catch (err) {
        console.error("[EmailService] Failed to pre-fetch event image:", err);
      }
    }

    const pdfBuffer = await PDFService.generateTicketPDF({
      eventTitle: data.eventTitle,
      eventDate: data.eventDate,
      venue: data.venue,
      customerName: data.customerName,
      tickets: data.tickets,
      imageBuffer: imageBuffer
    });

    const attachments = [{
      filename: `Tickets-${data.eventTitle.replace(/\s+/g, '-')}.pdf`,
      content: pdfBuffer
    }];

    return this.sendNaloEmail({
      to: data.to,
      subject: `Your Official Tickets: ${data.eventTitle} - EaseVote Ghana`,
      html,
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
