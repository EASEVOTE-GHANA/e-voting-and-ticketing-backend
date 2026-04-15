import axios from "axios";
import crypto from "crypto";
import { AppError } from "../middleware/error.middleware";
import { IPaymentGateway, PaymentInitializationData, PaymentInitializationResult, PaymentVerificationResult, WebhookResult } from "../payment-gateway.interface";

export class PaystackService implements IPaymentGateway {
  private readonly baseURL = "https://api.paystack.co";
  private readonly secretKey = process.env.PAYSTACK_SECRET_KEY;

  async initializePayment(data: PaymentInitializationData): Promise<PaymentInitializationResult> {
    try {
      const response = await axios.post(
        `${this.baseURL}/transaction/initialize`,
        {
          ...data,
          amount: data.amount * 100, // Convert to pesewas
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`[PaystackService] Payment initialized successfully. Reference: ${data.reference}, Auth URL: ${response.data.data.authorization_url}`);
      return response.data.data;
    } catch (error: any) {
      console.error("[PaystackService] Initialization error:", {
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
        `${this.baseURL}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );

      return {
        ...response.data.data,
        metadata: response.data.data.metadata
      };
    } catch (error: any) {
      console.error("Paystack verification error:", error.response?.data);
      throw new AppError("Payment verification failed", 500);
    }
  }

  async handleWebhook(req: any): Promise<WebhookResult> {
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return { isValid: false };
    }

    const event = req.body;
    
    if (event.event === 'charge.success') {
      return { 
        isValid: true, 
        reference: event.data.reference,
        status: 'success',
        amount: (event.data.amount) / 100, // Convert from subunits (pesewas/kobo)
        metadata: event.data.metadata
      };
    }

    if (event.event === 'charge.failed' || event.event === 'charge.abandoned') {
      return { 
        isValid: true, 
        reference: event.data.reference,
        status: 'failed',
        amount: (event.data.amount) / 100,
        metadata: event.data.metadata
      };
    }

    return { isValid: false };
  }
}