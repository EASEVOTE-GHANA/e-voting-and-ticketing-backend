import { Gateway, GatewayProvider, GatewayType } from "../models/Gateway.model";
import { AppError } from "../middleware/error.middleware";

export class GatewayService {
  /**
   * Initializes default gateways if database is empty.
   */
  static async seedGateways() {
    const count = await Gateway.countDocuments();
    if (count > 0) return;

    const defaults = [
      { provider: "paystack", type: "WEB", isPrimary: true },
      { provider: "appsmobile", type: "WEB", isPrimary: false },
      { provider: "moolre", type: "WEB", isPrimary: false },
      { provider: "nalo", type: "USSD", isPrimary: false },
      { provider: "moolre", type: "USSD", isPrimary: false },
      { provider: "appsmobile", type: "USSD", isPrimary: true },
    ];

    await Gateway.insertMany(defaults);
    console.log("[GatewayService] Default gateways seeded.");
  }

  static async getGateways() {
    return await Gateway.find().sort({ type: 1, isPrimary: -1 });
  }

  /**
   * Switches the primary provider for a specific type (WEB or USSD).
   */
  static async setPrimaryGateway(provider: GatewayProvider, type: GatewayType) {
    const target = await Gateway.findOne({ provider, type });
    if (!target) {
      throw new AppError(`Provider ${provider} not configured for ${type}`, 404);
    }

    // 1. Remove primary status from current
    await Gateway.updateMany({ type }, { isPrimary: false });

    // 2. Set new primary
    target.isPrimary = true;
    target.isEnabled = true; // Ensure it's enabled if it's becoming primary
    await target.save();

    return target;
  }

  /**
   * Track a gateway failure event.
   */
  static async recordFailure(provider: GatewayProvider, type: GatewayType) {
    await Gateway.updateOne(
      { provider, type },
      { 
        $inc: { failureCount: 1 },
        $set: { lastFailure: new Date() }
      }
    );
  }

  /**
   * Reset health stats for a provider.
   */
  static async resetHealth(provider: GatewayProvider, type: GatewayType) {
    await Gateway.updateOne(
      { provider, type },
      { 
        $set: { failureCount: 0, lastFailure: undefined }
      }
    );
  }

  /**
   * Get the provider string for the primary gateway of a type.
   */
  static async getPrimaryProvider(type: GatewayType): Promise<GatewayProvider> {
    const primary = await Gateway.findOne({ type, isPrimary: true });
    return (primary?.provider as GatewayProvider) || (type === "WEB" ? "paystack" : "appsmobile");
  }
}
