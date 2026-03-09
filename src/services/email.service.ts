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
}