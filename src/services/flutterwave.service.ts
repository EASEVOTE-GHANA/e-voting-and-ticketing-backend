import axios from "axios";
import crypto from "crypto";
import { AppError } from "../middleware/error.middleware";
import { IPaymentGateway, PaymentInitializationData, PaymentInitializationResult, PaymentVerificationResult, WebhookResult } from "../payment-gateway.interface";

export class FlutterwaveService implements IPaymentGateway {
  private baseURL = "https://api.flutterwave.com/v3";
  private secretKey = process.env.FLUTTERWAVE_SECRET_KEY;

  async initializePayment(data: PaymentInitializationData): Promise<PaymentInitializationResult> {
    try {
      const response = await axios.post(
        `${this.baseURL}/payments`,
        {
          tx_ref: data.reference,
          amount: data.amount,
          currency: "GHS",
          redirect_url: data.callback_url,
          customer: {
            email: data.email,
          },
          customizations: {
            title: "EaseVote Payment",
          },
          meta: data.metadata,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`[FlutterwaveService] Payment initialized successfully. Reference: ${data.reference}, Auth URL: ${response.data.data.link}`);
      return {
        authorization_url: response.data.data.link,
        reference: data.reference,
      };
    } catch (error: any) {
      console.error("[FlutterwaveService] Initialization error:", {
        message: error.message,
        response: error.response?.data,
        reference: data.reference
      });
      throw new AppError("Payment initialization failed", 500);
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResult> {
    try {
      const response = await axios.get(
        `${this.baseURL}/transactions/verify_by_reference?tx_ref=${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );

      const data = response.data.data;
      const isSuccess = data.status === "successful";
      return {
        success: isSuccess,
        status: isSuccess ? "success" : "failed",
        amount: data.amount,
        currency: data.currency,
        reference: data.tx_ref,
      };
    } catch (error: any) {
      console.error("Flutterwave verification error:", error.response?.data);
      throw new AppError("Payment verification failed", 500);
    }
  }

  async handleWebhook(req: any): Promise<WebhookResult> {
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
    const signature = req.headers["verif-hash"];

    if (!signature || signature !== secretHash) {
      return { isValid: false };
    }

    const payload = req.body;
    
    if (payload.event === "charge.completed" && payload.data.status === "successful") {
      return {
        isValid: true,
        reference: payload.data.tx_ref,
        status: "success",
        amount: payload.data.amount
      };
    }

    if (payload.event === "charge.completed" && (payload.data.status === "failed" || payload.data.status === "cancelled")) {
      return {
        isValid: true,
        reference: payload.data.tx_ref,
        status: "failed",
        amount: payload.data.amount
      };
    }

    return { isValid: false };
  }
}