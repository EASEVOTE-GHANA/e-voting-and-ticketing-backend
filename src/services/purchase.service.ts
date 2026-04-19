import { Purchase } from "../models/Purchase.model";
import { Event } from "../models/Event.model";
import { ITicket, Ticket } from "../models/Ticket.model";
import { Settings } from "../models/Settings.model";
import { PaystackService } from "./paystack.service";
import { FlutterwaveService } from "./flutterwave.service";
import { AppsMobileService } from "./appsmobile.service";
import { AppError } from "../middleware/error.middleware";
import { PaginationHelper } from "../utils/pagination.util";
import { GatewayService } from "./gateway.service";
import crypto from "crypto";
import { IPurchase } from "../models/Purchase.model";
import { IPaymentGateway, PaymentVerificationResult } from "../payment-gateway.interface";
import { HydratedDocument } from "mongoose";

type PaymentGateway = 'paystack' | 'flutterwave' | 'appsmobile';

export class PurchaseService {
  private static async getDefaultGateway(): Promise<PaymentGateway> {
    return await GatewayService.getPrimaryProvider("WEB");
  }

  private static getGatewayService(gateway: PaymentGateway): IPaymentGateway {
    switch (gateway) {
      case 'paystack':
        return new PaystackService();
      case 'flutterwave':
        return new FlutterwaveService();
      case 'appsmobile':
        return new AppsMobileService();
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

  static async initializeTicketPurchase(data: any) {
    console.log(`[PurchaseService] initializeTicketPurchase called with:`, JSON.stringify(data, null, 2));
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
      source: "web",
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
    
    console.log(`[PurchaseService] Initializing ticket purchase for ${data.customerEmail}. Event: ${data.eventId}, Amount: ${amount}, Reference: ${reference}, Gateway: ${gateway}`);
    
    const paymentData = await gatewayService.initializePayment({
      email: data.customerEmail,
      amount,
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
      metadata: {
        purchaseId: purchase._id,
        eventId: data.eventId,
        type: "TICKET",
        ticketTypeId: data.ticketTypeId,
        quantity: data.quantity,
        customerEmail: data.customerEmail,
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
    const event = await Event.findById(data.eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.status !== "PUBLISHED" && event.status !== "LIVE") {
      throw new AppError("Event not available for voting", 400);
    }

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
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      customerPhone: data.customerPhone
    });

    const gateway = await this.getDefaultGateway();
    const gatewayService = this.getGatewayService(gateway);
    
    console.log(`[PurchaseService] Initializing vote purchase for ${data.customerEmail}. Event: ${data.eventId}, Amount: ${amount}, Reference: ${reference}, Gateway: ${gateway}`);
    
    const paymentData = await gatewayService.initializePayment({
      email: data.customerEmail,
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
        customerEmail: data.customerEmail,
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

    purchase.status = "PAID";
    purchase.paidAt = new Date();
    await purchase.save();

    if (purchase.type === "TICKET") {
      await this.generateTickets(purchase);
      await this.moveReservedToSold(purchase);
    } else if (purchase.type === "VOTE") {
      await this.addVotes(purchase);
    }

    return { 
      purchase, 
      paymentData,
      ...extraDetails 
    };
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
    } else if (req.body.trans_status) {
      gateway = 'appsmobile';
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
          // Update amount if it was 0 (reconstructed) but the webhook has the real value
          if (purchase.amount === 0 && webhookResult.amount) {
            purchase.amount = webhookResult.amount;
          }
          await purchase.save();

          if (purchase.type === "TICKET") {
            await this.generateTickets(purchase);
            await this.moveReservedToSold(purchase);
          } else if (purchase.type === "VOTE") {
            await this.addVotes(purchase);
          }
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

  static async initializeTicketPurchaseUSSD(data: {
    eventId: string;
    ticketTypeId: string;
    quantity: number;
    customerPhone: string;
    network: string;
    source: "ussd";
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

    const totalUnavailable = (ticketType.sold || 0) + (ticketType.reserved || 0);
    if (totalUnavailable + data.quantity > ticketType.quantity) {
      throw new AppError("Not enough tickets available", 400);
    }

    ticketType.reserved = (ticketType.reserved || 0) + data.quantity;
    await event.save();

    const amount = ticketType.price * data.quantity;
    const reference = this.generateReference();
    const expiresAt = new Date(Date.now() + 30.5 * 60 * 1000);

    const purchase = await Purchase.create({
      eventId: data.eventId,
      type: "TICKET",
      source: data.source,
      paymentReference: reference,
      amount,
      ticketTypeId: data.ticketTypeId,
      ticketQuantity: data.quantity,
      expiresAt,
      customerEmail: `${data.customerPhone}@ussd.easevote.com`,
      customerPhone: data.customerPhone
    });

    const gateway = await this.getUSSDPaymentGateway();
    const gatewayService = this.getGatewayService(gateway);

    if (!gatewayService.initializeUSSDPayment) {
      throw new AppError("Selected gateway does not support USSD payments", 400);
    }

    console.log(`[PurchaseService] Initializing ticket purchase (USSD) for ${data.customerPhone}. Event: ${data.eventId}, Amount: ${amount}, Reference: ${reference}, Gateway: ${gateway}`);
    
    const paymentData = await gatewayService.initializeUSSDPayment({
      email: `${data.customerPhone}@ussd.easevote.com`,
      amount,
      reference,
      network: data.network,
      customerPhone: data.customerPhone,
      callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
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
    const event = await Event.findById(data.eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.status !== "PUBLISHED" && event.status !== "LIVE") {
      throw new AppError("Event not available for voting", 400);
    }

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
      customerEmail: `${data.customerPhone}@ussd.easevote.com`,
      customerPhone: data.customerPhone
    });

    const gateway = await this.getUSSDPaymentGateway();
    const gatewayService = this.getGatewayService(gateway);

    if (!gatewayService.initializeUSSDPayment) {
      throw new AppError("Selected gateway does not support USSD payments", 400);
    }

    console.log(`[PurchaseService] Initializing vote purchase (USSD) for ${data.customerPhone}. Event: ${data.eventId}, Amount: ${amount}, Reference: ${reference}, Gateway: ${gateway}`);
    
    const paymentData = await gatewayService.initializeUSSDPayment({
      email: `${data.customerPhone}@ussd.easevote.com`,
      amount,
      reference,
      network: data.network,
      customerPhone: data.customerPhone,
      callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
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
    
    // Sort by createdAt desc by default
    const sort = { createdAt: -1 };

    const [purchases, total] = await Promise.all([
      Purchase.find()
        .populate("eventId", "title type")
        .populate("userId", "fullName email")
        .sort(sort as any)
        .skip(skip)
        .limit(limit),
      Purchase.countDocuments()
    ]);

    return PaginationHelper.formatResponse(purchases, total, page, limit);
  }

  static async getRevenueStats() {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    // 1. Overall Aggregates
    const overallStats = await Purchase.aggregate([
      {
        $match: { status: "PAID" }
      },
      {
        $facet: {
          totalRevenue: [
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
          ],
          byType: [
            { $group: { _id: "$type", value: { $sum: "$amount" } } },
            { $project: { name: "$_id", value: 1, _id: 0 } }
          ],
          topEvents: [
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
    const totals = result.totalRevenue[0] || { total: 0, count: 0 };

    // 2. Platform Commission Calculation
    const commissionSetting = await Settings.findOne({ key: "platform_commission" });
    const commissionRate = commissionSetting ? parseFloat(commissionSetting.value) : 10;
    
    // 3. Top Organizers
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
      totalRevenue: totals.total,
      totalTransactions: totals.count,
      netCommission: totals.total * (commissionRate / 100),
      organizerEarnings: totals.total * (1 - commissionRate / 100),
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