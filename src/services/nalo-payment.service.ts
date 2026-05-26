import axios from "axios";
import { AppError } from "../middleware/error.middleware";
import { IPaymentGateway, PaymentInitializationData, PaymentInitializationResult, PaymentVerificationResult, WebhookResult } from "../payment-gateway.interface";
import crypto from "crypto";

export class NaloPaymentService implements IPaymentGateway {
  private readonly baseURL = process.env.NALO_PAYMENT_BASE_URL || "https://api.nalopay.com";
  private readonly merchantId = process.env.NALOPAY_MERCHANT_ID;
  private readonly secretKey = process.env.NALOPAY_SECRET_KEY || process.env.NALOPAY_AUTH_KEY?.replace("Basic ", "").trim();
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  private async getAuthToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    const basicAuth = process.env.NALOPAY_BASIC_AUTH || process.env.NALOPAY_AUTH_KEY;
    if (!basicAuth || !this.merchantId) {
      throw new AppError("Nalo payment gateway requires NALOPAY_AUTH_KEY and NALOPAY_MERCHANT_ID in .env", 500);
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/clientapi/generate-payment-token/`,
        { merchant_id: this.merchantId },
        {
          headers: {
            "Authorization": basicAuth.startsWith("Basic ") ? basicAuth : `Basic ${basicAuth}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (response.data?.success && response.data?.data?.token) {
        this.cachedToken = response.data.data.token;
        // Default to 15 mins (900000ms) cache just to be safe, unless we decode the JWT
        this.tokenExpiry = Date.now() + 15 * 60 * 1000; 
        return this.cachedToken as string;
      }
      throw new Error("Failed to generate token from Nalo");
    } catch (error: any) {
      console.error("[NaloPaymentService] Token generation error:", error.response?.data || error.message);
      throw new AppError("Could not authenticate with Nalo payment gateway", 500);
    }
  }

  async initializePayment(data: PaymentInitializationData): Promise<PaymentInitializationResult> {
    throw new AppError("Nalo payment gateway is specifically configured for USSD payments only, not WEB.", 400);
  }

  async initializeUSSDPayment(data: import("../payment-gateway.interface").USSDPaymentInitializationData): Promise<import("../payment-gateway.interface").USSDPaymentInitializationResult> {
    try {
      if (!this.merchantId || !this.secretKey) {
        throw new AppError("Nalo payment gateway is not properly configured. Check NALOPAY_SECRET_KEY.", 500);
      }
      
      const token = await this.getAuthToken();

      // Concatenate fields: merchant_id + account_number + amount + reference
      // Nalo documentation example shows 50.00 for an amount of 50, requiring 2 decimal places in the hash.
      const formattedAmount = data.amount.toFixed(2);
      const message = `${this.merchantId}${data.customerPhone}${formattedAmount}${data.reference}`;
      
      // Compute HMAC-SHA256 of the message using merchant_secret_key (which Nalo confirmed is the raw Auth Key)
      const transHash = crypto.createHmac("sha256", this.secretKey as string).update(message).digest("hex");

      const response = await axios.post(
        `${this.baseURL}/clientapi/collection/`,
        {
          merchant_id: this.merchantId,
          service_name: "MOMO_TRANSACTION",
          trans_hash: transHash,
          account_number: data.customerPhone,
          account_name: data.metadata?.customerName || "Voter",
          network: data.network,
          amount: data.amount,
          reference: data.reference,
          callback: data.callback_url,
          isussd: 1, // Legacy flag to attempt forcing an STK prompt instead of SMS
          extra_data: {
            ...data.metadata,
            reference: data.reference // Pass reference to retrieve in webhook
          }
        },
        {
          headers: {
            "token": token,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to initialize Nalo USSD payment");
      }

      console.log(`[NaloPaymentService] USSD Payment initialized. Reference: ${data.reference}, Nalo Order ID: ${response.data.data?.order_id}`);
      
      return {
        success: true,
        reference: data.reference,
        message: "Payment initiated successfully. Please check your phone for the prompt."
      };
    } catch (error: any) {
      console.error("[NaloPaymentService] USSD Initialization error:", {
        message: error.message,
        response: error.response?.data,
        reference: data.reference
      });
      return {
        success: false,
        reference: data.reference,
        message: "Failed to initialize payment prompt on your phone."
      };
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResult> {
    try {
      if (!this.merchantId) {
        throw new AppError("Nalo payment gateway is not properly configured", 500);
      }
      
      const token = await this.getAuthToken();

      const response = await axios.post(
        `${this.baseURL}/clientapi/collection-status/`,
        {
          merchant_id: this.merchantId,
          order_id: reference
        },
        {
          headers: {
            "Content-Type": "application/json",
            // Assuming token might be needed here too, although documentation didn't explicitly say
            "token": token
          }
        }
      );

      const isSuccess = response.data.success && (response.data.data?.status?.toUpperCase() === "SUCCESS" || response.data.data?.status?.toUpperCase() === "COMPLETED");

      // Nalo Verify doesn't seem to return metadata, so we will return minimal info
      // and let the reconciler handle it.
      return {
        success: isSuccess,
        status: response.data.data?.status || "UNKNOWN",
        amount: response.data.data?.amount || 0,
        currency: "GHS",
        reference: reference,
        gatewayData: response.data
      };
    } catch (error: any) {
      console.error("Nalo verification error:", error.response?.data || error.message);
      throw new AppError("Payment verification failed", 500);
    }
  }

  async handleWebhook(req: any): Promise<WebhookResult> {
    // Currently no details on Nalo webhook implementation.
    // Making an educated guess based on standard webhooks.
    const body = req.body;
    
    // Check if the payload looks like a Nalo payload
    if (body && body.order_id && body.status) {
      const isSuccess = body.status?.toUpperCase() === "SUCCESS" || body.status?.toUpperCase() === "COMPLETED";
      return {
        isValid: true,
        // If extra_data.reference exists, it's from our collection API request, otherwise fallback to order_id
        reference: body.extra_data?.reference || body.order_id,
        status: isSuccess ? "success" : "failed",
        amount: parseFloat(body.amount),
        // Optional metadata if Nalo returns it
        metadata: body.extra_data || body.metadata 
      };
    }

    return { isValid: false };
  }
}
