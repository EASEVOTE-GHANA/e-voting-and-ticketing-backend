import mongoose, { Document, Schema } from "mongoose";

export interface ICustomField {
  question: string;
  type: "text" | "textarea" | "number" | "email" | "phone" | "select" | "multi_select" | "checkbox" | "url";
  required: boolean;
  options?: string[];
  order?: number;
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
    type: { 
      type: String, 
      enum: ["text", "textarea", "number", "email", "phone", "select", "multi_select", "checkbox", "url"], 
      default: "text" 
    },
    required: { type: Boolean, default: false },
    options: [String],
    order: { type: Number, default: 0 }
  }]
}, { timestamps: true });

export const NominationForm = mongoose.model<INominationForm>("NominationForm", nominationFormSchema);
