import mongoose, { Schema, Document } from "mongoose";

export interface IFaq extends Document {
  question: string;
  answer: string;
  category: string;
  status: "DRAFT" | "PUBLISHED";
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const FaqSchema: Schema = new Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    category: { type: String, default: "General" },
    status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "PUBLISHED" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Faq = mongoose.model<IFaq>("Faq", FaqSchema);
