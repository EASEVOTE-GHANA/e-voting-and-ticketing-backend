import mongoose, { Document, Schema } from "mongoose";

export interface INomination extends Document {
  eventId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  nomineeName: string;
  nomineePhone: string;
  bio?: string;
  photoUrl?: string;
  customFields?: { question: string; answer: string }[];
  nominatorName: string;
  nominatorPhone: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
}

const nominationSchema = new Schema<INomination>({
  eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
  categoryId: { type: Schema.Types.ObjectId, required: true },
  nomineeName: { type: String, required: true },
  nomineePhone: { type: String, required: true },
  bio: { type: String },
  photoUrl: { type: String },
  customFields: [{ question: String, answer: String }],
  nominatorName: { type: String, required: true },
  nominatorPhone: { type: String, required: true },
  status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" }
}, { timestamps: true });

nominationSchema.index({ eventId: 1, categoryId: 1 });
nominationSchema.index({ status: 1 });

export const Nomination = mongoose.model<INomination>("Nomination", nominationSchema);
