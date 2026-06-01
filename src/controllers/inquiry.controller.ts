import { Request, Response } from "express";
import { EmailService } from "../services/email.service";
import { SMSService } from "../services/sms.service";
import { asyncHandler, AppError } from "../middleware/error.middleware";

export const submitInquiry = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, email, subject, message } = req.body;

  if (!firstName || !lastName || !email || !subject || !message) {
    throw new AppError("All fields are required (firstName, lastName, email, subject, message)", 400);
  }

  // 1. Send Email to info@easevotegh.com
  const emailHtml = `
    <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
      <h2>New Public Inquiry</h2>
      <p><strong>From:</strong> ${firstName} ${lastName} (${email})</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">${message}</p>
    </div>
  `;

  try {
    await EmailService.sendCustomEmail({
      to: "info@easevotegh.com",
      subject: `New Inquiry: ${subject}`,
      html: emailHtml
    });
  } catch (err) {
    console.error("Failed to send inquiry email:", err);
    throw new AppError("Failed to send inquiry email", 500);
  }

  // 2. Send SMS alerts to team members
  const teamNumbers = ["+233554440813", "+233559540992"];
  const smsMessage = `EaseVote Alert: A new public inquiry has been submitted by ${firstName} ${lastName}. Please check info@easevotegh.com for details.`;

  for (const phone of teamNumbers) {
    try {
      await SMSService.sendCustomMessage(phone, smsMessage);
    } catch (err) {
      console.error(`Failed to send inquiry SMS alert to ${phone}:`, err);
      // We don't throw an error here to prevent failing the whole request just because SMS failed
    }
  }

  res.status(200).json({
    success: true,
    message: "Your message has been sent successfully. Our team will get back to you shortly."
  });
});
