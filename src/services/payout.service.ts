import mongoose from "mongoose";
import { Payout, PayoutStatus } from "../models/Payout.model";
import { Purchase } from "../models/Purchase.model";
import { Event } from "../models/Event.model";
import { Settings } from "../models/Settings.model";
import { AppError } from "../middleware/error.middleware";
import { PaginationHelper } from "../utils/pagination.util";
import { ReconciliationService } from "./reconciliation.service";
import { AnalyticsService } from "./analytics.service";

export class PayoutService {
  /**
   * Calculates the current withdrawable balance for an organizer.
   * Total Earnings (Gross) * (1 - Commission) - (Sum of Payouts [PENDING, PROCESSING, PAID])
   */
  static async getOrganizerBalance(organizerId: string) {
    const orgId = new mongoose.Types.ObjectId(organizerId);

    // 1. Get all events owned by organizer to define the scope
    const events = await Event.find({ organizerId: orgId, isDeleted: false }, "_id");
    const eventIds = events.map(e => e._id);

    if (eventIds.length === 0) {
      return {
        grossRevenue: 0,
        netRevenue: 0,
        totalWithdrawn: 0,
        availableBalance: 0,
        commissionRate: 10
      };
    }

    const pulse = await AnalyticsService.getOrganizerPulse(organizerId);
    const grossRevenue = pulse.grossRevenue || 0;
    const organizerNetShare = pulse.totalRevenue || 0;
    const commissionRate = pulse.commissionRate || 10;

    // 4b. Find any "unverified" revenue (gaps between cached stats and ledger)
    const gaps = await ReconciliationService.getOrganizerGaps(organizerId);
    const unverifiedRevenue = gaps.reduce((sum, g) => sum + g.gap, 0);

    // 5. Sum all valid payouts
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
    const totalWithdrawnAndPending = payoutStats[0]?.total || 0;

    // 6. Final available balance
    const availableBalance = Math.max(0, organizerNetShare - totalWithdrawnAndPending);

    return {
      grossRevenue,
      netRevenue: organizerNetShare,
      totalWithdrawn: totalWithdrawnAndPending,
      availableBalance: Math.max(0, organizerNetShare - totalWithdrawnAndPending),
      commissionRate,
      unverifiedRevenue,
      hasGaps: unverifiedRevenue > 0.01
    };
  }

  /**
   * Organizer initiates a payout request.
   */
  static async requestPayout(organizerId: string, data: { amount: number; paymentDetails: any }) {
    const { amount, paymentDetails } = data;

    if (amount <= 0) {
      throw new AppError("Payout amount must be greater than 0", 400);
    }

    // Check balance
    const { availableBalance } = await this.getOrganizerBalance(organizerId);
    if (amount > availableBalance) {
      throw new AppError(`Insufficient balance. Available: GHS ${availableBalance.toFixed(2)}`, 400);
    }

    // Generate unique reference
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const reference = `EV-PAY-${timestamp}${random}`;

    const payout = await Payout.create({
      organizerId,
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

    const [payouts, total] = await Promise.all([
      Payout.find(filter)
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

    const [payouts, total] = await Promise.all([
      Payout.find(filter)
        .populate("organizerId", "fullName businessName email phone")
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
    const payout = await Payout.findById(payoutId);
    if (!payout) {
      throw new AppError("Payout request not found", 404);
    }

    // Business logic: Can't update PAID or REJECTED payouts
    if (["PAID", "REJECTED", "CANCELLED"].includes(payout.status)) {
      throw new AppError(`Cannot update a payout that is already ${payout.status}`, 400);
    }

    payout.status = status;
    payout.adminNotes = notes;
    payout.processedBy = new mongoose.Types.ObjectId(adminId);
    payout.processedAt = new Date();

    await payout.save();
    return payout;
  }
}
