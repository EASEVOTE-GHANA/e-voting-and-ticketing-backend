import mongoose from "mongoose";
import { Payout, PayoutStatus } from "../models/Payout.model";
import { Purchase } from "../models/Purchase.model";
import { Event } from "../models/Event.model";
import { Settings } from "../models/Settings.model";
import { AppError } from "../middleware/error.middleware";
import { PaginationHelper } from "../utils/pagination.util";
import { ReconciliationService } from "./reconciliation.service";
import { AnalyticsService } from "./analytics.service";
import { NotificationService } from "./notification.service";
import { SMSService } from "./sms.service";

export interface IPayoutBalance {
  grossRevenue: number;
  netRevenue: number;
  totalWithdrawn: number;
  availableBalance: number;
  commissionRate?: number;
  isCustomCommission?: boolean;
  totalVotes?: number;
  totalTickets?: number;
  revenueTrend?: any[];
  topEvents?: any[];
}

export class PayoutService {
  /**
   * Calculates the current withdrawable balance for a specific event.
   * Net Revenue (Gross * (1 - Commission)) - (Sum of Payouts for this event [PENDING, PROCESSING, PAID])
   */
  static async getOrganizerBalance(organizerId: string, eventId?: string): Promise<IPayoutBalance> {
    const orgId = new mongoose.Types.ObjectId(organizerId);

    if (!eventId) {
        // Global overview: Calculate total across all events
        const pulse = await AnalyticsService.getOrganizerPulse(organizerId);
        
        // Sum all valid payouts across all events
        const payoutStats = await Payout.aggregate([
          { 
            $match: { 
              organizerId: orgId, 
              status: { $in: ["PENDING", "PROCESSING", "PAID"] } 
            } 
          },
          { 
            $group: { 
              _id: null, 
              total: { $sum: "$amount" } 
            } 
          }
        ]);
        const totalWithdrawn = payoutStats[0]?.total || 0;
        const availableBalance = Math.max(0, pulse.totalRevenue - totalWithdrawn);

        return {
          ...pulse,
          netRevenue: pulse.totalRevenue,
          totalWithdrawn,
          availableBalance
        };
    }

    const evId = new mongoose.Types.ObjectId(eventId);

    // 1. Get event details and stats
    const eventStats = await AnalyticsService.getEventPulse(eventId);
    const netRevenue = eventStats.netRevenue;

    // 2. Sum all valid payouts for this specific event
    const payoutStats = await Payout.aggregate([
      { 
        $match: { 
          organizerId: orgId, 
          eventId: evId,
          status: { $in: ["PENDING", "PROCESSING", "PAID"] } 
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: "$amount" } 
        } 
      }
    ]);
    const totalWithdrawnAndPending = payoutStats[0]?.total || 0;

    // 3. Final available balance for this event
    const availableBalance = Math.max(0, netRevenue - totalWithdrawnAndPending);

    return {
      grossRevenue: eventStats.grossRevenue,
      netRevenue: netRevenue,
      totalWithdrawn: totalWithdrawnAndPending,
      availableBalance: availableBalance,
      commissionRate: eventStats.commissionRate,
      isCustomCommission: eventStats.isCustomCommission
    };
  }

  /**
   * Organizer initiates a payout request for a specific event.
   */
  static async requestPayout(organizerId: string, data: { amount: number; eventId: string; paymentDetails: any }) {
    const { amount, eventId, paymentDetails } = data;

    if (!eventId) {
      throw new AppError("eventId is required for payout requests", 400);
    }

    if (amount <= 0) {
      throw new AppError("Payout amount must be greater than 0", 400);
    }

    // Check balance for this specific event
    const { availableBalance } = await this.getOrganizerBalance(organizerId, eventId);
    if (amount > availableBalance) {
      throw new AppError(`Insufficient balance for this event. Available: GHS ${availableBalance.toFixed(2)}`, 400);
    }

    // Generate unique reference
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const reference = `EV-PAY-${timestamp}${random}`;

    const payout = await Payout.create({
      organizerId,
      eventId: new mongoose.Types.ObjectId(eventId),
      amount,
      paymentDetails,
      reference,
      status: "PENDING"
    });

    return payout;
  }

  /**
   * Get payout history for an organizer.
   */
  static async getOrganizerPayouts(organizerId: string, query: any) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const filter: any = { organizerId };
    if (status) filter.status = status;
    if (query.eventId) filter.eventId = query.eventId;

    const [payouts, total] = await Promise.all([
      Payout.find(filter)
        .populate("eventId", "title eventCode")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payout.countDocuments(filter)
    ]);

    return PaginationHelper.formatResponse(payouts, total, page, limit);
  }

  /**
   * Admin: Get all payouts across platform.
   */
  static async getAllPayouts(query: any) {
    const { page = 1, limit = 10, status, organizerId } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (status) filter.status = status;
    if (organizerId) filter.organizerId = organizerId;
    if (query.eventId) filter.eventId = query.eventId;

    const [payouts, total] = await Promise.all([
      Payout.find(filter)
        .populate("organizerId", "fullName businessName email phone")
        .populate("eventId", "title eventCode")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payout.countDocuments(filter)
    ]);

    return PaginationHelper.formatResponse(payouts, total, page, limit);
  }

  /**
   * Admin: Update payout status manually.
   */
  static async updatePayoutStatus(payoutId: string, status: PayoutStatus, notes: string, adminId: string) {
    const payout = await Payout.findById(payoutId).populate("organizerId");
    if (!payout) {
      throw new AppError("Payout request not found", 404);
    }

    // Removed restriction to allow superadmins to correct mistakes

    const previousStatus = payout.status;
    payout.status = status;
    payout.adminNotes = notes;
    payout.processedBy = new mongoose.Types.ObjectId(adminId);
    payout.processedAt = new Date();

    await payout.save();

    // Send notifications if status changed
    if (previousStatus !== status && payout.organizerId) {
      const organizer = payout.organizerId as any;
      
      // In-app Notification
      await NotificationService.create({
        userId: organizer._id,
        title: "Payout Status Updated",
        message: `Your payout request for GHS ${payout.amount.toFixed(2)} is now ${status}.${notes ? ' Notes: ' + notes : ''}`,
        type: "PAYOUT"
      });

      // SMS Notification
      if (organizer.phone) {
        const smsMessage = `EaseVote: Your payout request of GHS ${payout.amount.toFixed(2)} is now ${status}.`;
        await SMSService.sendCustomMessage(organizer.phone, smsMessage).catch(err => console.error("SMS Error:", err));
      }
    }

    return payout;
  }
}
