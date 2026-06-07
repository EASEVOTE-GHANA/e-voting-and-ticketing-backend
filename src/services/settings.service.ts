import { Settings } from "../models/Settings.model";
import { AppError } from "../middleware/error.middleware";

export class SettingsService {
  static async updateSetting(key: string, value: string, updatedBy: string) {
    const validKeys = [
      "payment_gateway",
      "ussd_provider", 
      "ussd_payment_gateway"
    ];

    if (!validKeys.includes(key)) {
      throw new AppError("Invalid setting key", 400);
    }

    // Validate values based on key
    if (key === "payment_gateway" && !["paystack", "flutterwave", "appsmobile"].includes(value)) {
      throw new AppError("Invalid payment gateway", 400);
    }

    if (key === "ussd_provider" && !["nalo"].includes(value)) {
      throw new AppError("Invalid USSD provider", 400);
    }

    if (key === "ussd_payment_gateway" && !["paystack", "flutterwave", "appsmobile"].includes(value)) {
      throw new AppError("Invalid USSD payment gateway", 400);
    }

    const setting = await Settings.findOneAndUpdate(
      { key },
      { value, updatedBy },
      { upsert: true, returnDocument: 'after' }
    );

    return setting;
  }

  static async getSetting(key: string) {
    const setting = await Settings.findOne({ key });
    return setting?.value || null;
  }

  static async getAllSettings() {
    const settings = await Settings.find({}).populate("updatedBy", "fullName email");
    return settings;
  }
}