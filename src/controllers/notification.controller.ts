import { Request, Response } from "express";
import { User } from "../models/User.model";
import { NotificationLog } from "../models/NotificationLog.model";
import { NotificationService } from "../services/notification.service";
import { EmailService } from "../services/email.service";
import { SMSService } from "../services/sms.service";
import { asyncHandler } from "../middleware/error.middleware";
import { AppError } from "../middleware/error.middleware";

export const sendManualNotification = asyncHandler(async (req: Request, res: Response) => {
  const { recipientType, selectedUserIds, channels, subject, content } = req.body;
  const senderId = (req as any).user?.id;

  if (!channels || channels.length === 0) {
    throw new AppError("At least one channel (Email or SMS) must be selected", 400);
  }

  if (!content) {
    throw new AppError("Notification content is required", 400);
  }

  let recipients: any[] = [];

  if (recipientType === "ALL_ORGANIZERS") {
    recipients = await User.find({ role: "ORGANIZER", status: "ACTIVE" });
  } else if (recipientType === "ALL_ADMINS") {
    recipients = await User.find({ role: "ADMIN", status: "ACTIVE" });
  } else if (recipientType === "ALL_ADMINS_AND_ORGANIZERS") {
    recipients = await User.find({ role: { $in: ["ADMIN", "ORGANIZER"] }, status: "ACTIVE" });
  } else if (recipientType === "SELECTED_USERS" && selectedUserIds) {
    recipients = await User.find({ _id: { $in: selectedUserIds } });
  }

  if (recipients.length === 0) {
    throw new AppError("No valid recipients found", 404);
  }

  // 1. Create In-App Notifications for all recipients
  await NotificationService.broadcast({
    userIds: recipients.map(r => r._id),
    title: subject || "Update from EaseVote",
    message: content,
    type: "BROADCAST"
  });

  const results = {
    email: { success: 0, failed: 0 },
    sms: { success: 0, failed: 0 }
  };

  // Dispatch external notifications
  for (const recipient of recipients) {
    if (channels.includes("EMAIL") && recipient.email) {
      try {
        await EmailService.sendCustomEmail({
          to: recipient.email,
          subject: subject || "Notification from EaseVote",
          html: `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">
            ${content.replace(/\n/g, '<br/>')}
          </div>`
        });
        results.email.success++;
      } catch (err) {
        console.error(`Failed to send email to ${recipient.email}:`, err);
        results.email.failed++;
      }
    }

    if (channels.includes("SMS") && recipient.phone) {
      try {
        await SMSService.sendCustomMessage(recipient.phone, content);
        results.sms.success++;
      } catch (err) {
        console.error(`Failed to send SMS to ${recipient.phone}:`, err);
        results.sms.failed++;
      }
    }
  }

  // Log the notification session
  const status = (results.email.failed > 0 || results.sms.failed > 0) 
    ? (results.email.success > 0 || results.sms.success > 0 ? "PARTIAL_FAILED" : "FAILED")
    : "SENT";

  await NotificationLog.create({
    senderId,
    recipientType,
    recipientCount: recipients.length,
    channels,
    subject,
    content,
    status,
    errorDetails: status !== "SENT" ? JSON.stringify(results) : undefined
  });

  res.json({
    message: "Notification processing complete",
    results
  });
});

export const getNotificationLogs = asyncHandler(async (req: Request, res: Response) => {
  const logs = await NotificationLog.find()
    .populate("senderId", "fullName email")
    .sort({ createdAt: -1 })
    .limit(50);
  
  res.json(logs);
});

export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const notifications = await NotificationService.getForUser(userId);
  res.json(notifications);
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const result = await NotificationService.markAsRead(req.params.id as string, userId);
  if (!result) {
    throw new AppError("Notification not found", 404);
  }
  res.json(result);
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  await NotificationService.markAllAsRead(userId);
  res.json({ success: true, message: "All notifications marked as read" });
});
