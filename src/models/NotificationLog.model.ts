import { Schema, model, Document } from "mongoose";

export interface INotificationLog extends Document {
  senderId: Schema.Types.ObjectId;
  recipientType: "ALL_ORGANIZERS" | "SELECTED_USERS" | "ALL_ADMINS" | "ALL_ADMINS_AND_ORGANIZERS";
  recipientCount: number;
  channels: ("EMAIL" | "SMS")[];
  subject?: string;
  content: string;
  status: "SENT" | "FAILED" | "PARTIAL_FAILED";
  errorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationLogSchema = new Schema<INotificationLog>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipientType: {
      type: String,
      enum: ["ALL_ORGANIZERS", "SELECTED_USERS", "ALL_ADMINS", "ALL_ADMINS_AND_ORGANIZERS"],
      required: true,
    },
    recipientCount: { type: Number, required: true },
    channels: [{ type: String, enum: ["EMAIL", "SMS"] }],
    subject: { type: String },
    content: { type: String, required: true },
    status: {
      type: String,
      enum: ["SENT", "FAILED", "PARTIAL_FAILED"],
      default: "SENT",
    },
    errorDetails: { type: String },
  },
  { timestamps: true }
);

export const NotificationLog = model<INotificationLog>(
  "NotificationLog",
  NotificationLogSchema
);
