import mongoose from "mongoose";
import { Payout, PayoutStatus } from "../models/Payout.model";
import { Purchase } from "../models/Purchase.model";
import { Event } from "../models/Event.model";
import { Settings } from "../models/Settings.model";
import { AppError } from "../middleware/error.middleware";
import { PaginationHelper } from "../utils/pagination.util";

export class PayoutService {
  /**
   * Calculates the current withdrawable balance for an organizer.
   * Total Earnings (Gross) * (1 - Commission) - (Sum of Payouts [PENDING, PROCESSING, PAID])
   */
  static async getOrganizerBalance(organizerId: string) {
    // 1. Get all events owned by organizer
    const events = await Event.find({ organizerId, isDeleted: false }, "_id");
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

    // 2. Sum gross revenue from PAID purchases for these events
    const purchaseStats = await Purchase.aggregate([
      { $match: { eventId: { $in: eventIds }, status: "PAID" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const grossRevenue = purchaseStats[0]?.total || 0;

    // 3. Get platform commission rate
    const commissionSetting = await Settings.findOne({ key: "platform_commission" });
    const commissionRate = commissionSetting ? parseFloat(commissionSetting.value) : 10;
    
    // 4. Calculate total organizer net share (before payouts)
    const organizerNetShare = grossRevenue * (1 - commissionRate / 100);

    // 5. Sum all payouts (excluding REJECTED and CANCELLED)
    const payoutStats = await Payout.aggregate([
      { 
        $match: { 
          organizerId: new mongoose.Types.ObjectId(organizerId), 
          status: { $in: ["PENDING", "PROCESSING", "PAID"] } 
        } 
      },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalWithdrawnAndPending = payoutStats[0]?.total || 0;

    // 6. Final available balance
    const availableBalance = Math.max(0, organizerNetShare - totalWithdrawnAndPending);

    return {
      grossRevenue,
      netRevenue: organizerNetShare,
      totalWithdrawn: totalWithdrawnAndPending,
      availableBalance,
      commissionRate
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
