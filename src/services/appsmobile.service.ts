import axios from "axios";
import crypto from "crypto";
import { AppError } from "../middleware/error.middleware";
import { IPaymentGateway, PaymentInitializationData, PaymentInitializationResult, PaymentVerificationResult, WebhookResult, USSDPaymentInitializationData, USSDPaymentInitializationResult } from "../payment-gateway.interface";

export class AppsMobileService implements IPaymentGateway {
  private readonly baseURL = "https://payments.anmgw.com";
  private readonly orchardURL = "https://orchard-api.anmgw.com";
  private readonly clientId = process.env.APPS_MOBILE_CLIENT_ID;
  private readonly clientSecret = process.env.APPS_MOBILE_CLIENT_SECRET;
  private readonly serviceId = process.env.APPS_MOBILE_SERVICE_ID;

  private generateSignature(payload: string): string {
    return crypto.createHmac('sha256', this.clientSecret!).update(payload).digest('hex').toUpperCase();
  }

  private getAuthHeader(payload: string): string {
    const signature = this.generateSignature(payload);
    const authString = `${this.clientId}:${signature}`;
    return `Basic ${Buffer.from(authString).toString('base64')}`;
  }

  async initializePayment(data: PaymentInitializationData): Promise<PaymentInitializationResult> {
    try {
      const payload = {
        amount: data.amount.toFixed(2),
        currency_val: "GHS",
        callback_url: data.callback_url,
        exttrid: data.reference,
        reference: "EaseVote Payment",
        service_id: this.serviceId,
        nickname: "EaseVote",
        landing_page: `${process.env.FRONTEND_URL}/payment/success`,
        ts: new Date().toISOString().replace('T', ' ').substring(0, 19),
        payment_mode: "CRM"
      };

      const payloadString = JSON.stringify(payload);
      
      const response = await axios.post(
        `${this.baseURL}/third_party_request`,
        payload,
        {
          headers: {
            "Authorization": this.getAuthHeader(payloadString),
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`[AppsMobileService] Payment initialized successfully. Reference: ${data.reference}, Auth URL: ${response.data.redirect_url}`);
      return {
        authorization_url: response.data.redirect_url,
        reference: data.reference,
      };
    } catch (error: any) {
      console.error("[AppsMobileService] Initialization error:", {
        message: error.message,
        response: error.response?.data,
        reference: data.reference
      });
      throw new AppError("Payment initialization failed", 500);
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResult> {
    try {
      const payload = {
        exttrid: reference,
        trans_type: "TSC",
        service_id: this.serviceId
      };

      const payloadString = JSON.stringify(payload);
      
      const response = await axios.post(
        `${this.baseURL}/checkTransaction`,
        payload,
        {
          headers: {
            "Authorization": this.getAuthHeader(payloadString),
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data;
      const isSuccess = data.trans_status?.startsWith('000');
      
      return {
        success: isSuccess,
        status: isSuccess ? "success" : "failed",
        amount: 0, // Amount not returned in verification
        currency: "GHS",
        reference: data.trans_ref,
      };
    } catch (error: any) {
      console.error("Apps&Mobile verification error:", error.response?.data);
      throw new AppError("Payment verification failed", 500);
    }
  }

  async handleWebhook(req: any): Promise<WebhookResult> {
    // Apps&Mobile sends callback to callback_url with transaction status
    const data = req.body;
    
    if (data.trans_status) {
      const isSuccess = data.trans_status.startsWith('000');
      
      return {
        isValid: true,
        reference: data.trans_ref,
        status: isSuccess ? "success" : "failed",
        amount: parseFloat(data.trans_amount || data.amount || "0")
      };
    }

    return { isValid: false };
  }

  private mapNetworkCode(network: string): string {
    if (!network) {
      console.log('Network is undefined, defaulting to MTN');
      return 'MTN';
    }
    
    const networkMap: { [key: string]: string } = {
      'MTN': 'MTN',
      'VODAFONE': 'VOD',
      'AIRTELTIGO': 'AIR',
      'AIRTEL': 'AIR',
      'TIGO': 'AIR'
    };
    
    return networkMap[network.toUpperCase()] || 'MTN';
  }

  async initializeUSSDPayment(data: USSDPaymentInitializationData): Promise<USSDPaymentInitializationResult> {
    try {
      console.log('USSD Payment Data:', { network: data.network, phone: data.customerPhone });
      
      const payload = {
        customer_number: data.customerPhone,
        amount: data.amount.toFixed(2),
        exttrid: data.reference,
        reference: "EaseVote Payment",
        nw: this.mapNetworkCode(data.network),
        trans_type: "CTM",
        callback_url: data.callback_url,
        service_id: this.serviceId,
        ts: new Date().toISOString().replace('T', ' ').substring(0, 19),
        nickname: "EaseVote"
      };

      console.log('Payment Payload:', payload);

      const payloadString = JSON.stringify(payload);
      
      const response = await axios.post(
        `${this.orchardURL}/sendRequest`,
        payloadString,
        {
          headers: {
            "Authorization": this.getAuthHeader(payloadString),
            "Content-Type": "application/json",
          },
        }
      );

      const isSuccess = response.data.resp_code === "015";
      
      console.log(`[AppsMobileService] USSD Payment initialized. Success: ${isSuccess}, Reference: ${data.reference}, Message: ${response.data.resp_desc}`);
      return {
        success: isSuccess,
        reference: data.reference,
        message: response.data.resp_desc || "Payment initiated"
      };
    } catch (error: any) {
      console.error("[AppsMobileService] USSD initialization error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        reference: data.reference
      });
      throw new AppError(`USSD payment initiation failed: ${error.message}`, 500);
    }
  }
}