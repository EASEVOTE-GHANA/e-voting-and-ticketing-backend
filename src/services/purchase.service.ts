import { Purchase } from "../models/Purchase.model";
import { Event } from "../models/Event.model";
import { Ticket } from "../models/Ticket.model";
import { Settings } from "../models/Settings.model";
import { PaystackService } from "./paystack.service";
import { FlutterwaveService } from "./flutterwave.service";
import { AppError } from "../middleware/error.middleware";
import { PaginationHelper } from "../utils/pagination.util";
import crypto from "crypto";
import { IPurchase } from "../models/Purchase.model";
import { IPaymentGateway } from "../payment-gateway.interface";

interface PaymentVerificationResult {
  success: boolean;
  amount?: number;
  currency?: string;
  reference?: string;
  gatewayData?: any;
}

type PaymentGateway = 'paystack' | 'flutterwave';

export class PurchaseService {
  private static async getDefaultGateway(): Promise<PaymentGateway> {
    const setting = await Settings.findOne({ key: "payment_gateway" });
    return (setting?.value as PaymentGateway) || 'paystack';
  }

  private static getGatewayService(gateway: PaymentGateway): IPaymentGateway {
    switch (gateway) {
      case 'paystack':
        return new PaystackService();
      case 'flutterwave':
        return new FlutterwaveService();
      default:
        return new PaystackService();
    }
  }
  static generateReference(): string {
    return `EV_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  }

  static generateTicketNumber(): string {
    return `TK${Date.now()}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  }

  static async initializeTicketPurchase(data: {
    eventId: string;
    ticketTypeId: string;
    quantity: number;
    customerEmail: string;
    customerName?: string;
    customerPhone?: string;
    userId?: string;
  }) {
    const event = await Event.findById(data.eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.status !== "PUBLISHED" && event.status !== "LIVE") {
      throw new AppError("Event not available for ticket purchase", 400);
    }

    const ticketType = event.ticketTypes?.find(tt => tt._id?.toString() === data.ticketTypeId);
    if (!ticketType) {
      throw new AppError("Ticket type not found", 404);
    }

    // Check availability (total sold + reserved + new quantity)
    const totalUnavailable = (ticketType.sold || 0) + (ticketType.reserved || 0);
    if (totalUnavailable + data.quantity > ticketType.quantity) {
      throw new AppError("Not enough tickets available", 400);
    }

    // Reserve tickets
    ticketType.reserved = (ticketType.reserved || 0) + data.quantity;
    await event.save();

    const amount = ticketType.price * data.quantity;
    const reference = this.generateReference();
    
    // Hold tickets for 30.5 minutes (Paystack URL expires in 30 minutes)
    const expiresAt = new Date(Date.now() + 30.5 * 60 * 1000);

    const purchase = await Purchase.create({
      eventId: data.eventId,
      userId: data.userId,
      type: "TICKET",
      paymentReference: reference,
      amount,
      ticketTypeId: data.ticketTypeId,
      ticketQuantity: data.quantity,
      expiresAt,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      customerPhone: data.customerPhone
    });

    const gateway = await this.getDefaultGateway();
    const gatewayService = this.getGatewayService(gateway);
    
    const paymentData = await gatewayService.initializePayment({
      email: data.customerEmail,
      amount,
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
      metadata: {
        purchaseId: purchase._id,
        eventId: data.eventId,
        type: "TICKET"
      }
    });

    return {
      purchase,
      paymentUrl: paymentData.authorization_url,
      reference
    };
  }

  static async initializeVotePurchase(data: {
    eventId: string;
    candidateId: string;
    categoryId: string;
    voteCount: number;
    customerEmail: string;
    customerName?: string;
    customerPhone?: string;
    userId?: string;
  }) {
    const event = await Event.findById(data.eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.status !== "PUBLISHED" && event.status !== "LIVE") {
      throw new AppError("Event not available for voting", 400);
    }

    // Check voting time window
    const now = new Date();
    if (event.votingStartTime && now < event.votingStartTime) {
      throw new AppError("Voting has not started yet", 400);
    }
    if (event.votingEndTime && now > event.votingEndTime) {
      throw new AppError("Voting has ended", 400);
    }

    if (!event.costPerVote) {
      throw new AppError("Voting not configured for this event", 400);
    }

    // Validate vote limits
    if (event.minVotesPerPurchase && data.voteCount < event.minVotesPerPurchase) {
      throw new AppError(`Minimum ${event.minVotesPerPurchase} votes required`, 400);
    }

    if (event.maxVotesPerPurchase && data.voteCount > event.maxVotesPerPurchase) {
      throw new AppError(`Maximum ${event.maxVotesPerPurchase} votes allowed`, 400);
    }

    const category = event.categories?.find(cat => cat._id?.toString() === data.categoryId);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    const candidate = category.candidates.find(cand => cand._id?.toString() === data.candidateId);
    if (!candidate) {
      throw new AppError("Candidate not found", 404);
    }

    const amount = event.costPerVote * data.voteCount;
    const reference = this.generateReference();
    
    // Hold votes for 30.5 minutes
    const expiresAt = new Date(Date.now() + 30.5 * 60 * 1000);

    const purchase = await Purchase.create({
      eventId: data.eventId,
      userId: data.userId,
      type: "VOTE",
      paymentReference: reference,
      amount,
      candidateId: data.candidateId,
      categoryId: data.categoryId,
      voteCount: data.voteCount,
      expiresAt,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      customerPhone: data.customerPhone
    });

    const gateway = await this.getDefaultGateway();
    const gatewayService = this.getGatewayService(gateway);
    
    const paymentData = await gatewayService.initializePayment({
      email: data.customerEmail,
      amount,
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
      metadata: {
        purchaseId: purchase._id,
        eventId: data.eventId,
        type: "VOTE"
      }
    });

    return {
      purchase,
      paymentUrl: paymentData.authorization_url,
      reference
    };
  }

  static async verifyPayment(reference: string) {
    const purchase = await Purchase.findOne({ paymentReference: reference });
    if (!purchase) {
      throw new AppError("Purchase not found", 404);
    }

    if (purchase.status === "PAID") {
      return { purchase, message: "Payment already verified" };
    }

    const paymentData = await this.verifyWithGateway(reference);
    
    if (!paymentData.success) {
      purchase.status = "FAILED";
      await purchase.save();
      
      // Unreserve tickets for failed verification
      if (purchase.type === "TICKET") {
        await this.unreserveTickets(purchase);
      }
      
      throw new AppError("Payment verification failed", 400);
    }

    purchase.status = "PAID";
    purchase.paidAt = new Date();
    await purchase.save();

    if (purchase.type === "TICKET") {
      await this.generateTickets(purchase);
      await this.moveReservedToSold(purchase);
    } else if (purchase.type === "VOTE") {
      await this.addVotes(purchase);
    }

    return { purchase, paymentData };
  }

  static async verifyWithGateway(reference: string): Promise<PaymentVerificationResult> {
    const gateway = await this.getDefaultGateway();
    const gatewayService = this.getGatewayService(gateway);
    
    const result = await gatewayService.verifyPayment(reference);
    
    // Normalize response to standard format
    return {
      success: result.status === 'success',
      amount: result.amount,
      currency: result.currency,
      reference: result.reference,
      gatewayData: result
    };
  }

  static async generateTickets(purchase: IPurchase) {
    const tickets = [];
    
    for (let i = 0; i < purchase.ticketQuantity!; i++) {
      const ticketNumber = this.generateTicketNumber();
      const qrData = JSON.stringify({
        eventId: purchase.eventId,
        ticketNumber,
        purchaseId: purchase._id,
        customerEmail: purchase.customerEmail
      });

      const ticket = await Ticket.create({
        eventId: purchase.eventId,
        purchaseId: purchase._id,
        ticketTypeId: purchase.ticketTypeId,
        ticketNumber,
        qrData,
        customerEmail: purchase.customerEmail,
        customerName: purchase.customerName,
        customerPhone: purchase.customerPhone
      });

      tickets.push(ticket);
    }

    purchase.ticketNumbers = tickets.map(t => t.ticketNumber);
    await purchase.save();

    return tickets;
  }

  static async addVotes(purchase: IPurchase) {
    const event = await Event.findById(purchase.eventId);
    if (!event) return;

    const category = event.categories?.find(cat => cat._id?.toString() === purchase.categoryId?.toString());
    if (!category) return;

    const candidate = category.candidates.find(cand => cand._id?.toString() === purchase.candidateId?.toString());
    if (!candidate) return;

    candidate.votes = (candidate.votes || 0) + purchase.voteCount!;
    await event.save();
  }

  static async getPurchaseHistory(userId: string, query: any) {
    const { page, limit, skip } = PaginationHelper.getParams(query);
    
    const [purchases, total] = await Promise.all([
      Purchase.find({ userId })
        .populate("eventId", "title type")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Purchase.countDocuments({ userId })
    ]);

    return PaginationHelper.formatResponse(purchases, total, page, limit);
  }

  static async getEventPurchases(eventId: string, organizerId: string, query: any) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== organizerId) {
      throw new AppError("Unauthorized", 403);
    }

    const { page, limit, skip } = PaginationHelper.getParams(query);
    
    const [purchases, total] = await Promise.all([
      Purchase.find({ eventId, status: "PAID" })
        .populate("userId", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Purchase.countDocuments({ eventId, status: "PAID" })
    ]);

    return PaginationHelper.formatResponse(purchases, total, page, limit);
  }

  static async handleWebhook(req: any): Promise<{ success: boolean }> {
    // Detect gateway from headers or use default
    let gateway: PaymentGateway = await this.getDefaultGateway();
    
    // Simple gateway detection based on headers
    if (req.headers['x-paystack-signature']) {
      gateway = 'paystack';
    } else if (req.headers['verif-hash']) {
      gateway = 'flutterwave';
    }
    
    const gatewayService = this.getGatewayService(gateway);
    const webhookResult = await gatewayService.handleWebhook(req);
    
    if (!webhookResult.isValid) {
      return { success: false };
    }

    if (webhookResult.reference) {
      if (webhookResult.status === 'success') {
        console.log('Processing successful payment for reference:', webhookResult.reference);
        await this.processSuccessfulPayment(webhookResult.reference);
      } else {
        console.log('Processing failed payment for reference:', webhookResult.reference);
        await this.processFailedPayment(webhookResult.reference);
      }
    }

    return { success: true };
  }

  static async processSuccessfulPayment(reference: string) {
    const purchase = await Purchase.findOne({ paymentReference: reference });
    
    if (purchase && purchase.status !== "PAID") {
      purchase.status = "PAID";
      purchase.paidAt = new Date();
      await purchase.save();

      if (purchase.type === "TICKET") {
        await this.generateTickets(purchase);
        await this.moveReservedToSold(purchase);
      } else if (purchase.type === "VOTE") {
        await this.addVotes(purchase);
      }
    }
  }

  static async moveReservedToSold(purchase: IPurchase) {
    const event = await Event.findById(purchase.eventId);
    if (!event) return;

    const ticketType = event.ticketTypes?.find(tt => tt._id?.toString() === purchase.ticketTypeId?.toString());
    if (!ticketType) return;

    // Move from reserved to sold
    ticketType.reserved = Math.max(0, (ticketType.reserved || 0) - purchase.ticketQuantity!);
    ticketType.sold = (ticketType.sold || 0) + purchase.ticketQuantity!;
    await event.save();
  }

  static async processFailedPayment(reference: string) {
    const purchase = await Purchase.findOne({ paymentReference: reference });
    
    if (purchase && purchase.status === "PENDING") {
      purchase.status = "FAILED";
      await purchase.save();

      // Unreserve tickets immediately for failed payments
      if (purchase.type === "TICKET") {
        await this.unreserveTickets(purchase);
      }
    }
  }

  static async unreserveTickets(purchase: IPurchase) {
    const event = await Event.findById(purchase.eventId);
    if (!event) return;

    const ticketType = event.ticketTypes?.find(tt => tt._id?.toString() === purchase.ticketTypeId?.toString());
    if (!ticketType) return;

    // Remove reservation
    ticketType.reserved = Math.max(0, (ticketType.reserved || 0) - purchase.ticketQuantity!);
    await event.save();
  }
}