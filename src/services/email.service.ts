import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  static async sendVerificationEmail(email: string, token: string) {
    try {

      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

      const emailData = {
        from: process.env.FROM_EMAIL || "noreply@easevote.com",
        to: email,
        subject: "Verify your email address",
        html: `
          <h2>Email Verification</h2>
          <p>Click the link below to verify your email address:</p>
          <a href="${verificationUrl}">Verify Email</a>
          <p>This link expires in 24 hours.</p>
        `
      };

      const result = await resend.emails.send(emailData);

      return result;
    } catch (error) {
      console.error("Failed to send verification email:", error);
      throw error;
    }
  }

  static async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await resend.emails.send({
      from: process.env.FROM_EMAIL || "noreply@easevote.com",
      to: email,
      subject: "Reset your password",
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link expires in 1 hour.</p>
      `
    });
  }

  static async sendAdminInvitationEmail(email: string, token: string) {
    const inviteUrl = `${process.env.FRONTEND_URL}/accept-invitation?token=${token}`;

    await resend.emails.send({
      from: process.env.FROM_EMAIL || "noreply@easevote.com",
      to: email,
      subject: "You've been invited as an Admin",
      html: `
        <h2>Admin Invitation</h2>
        <p>You have been invited to join EaseVote as an Admin.</p>
        <p>Click the link below to accept the invitation and set your password:</p>
        <a href="${inviteUrl}">Accept Invitation</a>
        <p>This link expires in 48 hours.</p>
      `
    });
  }

  static async sendCustomEmail(options: { to: string; subject: string; html: string }) {
    await resend.emails.send({
      from: process.env.FROM_EMAIL || "noreply@easevote.com",
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
  }) {
    const ticketHtml = data.tickets.map(ticket => `
      <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #fff;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p style="margin: 0; color: #666; font-size: 12px; text-transform: uppercase;">Ticket Number</p>
            <p style="margin: 5px 0 15px 0; font-weight: bold; font-size: 18px; color: #333;">${ticket.ticketNumber}</p>
            <p style="margin: 0; color: #666; font-size: 12px; text-transform: uppercase;">Ticket Type</p>
            <p style="margin: 5px 0 0 0; font-weight: bold; color: #f3045d;">${ticket.ticketTypeName}</p>
          </div>
          <div style="text-align: right;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(ticket.qrData)}" alt="QR Code" width="100" height="100" />
          </div>
        </div>
      </div>
    `).join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          .header { background: linear-gradient(to right, #f3045d, #a408ad); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .logo { color: #fff; font-size: 28px; font-weight: bold; text-decoration: none; }
          .content { background: #fff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
          .event-info { border-left: 4px solid #f3045d; padding-left: 15px; margin: 20px 0; }
          .btn { display: inline-block; padding: 12px 24px; background: #f3045d; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="logo">EaseVote</span>
          </div>
          <div class="content">
            <h2 style="color: #333; margin-top: 0;">Your tickets are ready!</h2>
            <p>Hi ${data.customerName || 'there'},</p>
            <p>Thank you for your purchase. Your payment was successful and your tickets for <strong>${data.eventTitle}</strong> are confirmed.</p>
            
            <div class="event-info">
              <p style="margin: 0; font-weight: bold; color: #f3045d;">${data.eventTitle}</p>
              <p style="margin: 5px 0;">📅 ${data.eventDate}</p>
              <p style="margin: 5px 0;">📍 ${data.venue || 'TBA'}</p>
            </div>

            <h3 style="margin-top: 30px; border-bottom: 2px solid #f9f9f9; padding-bottom: 10px;">Your Tickets</h3>
            ${ticketHtml}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #666; font-size: 14px;">Total Paid: <strong>GHS ${data.totalAmount.toFixed(2)}</strong></p>
              <p style="margin: 5px 0; color: #999; font-size: 12px;">Reference: ${data.reference}</p>
            </div>

            <p style="margin-top: 30px;">Please have these QR codes ready at the entrance for scanning.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} EaseVote. All rights reserved.</p>
            <p>If you have any questions, contact us at support@easevote.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: process.env.FROM_EMAIL || "noreply@easevote.com",
      to: data.to,
      subject: `Your Tickets: ${data.eventTitle}`,
      html: html,
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
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          .header { background: linear-gradient(to right, #f3045d, #a408ad); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .logo { color: #fff; font-size: 28px; font-weight: bold; text-decoration: none; }
          .content { background: #fff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
          .vote-card { background: #fdf2f8; border: 1px dashed #f3045d; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .vote-count { font-size: 32px; font-weight: bold; color: #f3045d; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="logo">EaseVote</span>
          </div>
          <div class="content">
            <h2 style="color: #333; margin-top: 0;">Vote Confirmed!</h2>
            <p>Hi ${data.customerName || 'there'},</p>
            <p>Your support has been recorded. Thank you for voting in <strong>${data.eventTitle}</strong>.</p>
            
            <div class="vote-card">
              <p style="margin: 0; color: #666; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">You cast</p>
              <div class="vote-count">${data.voteCount}</div>
              <p style="margin: 0; color: #333; font-weight: bold; font-size: 18px;">Votes for ${data.candidateName}</p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #666; font-size: 14px;">Amount Paid: <strong>GHS ${data.totalAmount.toFixed(2)}</strong></p>
              <p style="margin: 5px 0; color: #999; font-size: 12px;">Reference: ${data.reference}</p>
            </div>

            <p style="margin-top: 30px;">Keep supporting your favorite candidates!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} EaseVote. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: process.env.FROM_EMAIL || "noreply@easevote.com",
      to: data.to,
      subject: `Vote Confirmation: ${data.candidateName}`,
      html: html,
    });
  }
}