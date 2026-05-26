import axios from "axios";
import { AppError } from "../middleware/error.middleware";
import {
  IPaymentGateway,
  PaymentInitializationData,
  PaymentInitializationResult,
  PaymentVerificationResult,
  WebhookResult,
  USSDPaymentInitializationData,
  USSDPaymentInitializationResult
} from "../payment-gateway.interface";

export class MoolreService implements IPaymentGateway {
  private readonly username = process.env.MOOLRE_API_USER || "";
  private readonly pubKey = process.env.MOOLRE_API_PUBKEY || "";
  private readonly accountNumber = process.env.MOOLRE_ACCOUNT_NUMBER || "";

  private get headers() {
    return {
      "X-API-USER": this.username,
      "X-API-PUBKEY": this.pubKey,
      "Content-Type": "application/json"
    };
  }

  async initializePayment(data: PaymentInitializationData): Promise<PaymentInitializationResult> {
    try {
      const payload = {
        type: 1,
        amount: data.amount.toFixed(2),
        email: data.email,
        externalref: data.reference,
        callback: data.callback_url || `${process.env.FRONTEND_URL}/payment/callback`,
        redirect: `${process.env.FRONTEND_URL}/payment/success`,
        reusable: "0",
        currency: "GHS",
        accountnumber: this.accountNumber,
        metadata: data.metadata || {}
      };

      const response = await axios.post(
        "https://api.moolre.com/embed/link",
        payload,
        { headers: this.headers }
      );

      if (response.data.status !== 1) {
        throw new Error(response.data.message || "Failed to generate payment link");
      }

      console.log(`[MoolreService] Payment initialized successfully. Reference: ${data.reference}`);
      return {
        authorization_url: response.data.data.authorization_url,
        reference: response.data.data.reference || data.reference,
      };
    } catch (error: any) {
      console.error("[MoolreService] Initialization error:", {
        message: error.message,
        response: error.response?.data,
        reference: data.reference
      });
      throw new AppError("Payment initialization failed", 500);
    }
  }

  private mapNetworkCode(network: string): string {
    if (!network) return "13"; // Default MTN

    const normalized = network.toUpperCase();
    if (normalized.includes("MTN")) return "13";
    if (normalized.includes("TELECEL") || normalized.includes("VODAFONE") || normalized.includes("VOD")) return "6";
    if (normalized.includes("AT") || normalized.includes("AIRTELTIGO") || normalized.includes("AIRTEL") || normalized.includes("TIGO")) return "7";
    
    return "13"; // Default MTN
  }

  async initializeUSSDPayment(data: USSDPaymentInitializationData): Promise<USSDPaymentInitializationResult> {
    try {
      console.log("[MoolreService] USSD Payment Data:", { network: data.network, phone: data.customerPhone });
      
      const payload = {
        type: 1,
        channel: this.mapNetworkCode(data.network),
        currency: "GHS",
        payer: data.customerPhone,
        amount: data.amount.toFixed(2),
        externalref: data.reference,
        reference: "EaseVote Payment",
        accountnumber: this.accountNumber
      };

      console.log("[MoolreService] USSD Payment Payload:", payload);

      const response = await axios.post(
        "https://api.moolre.com/open/transact/payment",
        payload,
        { headers: this.headers }
      );

      // The exact success response for USSD prompt sent depends on Moolre's status codes (e.g. status === 1 or 200_PAYMENT_REQ).
      // If there's an error, it often returns status: "0" in the body.
      const isSuccess = response.data?.status == 1 || response.data?.status == "1" || response.data?.code?.includes("REQ") || response.data?.code?.includes("SUCCESS");

      console.log(`[MoolreService] USSD Payment initialized. Success: ${isSuccess}, Reference: ${data.reference}, Message: ${response.data.message}`);
      
      return {
        success: isSuccess,
        reference: data.reference,
        message: response.data.message || "Payment prompt initiated"
      };
    } catch (error: any) {
      console.error("[MoolreService] USSD initialization error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        reference: data.reference
      });
      throw new AppError(`USSD payment initiation failed: ${error.message}`, 500);
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResult> {
    try {
      const payload = {
        type: 1,
        idtype: 1, // 1 = Unique externalref
        id: reference,
        accountnumber: this.accountNumber
      };

      const response = await axios.post(
        "https://api.moolre.com/open/transact/status",
        payload,
        { headers: this.headers }
      );

      const data = response.data;
      const isSuccess = data.status == 1 && data.data?.txstatus == 1;
      const isFailed = data.data?.txstatus == 2;

      return {
        success: isSuccess,
        status: isSuccess ? "success" : (isFailed ? "failed" : "pending"),
        amount: parseFloat(data.data?.amount || "0"),
        currency: "GHS",
        reference: reference,
      };
    } catch (error: any) {
      console.error("[MoolreService] Verification error:", error.response?.data || error.message);
      throw new AppError("Payment verification failed", 500);
    }
  }

  async handleWebhook(req: any): Promise<WebhookResult> {
    const body = req.body;

    // Check if it's a Moolre webhook payload
    if (body && body.data && body.data.txstatus !== undefined && body.data.externalref) {
      const txData = body.data;
      const isSuccess = txData.txstatus == 1;
      const isFailed = txData.txstatus == 2;

      return {
        isValid: true,
        reference: txData.externalref,
        status: isSuccess ? "success" : (isFailed ? "failed" : "pending"),
        amount: parseFloat(txData.amount || "0")
      };
    }

    return { isValid: false };
  }
}
