import mongoose, { Document, Schema } from "mongoose";

export type GatewayProvider = "paystack" | "appsmobile";
export type GatewayType = "WEB" | "USSD";

export interface IGateway extends Document {
  provider: GatewayProvider;
  type: GatewayType;
  isPrimary: boolean;
  isEnabled: boolean;
  failureCount: number;
  lastFailure?: Date;
  settings: Record<string, any>; // For provider-specific toggles
}

const gatewaySchema = new Schema<IGateway>(
  {
    provider: {
      type: String,
      required: true,
      enum: ["paystack", "appsmobile"],
    },
    type: {
      type: String,
      required: true,
      enum: ["WEB", "USSD"],
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    lastFailure: {
      type: Date,
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one primary per type
gatewaySchema.index({ type: 1, isPrimary: 1 }, { unique: true, partialFilterExpression: { isPrimary: true } });

export const Gateway = mongoose.model<IGateway>("Gateway", gatewaySchema);
