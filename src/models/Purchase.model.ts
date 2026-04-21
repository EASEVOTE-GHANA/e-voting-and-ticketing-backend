import mongoose, { Document, Schema } from "mongoose";

export interface IPurchase extends Document {
  eventId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  type: "TICKET" | "VOTE";
  status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "FAILED";
  source: "web" | "ussd";
  
  // Payment details
  paymentReference: string;
  paymentGateway: "PAYSTACK";
  amount: number;
  currency: string;
  
  // Ticket details
  ticketTypeId?: mongoose.Types.ObjectId;
  ticketQuantity?: number;
  ticketNumbers?: string[];
  
  // Vote details
  candidateId?: mongoose.Types.ObjectId;
  categoryId?: mongoose.Types.ObjectId;
  voteCount?: number;
  
  // Timing
  expiresAt?: Date;
  paidAt?: Date;
  
  // Metadata
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const purchaseSchema = new Schema<IPurchase>({
  eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  type: { type: String, enum: ["TICKET", "VOTE"], required: true },
  status: { type: String, enum: ["PENDING", "PAID", "EXPIRED", "CANCELLED", "FAILED"], default: "PENDING" },
  source: { type: String, enum: ["web", "ussd"], default: "web" },
  
  paymentReference: { type: String, required: true, unique: true },
  paymentGateway: { type: String, enum: ["PAYSTACK"], default: "PAYSTACK" },
  amount: { type: Number, required: true },
  currency: { type: String, default: "GHS" },
  
  ticketTypeId: { type: Schema.Types.ObjectId },
  ticketQuantity: { type: Number },
  ticketNumbers: [{ type: String }],
  
  candidateId: { type: Schema.Types.ObjectId },
  categoryId: { type: Schema.Types.ObjectId },
  voteCount: { type: Number },
  
  expiresAt: { type: Date },
  paidAt: { type: Date },
  
  customerEmail: { type: String, required: true },
  customerName: { type: String },
  customerPhone: { type: String }
}, {
  timestamps: true
});

purchaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
purchaseSchema.index({ paymentReference: 1 });

export const Purchase = mongoose.model<IPurchase>("Purchase", purchaseSchema);