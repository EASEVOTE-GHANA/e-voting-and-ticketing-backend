export interface PaymentInitializationData {
  email: string;
  amount: number;
  reference: string;
  callback_url?: string;
  metadata?: any;
}

export interface USSDPaymentInitializationData {
  email: string;
  amount: number;
  reference: string;
  network: string;
  customerPhone: string;
  callback_url?: string;
  metadata?: any;
}

export interface PaymentInitializationResult {
  authorization_url: string;
  reference: string;
}

export interface USSDPaymentInitializationResult {
  success: boolean;
  reference: string;
  message: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  status?: string;
  amount: number;
  currency: string;
  reference: string;
  metadata?: any;
  gatewayData?: any;
}

export interface WebhookResult {
  isValid: boolean;
  reference?: string;
  status?: string;
  amount?: number;
  metadata?: any;
}

export interface IPaymentGateway {
  initializePayment(data: PaymentInitializationData): Promise<PaymentInitializationResult>;
  initializeUSSDPayment?(data: USSDPaymentInitializationData): Promise<USSDPaymentInitializationResult>;
  verifyPayment(reference: string): Promise<PaymentVerificationResult>;
  handleWebhook(req: any): Promise<WebhookResult>;
}

export interface IPaymentGatewayStatic {
  initializePayment(data: PaymentInitializationData): Promise<PaymentInitializationResult>;
  verifyPayment(reference: string): Promise<PaymentVerificationResult>;
  handleWebhook(req: any): Promise<WebhookResult>;
}