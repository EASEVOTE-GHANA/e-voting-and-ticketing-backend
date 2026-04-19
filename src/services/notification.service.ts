import { Notification } from "../models/Notification.model";
import { Schema } from "mongoose";

export class NotificationService {
  /**
   * Create a single notification for a user
   */
  static async create(data: {
    userId: any;
    title: string;
    message: string;
    type?: "BROADCAST" | "SYSTEM" | "PAYOUT" | "EVENT" | "ALERT";
    metadata?: Record<string, any>;
  }) {
    try {
      return await Notification.create({
        ...data,
        type: data.type || "SYSTEM",
      });
    } catch (error) {
      console.error("Failed to create notification:", error);
      // We don't want to crash the main process if a notification fails
      return null;
    }
  }

  /**
   * Bulk create notifications for multiple users
   */
  static async broadcast(data: {
    userIds: any[];
    title: string;
    message: string;
    type?: "BROADCAST" | "SYSTEM" | "PAYOUT" | "EVENT" | "ALERT";
    metadata?: Record<string, any>;
  }) {
    try {
      const records = data.userIds.map((userId) => ({
        userId,
        title: data.title,
        message: data.message,
        type: data.type || "BROADCAST",
        metadata: data.metadata,
      }));

      return await Notification.insertMany(records);
    } catch (error) {
      console.error("Failed to broadcast notifications:", error);
      return [];
    }
  }

  /**
   * Get notifications for a user
   */
  static async getForUser(userId: string, limit = 20) {
    return await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(notificationId: string, userId: string) {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true },
      { new: true }
    );
  }

  /**
   * Mark all notifications for a user as read
   */
  static async markAllAsRead(userId: string) {
    return await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );
  }
}
