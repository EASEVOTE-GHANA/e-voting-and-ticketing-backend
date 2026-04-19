import { Event } from "../models/Event.model";
import { Purchase } from "../models/Purchase.model";
import { AppError } from "../middleware/error.middleware";
import mongoose from "mongoose";

export class ReconciliationService {
  /**
   * Compares an event's cached stats with actual transaction logs.
   * Returns the gap (unverified revenue).
   */
  static async getEventGaps(eventId: string) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError("Event not found", 404);

    const purchaseStats = await Purchase.aggregate([
      { 
        $match: { 
          eventId: event._id, 
          status: { $regex: /^(paid|successful|completed)$/i }
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } } 
        } 
      }
    ]);

    const verifiedRevenue = purchaseStats[0]?.total || 0;
    const cachedRevenue = event.totalRevenue || 0;
    const gap = Math.max(0, cachedRevenue - verifiedRevenue);

    return {
      eventId,
      eventTitle: event.title,
      cachedRevenue,
      verifiedRevenue,
      gap,
      needsReconciliation: gap > 0.01 // Handle floating point precision
    };
  }

  /**
   * Identifies all gaps for an organizer
   */
  static async getOrganizerGaps(organizerId: string) {
    const events = await Event.find({ organizerId, isDeleted: false });
    const gaps = await Promise.all(events.map(event => this.getEventGaps(event._id.toString())));
    
    return gaps.filter(g => g.needsReconciliation);
  }

  /**
   * Reconciles a specific event by creating a "RECONCILIATION" purchase record
   * to bridge the gap in the ledger.
   */
  static async reconcileEvent(eventId: string, userId: string) {
    const gapData = await this.getEventGaps(eventId);
    if (!gapData.needsReconciliation) {
      return { success: true, message: "No reconciliation needed" };
    }

    const event = await Event.findById(eventId);
    if (!event) throw new AppError("Event not found", 404);
    
    // Verify ownership
    if (event.organizerId.toString() !== userId) {
      throw new AppError("Unauthorized", 403);
    }

    // Create a special purchase record to bridge the ledger gap
    await Purchase.create({
      eventId: event._id,
      type: "VOTE", // Default to vote type for reconciliation
      source: "system",
      status: "PAID",
      amount: gapData.gap,
      paymentReference: `REC-${event._id.toString().slice(-6)}-${Date.now().toString().slice(-4)}`,
      paidAt: new Date(),
      customerEmail: "reconciliation@easevote.com",
      metadata: {
        reconciliation: true,
        originalCachedRevenue: gapData.cachedRevenue,
        originalVerifiedRevenue: gapData.verifiedRevenue,
        reconciledBy: userId
      }
    });

    return {
      success: true,
      message: `Successfully reconciled GHS ${gapData.gap.toFixed(2)} for ${event.title}`,
      reconciledAmount: gapData.gap
    };
  }
}
