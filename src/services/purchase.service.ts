import { Purchase } from "../models/Purchase.model";
import { Event } from "../models/Event.model";
import { ITicket, Ticket } from "../models/Ticket.model";
import { Settings } from "../models/Settings.model";
import { PaystackService } from "./paystack.service";
import { AppsMobileService } from "./appsmobile.service";
import { MoolreService } from "./moolre.service";
import { NaloPaymentService } from "./nalo-payment.service";
import { AppError } from "../middleware/error.middleware";
import { PaginationHelper } from "../utils/pagination.util";
import { GatewayService } from "./gateway.service";
import { NotificationService } from "./notification.service";
import { EmailService } from "./email.service";
import { SMSService } from "./sms.service";
import crypto from "crypto";
import { IPurchase } from "../models/Purchase.model";
import { IPaymentGateway, PaymentVerificationResult } from "../payment-gateway.interface";
import mongoose, { HydratedDocument } from "mongoose";

type PaymentGateway = 'paystack' | 'appsmobile' | 'moolre' | 'nalo';

export class PurchaseService {
  private static async getDefaultGateway(): Promise<PaymentGateway> {
    return await GatewayService.getPrimaryProvider("WEB");
  }

  private static getGatewayService(gateway: PaymentGateway): IPaymentGateway {
    switch (gateway) {
      case 'paystack':
        return new PaystackService();
      case 'appsmobile':
        return new AppsMobileService();
      case 'moolre':
        return new MoolreService();
      case 'nalo':
        return new NaloPaymentService();
      default:
        return new PaystackService();
    }
  }
  static generateReference(): string {
    return `EV_${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  }

  static generateTicketNumber(): string {
    return `TK-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  }
  
  /**
   * Comprehensive check for event availability for payments/voting
   */
  public static async validateEventAvailability(eventOrId: any, type: 'VOTING' | 'TICKETING') {
    const event = typeof eventOrId === 'string' ? await Event.findById(eventOrId) : eventOrId;

    if (!event) {
      throw new AppError("Event not found", 404);
    }
    
    if (event.isDeleted) {
      throw new AppError("Event has been removed", 410);
    }

    if (event.status === "SUSPENDED") {
      throw new AppError("Event is currently suspended. Payments are not allowed.", 403);
    }

    if (event.status === "PAUSED") {
      throw new AppError("Event is currently paused. Please try again later.", 403);
    }

    if (event.status === "CANCELLED") {
      throw new AppError("Event has been cancelled", 400);
    }

    if (event.status === "ENDED") {
      throw new AppError("Event has already ended", 400);
    }

    // Only APPROVED, PUBLISHED, LIVE, and NOMINATING (for some cases) allowed generally
    // But for payments, we strictly need PUBLISHED or LIVE
    const allowedStatuses = ["PUBLISHED", "LIVE"];
    if (!allowedStatuses.includes(event.status)) {
      throw new AppError(`Event is not open for ${type === 'TICKETING' ? 'ticket purchases' : 'voting'} at this time`, 400);
    }

    return event;
  }

  static async initializeTicketPurchase(data: any) {
    console.log(`[PurchaseService] initializeTicketPurchase called with:`, JSON.stringify(data, null, 2));
    const event = await this.validateEventAvailability(data.eventId, 'TICKETING');


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

    const resolvedEmail = data.customerEmail || `${event.eventCode}@easevote.com`;

    const gateway = await this.getDefaultGateway();
    const gatewayService = this.getGatewayService(gateway);

    const purchase = await Purchase.create({
      eventId: data.eventId,
      userId: data.userId,
      type: "TICKET",
      source: "web",
      paymentReference: reference,
      amount,
      ticketTypeId: data.ticketTypeId,
      ticketQuantity: data.quantity,
      expiresAt,
      customerEmail: resolvedEmail,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      paymentGateway: gateway.toUpperCase()
    });
    
    console.log(`[PurchaseService] Initializing ticket purchase for ${resolvedEmail}. Event: ${data.eventId}, Amount: ${amount}, Reference: ${reference}, Gateway: ${gateway}`);
    
    const paymentData = await gatewayService.initializePayment({
      email: resolvedEmail,
      amount,
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
      metadata: {
        purchaseId: purchase._id,
        eventId: data.eventId,
        type: "TICKET",
        ticketTypeId: data.ticketTypeId,
        quantity: data.quantity,
        customerEmail: resolvedEmail,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        userId: data.userId
      }
    });

    return {
      purchase,
      paymentUrl: paymentData.authorization_url,
      reference
    };
  }

  static async initializeVotePurchase(data: any) {
    console.log(`[PurchaseService] initializeVotePurchase called with:`, JSON.stringify(data, null, 2));
    const event = await this.validateEventAvailability(data.eventId, 'VOTING');

    // Check voting time window
    const now = new Date();
    const votingStart = event.votingStartTime || event.startDate;
    const votingEnd = event.votingEndTime || event.endDate;

    if (votingStart && now < votingStart) {
      throw new AppError("Voting has not started yet", 400);
    }
    if (votingEnd && now > votingEnd) {
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

    const resolvedEmail = data.customerEmail || `${event.eventCode}@easevote.com`;

    const gateway = await this.getDefaultGateway();
    const gatewayService = this.getGatewayService(gateway);

    const purchase = await Purchase.create({
      eventId: data.eventId,
      userId: data.userId,
      type: "VOTE",
      source: "web",
      paymentReference: reference,
      amount,
      candidateId: data.candidateId,
      categoryId: data.categoryId,
      voteCount: data.voteCount,
      expiresAt,
      customerEmail: resolvedEmail,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      paymentGateway: gateway.toUpperCase()
    });
    
    console.log(`[PurchaseService] Initializing vote purchase for ${resolvedEmail}. Event: ${data.eventId}, Amount: ${amount}, Reference: ${reference}, Gateway: ${gateway}`);
    
    const paymentData = await gatewayService.initializePayment({
      email: resolvedEmail,
      amount,
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
      metadata: {
        purchaseId: purchase._id,
        eventId: data.eventId,
        eventTitle: event.title,
        eventCode: event.eventCode,
        type: "VOTE",
        candidateId: data.candidateId,
        candidateName: candidate.name,
        categoryId: data.categoryId,
        voteCount: data.voteCount,
        quantity: data.voteCount, // Alias for frontend compatibility
        customerEmail: resolvedEmail,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        userId: data.userId
      }
    });

    return {
      purchase,
      paymentUrl: paymentData.authorization_url,
      reference
    };
  }

  static async verifyPayment(reference: string) {
    const paymentData = await this.verifyWithGateway(reference);
    
    // Reconcile/Find the purchase record using metadata if necessary
    const purchase = await this.reconcilePurchase(reference, paymentData.metadata, paymentData.amount || 0);

    // Robust Fallback: Enrich the response with event and candidate details 
    // This allows the success page to show names even if metadata is missing.
    const event = await Event.findById(purchase.eventId);
    let extraDetails: any = {};
    
    if (event) {
      extraDetails.eventTitle = event.title;
      extraDetails.eventCode = event.eventCode;
      
      if (purchase.type === "VOTE" && purchase.candidateId) {
        const category = event.categories?.find(cat => cat._id?.toString() === purchase.categoryId?.toString());
        const candidate = category?.candidates.find(cand => cand._id?.toString() === purchase.candidateId?.toString());
        if (candidate) {
          extraDetails.candidateName = candidate.name;
        }
      }
    }

    if (purchase.status === "PAID") {
      return { 
        purchase, 
        message: "Payment already verified",
        ...extraDetails
      };
    }
    
    if (!paymentData.success) {
      purchase.status = "FAILED";
      await purchase.save();
      
      // Unreserve tickets for failed verification
      if (purchase.type === "TICKET") {
        await this.unreserveTickets(purchase);
      }
      
      throw new AppError("Payment verification failed", 400);
    }

    if (paymentData.customerPhone) {
      purchase.customerPhone = paymentData.customerPhone;
    }

    purchase.status = "PAID";
    purchase.paidAt = new Date();
    purchase.expiresAt = undefined;
    await purchase.save();

    if (purchase.type === "TICKET") {
      await this.generateTickets(purchase);
      await this.moveReservedToSold(purchase);
    } else if (purchase.type === "VOTE") {
      await this.addVotes(purchase);
    }

    // Notify Organizer
    await this.notifyOrganizerOfPurchase(purchase);

    // Notify Customer (Email & SMS)
    await this.notifyCustomerOfPurchase(purchase);

    return { 
      purchase, 
      paymentData,
      ...extraDetails 
    };
  }

  private static async notifyOrganizerOfPurchase(purchase: IPurchase) {
    try {
      const event = await Event.findById(purchase.eventId);
      if (!event) return;

      const title = purchase.type === "TICKET" ? "New Ticket Sold" : "New Vote Received";
      const message = purchase.type === "TICKET" 
        ? `${purchase.ticketQuantity} ticket(s) sold for "${event.title}".`
        : `${purchase.voteCount} vote(s) received for "${event.title}".`;

      await NotificationService.create({
        userId: event.organizerId,
        title,
        message,
        type: purchase.type === "TICKET" ? "EVENT" : "PAYMENT",
        metadata: { 
          eventId: event._id,
          purchaseId: purchase._id
        }
      });
    } catch (err) {
      console.error("Failed to notify organizer of purchase:", err);
    }
  }

  private static async notifyCustomerOfPurchase(purchase: IPurchase) {
    try {
      const event = await Event.findById(purchase.eventId);
      if (!event) return;

      if (purchase.type === "TICKET") {
        const tickets = await Ticket.find({ purchaseId: purchase._id });
        
        // Find ticket type name from event
        const ticketTypeNames: Record<string, string> = {};
        event.ticketTypes?.forEach(tt => {
          ticketTypeNames[tt._id!.toString()] = tt.name;
        });

        const ticketData = tickets.map(t => ({
          ticketNumber: t.ticketNumber,
          ticketTypeName: ticketTypeNames[t.ticketTypeId.toString()] || "Standard Ticket",
          qrData: t.qrData
        }));

        // Send Email
        try {
          await EmailService.sendTicketEmail({
            to: purchase.customerEmail,
            customerName: purchase.customerName || "Customer",
            eventTitle: event.title,
            eventDate: event.startDate.toDateString(),
            venue: event.venue || "TBA",
            tickets: ticketData,
            totalAmount: purchase.amount,
            reference: purchase.paymentReference,
            eventImage: event.imageUrl
          });
        } catch (emailErr) {
          console.error("Failed to send ticket email:", emailErr);
        }

        // Send SMS
        if (purchase.customerPhone) {
          try {
            await SMSService.sendTicketConfirmation(
              purchase.customerPhone,
              event.title,
              purchase.ticketQuantity || 0,
              purchase.paymentReference
            );
          } catch (smsErr) {
            console.error("Failed to send ticket SMS:", smsErr);
          }
        }
      } else if (purchase.type === "VOTE") {
        // Find candidate name
        let candidateName = "Candidate";
        let categoryName = "Category";
        event.categories?.forEach(cat => {
          const cand = cat.candidates.find(c => c._id?.toString() === purchase.candidateId?.toString());
          if (cand) {
            candidateName = cand.name;
            categoryName = cat.name;
          }
        });

        // Send Email
        try {
          await EmailService.sendVoteEmail({
            to: purchase.customerEmail,
            customerName: purchase.customerName || "Voter",
            eventTitle: event.title,
            candidateName: candidateName,
            voteCount: purchase.voteCount || 0,
            totalAmount: purchase.amount,
            reference: purchase.paymentReference
          });
        } catch (emailErr) {
          console.error("Failed to send vote email:", emailErr);
        }

        // Send SMS
        if (purchase.customerPhone) {
          try {
            await SMSService.sendVoteConfirmation(
              purchase.customerPhone,
              purchase.amount,
              purchase.voteCount || 0,
              candidateName,
              categoryName
            );
          } catch (smsErr) {
            console.error("Failed to send vote SMS:", smsErr);
          }
        }
      }
    } catch (err) {
      console.error("Failed to notify customer of purchase:", err);
    }
  }

  static async verifyWithGateway(reference: string): Promise<PaymentVerificationResult> {
    const gateway = await this.getDefaultGateway();
    const gatewayService = this.getGatewayService(gateway);
    
    const result = await gatewayService.verifyPayment(reference);
    
    return {
      success: result.success,
      status: result.status,
      amount: result.amount,
      currency: result.currency,
      reference: result.reference,
      metadata: result.metadata,
      gatewayData: result
    };
  }

  static async reconcilePurchase(reference: string, metadata: any, amount: number): Promise<HydratedDocument<IPurchase>> {
    let purchase = await Purchase.findOne({ paymentReference: reference });
    
    if (purchase) {
      return purchase;
    }

    if (!metadata) {
      throw new AppError("Purchase not found and no metadata available for reconstruction", 404);
    }

    console.log(`[PurchaseService] Reconstructing missing purchase from metadata for reference: ${reference}`);

    const purchaseData: any = {
      paymentReference: reference,
      amount: amount,
      status: "PENDING",
      type: metadata.type,
      eventId: metadata.eventId,
      userId: metadata.userId,
      customerEmail: metadata.customerEmail,
      customerName: metadata.customerName,
      customerPhone: metadata.customerPhone,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // Default expiry if reconstructed
    };

    if (metadata.type === "TICKET") {
      purchaseData.ticketTypeId = metadata.ticketTypeId;
      purchaseData.ticketQuantity = metadata.quantity;
    } else if (metadata.type === "VOTE") {
      purchaseData.candidateId = metadata.candidateId;
      purchaseData.categoryId = metadata.categoryId;
      purchaseData.voteCount = metadata.voteCount;
    }

    return await Purchase.create(purchaseData);
  }

  static async generateTickets(purchase: IPurchase) {
    const tickets: HydratedDocument<ITicket>[] = [];

    
    for (let i = 0; i < purchase.ticketQuantity!; i++) {
      const ticketNumber = this.generateTicketNumber();
      const qrData = ticketNumber;

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
    
    // Increment verified stats
    event.totalRevenue = (event.totalRevenue || 0) + purchase.amount;
    event.totalPaidVotes = (event.totalPaidVotes || 0) + purchase.voteCount!;
    
    // Ensure nesting changes are saved
    event.markModified('categories');
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
    } else if (req.body?.data?.txstatus !== undefined && req.body?.data?.externalref) {
      gateway = 'moolre';
    } else if (req.body?.trans_status) {
      gateway = 'appsmobile';
    } else if (req.body?.order_id && req.body?.status) {
      gateway = 'nalo';
    }
    
    const gatewayService = this.getGatewayService(gateway);
    const webhookResult = await gatewayService.handleWebhook(req);
    
    if (!webhookResult.isValid) {
      return { success: false };
    }

    if (webhookResult.reference) {
      if (webhookResult.status === 'success') {
        console.log('Processing successful payment for reference:', webhookResult.reference);
        
        // Reconcile/Find the purchase record using metadata if available
        const purchase = await this.reconcilePurchase(
          webhookResult.reference, 
          webhookResult.metadata, 
          webhookResult.amount || 0
        );
        
        if (purchase.status !== "PAID") {
          purchase.status = "PAID";
          purchase.paidAt = new Date();
          purchase.expiresAt = undefined;
          // Update amount if it was 0 (reconstructed) but the webhook has the real value
          if (purchase.amount === 0 && webhookResult.amount) {
            purchase.amount = webhookResult.amount;
          }
          
          // Prioritize gateway-provided customer phone (e.g., Paystack MoMo number)
          if (webhookResult.customerPhone) {
            purchase.customerPhone = webhookResult.customerPhone;
          }
          
          await purchase.save();

          if (purchase.type === "TICKET") {
            await this.generateTickets(purchase);
            await this.moveReservedToSold(purchase);
          } else if (purchase.type === "VOTE") {
            await this.addVotes(purchase);
          }

          // Notify Customer (Email & SMS)
          await this.notifyCustomerOfPurchase(purchase);
        }
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
      purchase.expiresAt = undefined;
      await purchase.save();

      if (purchase.type === "TICKET") {
        await this.generateTickets(purchase);
        await this.moveReservedToSold(purchase);
      } else if (purchase.type === "VOTE") {
        await this.addVotes(purchase);
      }

      // Notify Customer (Email & SMS)
      await this.notifyCustomerOfPurchase(purchase);
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
    
    // Increment verified stats
    event.totalRevenue = (event.totalRevenue || 0) + purchase.amount;
    event.totalTicketsSold = (event.totalTicketsSold || 0) + purchase.ticketQuantity!;
    
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

  static async initializeTicketPurchaseUSSD(data: {
    eventId: string;
    ticketTypeId: string;
    quantity: number;
    customerPhone: string;
    network: string;
    source: "ussd";
  }) {
    const event = await this.validateEventAvailability(data.eventId, 'TICKETING');


    const ticketType = event.ticketTypes?.find(tt => tt._id?.toString() === data.ticketTypeId);
    if (!ticketType) {
      throw new AppError("Ticket type not found", 404);
    }

    const totalUnavailable = (ticketType.sold || 0) + (ticketType.reserved || 0);
    if (totalUnavailable + data.quantity > ticketType.quantity) {
      throw new AppError("Not enough tickets available", 400);
    }

    ticketType.reserved = (ticketType.reserved || 0) + data.quantity;
    await event.save();

    const amount = ticketType.price * data.quantity;
    const reference = this.generateReference();
    const expiresAt = new Date(Date.now() + 30.5 * 60 * 1000);

    const gateway = await this.getUSSDPaymentGateway();
    const gatewayService = this.getGatewayService(gateway);

    const purchase = await Purchase.create({
      eventId: data.eventId,
      type: "TICKET",
      source: data.source,
      paymentReference: reference,
      amount,
      ticketTypeId: data.ticketTypeId,
      ticketQuantity: data.quantity,
      expiresAt,
      customerEmail: `${event.eventCode}@easevote.com`,
      customerPhone: data.customerPhone,
      paymentGateway: gateway.toUpperCase()
    });

    if (!gatewayService.initializeUSSDPayment) {
      throw new AppError("Selected gateway does not support USSD payments", 400);
    }

    console.log(`[PurchaseService] Initializing ticket purchase (USSD) for ${data.customerPhone}. Event: ${data.eventId}, Amount: ${amount}, Reference: ${reference}, Gateway: ${gateway}`);
    
    const paymentData = await gatewayService.initializeUSSDPayment({
      email: `${event.eventCode}@easevote.com`,
      amount,
      reference,
      network: data.network,
      customerPhone: data.customerPhone,
      callback_url: process.env.CALLBACK_URL || `${process.env.API_URL || 'https://api-dev.easevotegh.com'}/api/purchases/webhook/payment`,
      metadata: {
        purchaseId: purchase._id,
        eventId: data.eventId,
        type: "TICKET",
        source: "ussd"
      }
    });

    return {
      purchase,
      paymentUrl: paymentData.success ? "USSD_INITIATED" : "FAILED",
      reference
    };
  }

  static async initializeVotePurchaseUSSD(data: {
    eventId: string;
    candidateId: string;
    categoryId: string;
    voteCount: number;
    customerPhone: string;
    network: string;
    source: "ussd";
  }) {
    const event = await this.validateEventAvailability(data.eventId, 'VOTING');
    if (!event) throw new AppError("Event not found", 404);

    const now = new Date();
    const votingStart = event.votingStartTime || event.startDate;
    const votingEnd = event.votingEndTime || event.endDate;

    if (votingStart && now < votingStart) {
      throw new AppError("Voting has not started yet", 400);
    }
    if (votingEnd && now > votingEnd) {
      throw new AppError("Voting has ended", 400);
    }

    if (!event.costPerVote) {
      throw new AppError("Voting not configured for this event", 400);
    }

    if (event.minVotesPerPurchase && data.voteCount < event.minVotesPerPurchase) {
      throw new AppError(`Minimum ${event.minVotesPerPurchase} votes required`, 400);
    }

    if (event.maxVotesPerPurchase && data.voteCount > event.maxVotesPerPurchase) {
      throw new AppError(`Maximum ${event.maxVotesPerPurchase} votes allowed`, 400);
    }

    const amount = event.costPerVote * data.voteCount;
    const reference = this.generateReference();
    const expiresAt = new Date(Date.now() + 30.5 * 60 * 1000);

    const gateway = await this.getUSSDPaymentGateway();
    const gatewayService = this.getGatewayService(gateway);

    const purchase = await Purchase.create({
      eventId: data.eventId,
      type: "VOTE",
      source: data.source,
      paymentReference: reference,
      amount,
      candidateId: data.candidateId,
      categoryId: data.categoryId,
      voteCount: data.voteCount,
      expiresAt,
      customerEmail: `${event.eventCode}@easevote.com`,
      customerPhone: data.customerPhone,
      paymentGateway: gateway.toUpperCase()
    });

    if (!gatewayService.initializeUSSDPayment) {
      throw new AppError("Selected gateway does not support USSD payments", 400);
    }

    console.log(`[PurchaseService] Initializing vote purchase (USSD) for ${data.customerPhone}. Event: ${data.eventId}, Amount: ${amount}, Reference: ${reference}, Gateway: ${gateway}`);
    
    const paymentData = await gatewayService.initializeUSSDPayment({
      email: `${event.eventCode}@easevote.com`,
      amount,
      reference,
      network: data.network,
      customerPhone: data.customerPhone,
      callback_url: process.env.CALLBACK_URL || `${process.env.API_URL || 'https://api-dev.easevotegh.com'}/api/purchases/webhook/payment`,
      metadata: {
        purchaseId: purchase._id,
        eventId: data.eventId,
        type: "VOTE",
        source: "ussd"
      }
    });

    return {
      purchase,
      paymentUrl: paymentData.success ? "USSD_INITIATED" : "FAILED",
      reference
    };
  }

  private static async getUSSDPaymentGateway(): Promise<PaymentGateway> {
    return await GatewayService.getPrimaryProvider("USSD");
  }

  static async getAllTransactions(query: any) {
    const { page, limit, skip } = PaginationHelper.getParams(query);
    
    const filter: any = {};
    if (query.eventId) {
      try {
        filter.eventId = new mongoose.Types.ObjectId(query.eventId);
      } catch (e) {
        filter.eventId = query.eventId; // Fallback
      }
    }
    
    if (query.status && query.status !== "ALL") {
      // Map frontend status labels (SUCCESS) to backend ledger status (PAID)
      if (query.status === "SUCCESS" || query.status === "PAID") {
        filter.status = "PAID";
      } else {
        filter.status = query.status;
      }
    }
    
    if (query.type && query.type !== "ALL") filter.type = query.type;
    if (query.gateway && query.gateway !== "ALL") filter.paymentGateway = query.gateway;
    if (query.channel && query.channel !== "ALL") filter.source = query.channel.toLowerCase();

    if (query.date) {
      const startOfDay = new Date(query.date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(query.date);
      endOfDay.setUTCHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    // Sort by createdAt desc by default
    const sort = { createdAt: -1 };

    const [purchases, total] = await Promise.all([
      Purchase.find(filter)
        .populate("eventId", "title type categories")
        .populate("userId", "fullName email")
        .sort(sort as any)
        .skip(skip)
        .limit(limit)
        .lean(),
      Purchase.countDocuments(filter)
    ]);

    const processedPurchases = purchases.map((purchase: any) => {
      if (purchase.type === "VOTE" && purchase.candidateId && purchase.eventId?.categories) {
        let candidateObj = null;
        for (const cat of purchase.eventId.categories) {
          const cand = cat.candidates?.find((c: any) => c._id?.toString() === purchase.candidateId.toString());
          if (cand) {
            candidateObj = { name: cand.name, code: cand.code };
            break;
          }
        }
        purchase.candidate = candidateObj;
      }
      if (purchase.eventId) {
        delete purchase.eventId.categories;
      }
      return purchase;
    });

    return PaginationHelper.formatResponse(processedPurchases, total, page, limit);
  }

  static async getOrganizerTransactions(organizerId: string, query: any) {
    const { page, limit, skip } = PaginationHelper.getParams(query);
    const sort = { createdAt: -1 };

    // Find all event IDs for this organizer for baseline filter
    const organizerEvents = await Event.find({ organizerId, isDeleted: false }).select("_id");
    const baseEventIds = organizerEvents.map(e => e._id);

    const filter: any = { eventId: { $in: baseEventIds } };
    
    // Allow further narrowing by specific eventId if provided
    if (query.eventId) {
      try {
        const targetId = new mongoose.Types.ObjectId(query.eventId);
        if (baseEventIds.some(id => id.toString() === targetId.toString())) {
          filter.eventId = targetId;
        }
      } catch (e) {
        // Handle malformed ID
      }
    }
    
    if (query.status && query.status !== "ALL") {
      if (query.status === "SUCCESS" || query.status === "PAID") {
        filter.status = "PAID";
      } else {
        filter.status = query.status;
      }
    }

    if (query.type && query.type !== "ALL") filter.type = query.type;
    if (query.gateway && query.gateway !== "ALL") filter.paymentGateway = query.gateway;
    if (query.channel && query.channel !== "ALL") filter.source = query.channel.toLowerCase();

    if (query.date) {
      const startOfDay = new Date(query.date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(query.date);
      endOfDay.setUTCHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const [purchases, total] = await Promise.all([
      Purchase.find(filter)
        .populate("eventId", "title type categories")
        .populate("userId", "fullName email")
        .sort(sort as any)
        .skip(skip)
        .limit(limit)
        .lean(),
      Purchase.countDocuments(filter)
    ]);

    const processedPurchases = purchases.map((purchase: any) => {
      if (purchase.type === "VOTE" && purchase.candidateId && purchase.eventId?.categories) {
        let candidateObj = null;
        for (const cat of purchase.eventId.categories) {
          const cand = cat.candidates?.find((c: any) => c._id?.toString() === purchase.candidateId.toString());
          if (cand) {
            candidateObj = { name: cand.name, code: cand.code };
            break;
          }
        }
        purchase.candidate = candidateObj;
      }
      if (purchase.eventId) {
        delete purchase.eventId.categories;
      }
      return purchase;
    });

    return PaginationHelper.formatResponse(processedPurchases, total, page, limit);
  }

  static async getRevenueStats() {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    // 1. Overall Aggregates (Including Success Rate)
    const overallStats = await Purchase.aggregate([
      {
        $facet: {
          paidStats: [
            { $match: { status: "PAID" } },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
          ],
          allAttemptsCount: [
            { $match: { status: { $in: ["PAID", "FAILED"] } } },
            { $count: "count" }
          ],
          pendingCount: [
            { $match: { status: "PENDING" } },
            { $count: "count" }
          ],
          byType: [
            { $match: { status: "PAID" } },
            { $group: { _id: "$type", value: { $sum: "$amount" } } },
            { $project: { name: "$_id", value: 1, _id: 0 } }
          ],
          topEvents: [
            { $match: { status: "PAID" } },
            { $group: { _id: "$eventId", revenue: { $sum: "$amount" }, count: { $sum: 1 } } },
            { $sort: { revenue: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: "events",
                localField: "_id",
                foreignField: "_id",
                as: "event"
              }
            },
            { $unwind: "$event" },
            {
              $project: {
                title: "$event.title",
                type: "$event.type",
                revenue: 1,
                count: 1
              }
            }
          ],
          trend: [
            {
              $match: {
                status: "PAID",
                createdAt: { $gte: last30Days }
              }
            },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                revenue: { $sum: "$amount" }
              }
            },
            { $sort: { _id: 1 } },
            { $project: { date: "$_id", revenue: 1, _id: 0 } }
          ]
        }
      }
    ]);

    const result = overallStats[0];
    const paidTotals = result.paidStats[0] || { total: 0, count: 0 };
    const allAttempts = result.allAttemptsCount[0]?.count || 0;
    const pendingStatusCount = result.pendingCount[0]?.count || 0;
    const successRate = allAttempts > 0 ? (paidTotals.count / allAttempts) * 100 : 100;

    // 2. Platform Commission Calculation
    const commissionSetting = await Settings.findOne({ key: "platform_commission" });
    const commissionRate = commissionSetting ? parseFloat(commissionSetting.value) : 10;
    
    // 3. Top Organizers (only paid)
    const topOrganizersStats = await Purchase.aggregate([
      { $match: { status: "PAID" } },
      {
        $lookup: {
          from: "events",
          localField: "eventId",
          foreignField: "_id",
          as: "event"
        }
      },
      { $unwind: "$event" },
      {
        $group: {
          _id: "$event.organizerId",
          revenue: { $sum: "$amount" },
          eventCount: { $addToSet: "$eventId" }
        }
      },
      { $project: { _id: 1, revenue: 1, eventCount: { $size: "$eventCount" } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "organizer"
        }
      },
      { $unwind: "$organizer" },
      {
        $project: {
          name: "$organizer.fullName",
          businessName: "$organizer.businessName",
          email: "$organizer.email",
          revenue: 1,
          eventCount: 1
        }
      }
    ]);

    return {
      totalRevenue: paidTotals.total,
      totalTransactions: paidTotals.count,
      successRate,
      pendingCount: pendingStatusCount,
      netCommission: paidTotals.total * (commissionRate / 100),
      organizerEarnings: paidTotals.total * (1 - commissionRate / 100),
      byType: result.byType.map((t: any) => ({
        ...t,
        name: t.name === "VOTE" ? "Voting" : "Ticketing"
      })),
      trend: result.trend,
      topEvents: result.topEvents,
      topOrganizers: topOrganizersStats
    };
  }
}