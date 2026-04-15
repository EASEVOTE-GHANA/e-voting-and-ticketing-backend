import mongoose, { Document, Schema } from "mongoose";

export type PayoutStatus = "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED";

export interface IPayout extends Document {
  organizerId: mongoose.Types.ObjectId;
  amount: number;
  status: PayoutStatus;
  reference: string;
  paymentDetails: {
    method: "momo" | "bank";
    accountName: string;
    accountNumber: string;
    bankOrNetwork: string; // e.g. "MTN", "Telecel", "GCB Bank"
  };
  adminNotes?: string;
  processedBy?: mongoose.Types.ObjectId; // User ID of Admin who processed it
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const payoutSchema = new Schema<IPayout>({
  organizerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ["PENDING", "PROCESSING", "PAID", "REJECTED", "CANCELLED"], 
    default: "PENDING" 
  },
  reference: { type: String, required: true, unique: true }, // EV-PAY-12345
  paymentDetails: {
    method: { type: String, enum: ["momo", "bank"], required: true },
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    bankOrNetwork: { type: String, required: true }
  },
  adminNotes: { type: String },
  processedBy: { type: Schema.Types.ObjectId, ref: "User" },
  processedAt: { type: Date }
}, {
  timestamps: true
});

// Create indexes for faster queries
payoutSchema.index({ organizerId: 1 });
payoutSchema.index({ status: 1 });
payoutSchema.index({ reference: 1 });

export const Payout = mongoose.model<IPayout>("Payout", payoutSchema);
