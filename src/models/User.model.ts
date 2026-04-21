import { Schema, model, Document } from "mongoose";

export type UserRole = "ORGANIZER" | "ADMIN" | "SUPER_ADMIN";
export type UserStatus = "PENDING" | "ACTIVE" | "DISABLED";

export interface IUser extends Document {
  fullName: string;
  businessName?: string;
  email: string;
  phone?: string;
  avatar?: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt?: Date;
  tokenVersion: number;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  fullName: { type: String, required: true },
  businessName: { type: String },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  avatar: { type: String },

  passwordHash: { type: String, required: true },

  role: {
    type: String,
    enum: ["ORGANIZER", "ADMIN", "SUPER_ADMIN"],
    default: "ORGANIZER"
  },

  status: {
    type: String,
    enum: ["PENDING", "ACTIVE", "DISABLED"],
    default: "PENDING"
  },

  emailVerified: { type: Boolean, default: false },
  lastLoginAt: { type: Date },
  tokenVersion: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date }
}, { timestamps: true });

export const User = model<IUser>("User", UserSchema);
