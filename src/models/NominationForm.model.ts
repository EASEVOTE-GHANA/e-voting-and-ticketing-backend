import mongoose, { Document, Schema } from "mongoose";

export interface ICustomField {
  question: string;
  type: "text" | "textarea";
  required: boolean;
}

export interface INominationForm extends Document {
  eventId: mongoose.Types.ObjectId;
  customFields: ICustomField[];
  createdAt: Date;
  updatedAt: Date;
}

const nominationFormSchema = new Schema<INominationForm>({
  eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, unique: true },
  customFields: [{
    question: { type: String, required: true },
    type: { type: String, enum: ["text", "textarea"], default: "text" },
    required: { type: Boolean, default: false }
  }]
}, { timestamps: true });

export const NominationForm = mongoose.model<INominationForm>("NominationForm", nominationFormSchema);
