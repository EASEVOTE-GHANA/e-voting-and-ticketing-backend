import mongoose, { Document, Schema } from "mongoose";

export interface IToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  type: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "ADMIN_INVITATION";
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const tokenSchema = new Schema<IToken>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true, unique: true },
  type: { type: String, enum: ["EMAIL_VERIFICATION", "PASSWORD_RESET", "ADMIN_INVITATION"], required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Token = mongoose.model<IToken>("Token", tokenSchema);