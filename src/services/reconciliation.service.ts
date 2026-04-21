import { Event } from "../models/Event.model";
import { Purchase } from "../models/Purchase.model";
import { Ticket } from "../models/Ticket.model";
import { User } from "../models/User.model";
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
      source: "web", // Change "system" to "web" to match enum ["web", "ussd"]
      status: "PAID",
      amount: gapData.gap,
      paymentReference: `REC-${event._id.toString().slice(-6)}-${Date.now().toString().slice(-4)}`,
      paidAt: new Date(),
      expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years in future
      customerEmail: "reconciliation@easevote.com"
    });

    return {
      success: true,
      message: `Successfully reconciled GHS ${gapData.gap.toFixed(2)} for ${event.title}`,
      reconciledAmount: gapData.gap
    };
  }

  /**
   * Syncs event ticket statistics with actual ticket ledger.
   * This is used to fix discrepancies between cached counts and real documents.
   */
  static async syncEventTicketStats(eventId: string, userId: string) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError("Event not found", 404);

    // Verify ownership
    if (event.organizerId.toString() !== userId) {
      const user = await User.findById(userId);
      const isAdmin = user && ["ADMIN", "SUPER_ADMIN"].includes(user.role);
      if (!isAdmin) {
        throw new AppError("Unauthorized", 403);
      }
    }

    // 1. Get actual ticket counts from Ticket collection
    const ticketStats = await Ticket.aggregate([
      { $match: { eventId: event._id } },
      { $group: { _id: "$ticketTypeId", count: { $sum: 1 } } }
    ]);

    const totalTickets = ticketStats.reduce((sum, stat) => sum + stat.count, 0);

    // 2. Get verified revenue from Purchase collection
    const revenueStats = await Purchase.aggregate([
      { 
        $match: { 
          eventId: { $in: [event._id, event._id.toString()] }, 
          type: "TICKET",
          status: "PAID" 
        } 
      },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const totalRevenue = revenueStats[0]?.total || 0;

    // 3. Update event fields
    event.totalTicketsSold = totalTickets;
    event.totalRevenue = totalRevenue;

    // 4. Update individual ticket types
    if (event.ticketTypes) {
      event.ticketTypes.forEach(tt => {
        const stat = ticketStats.find(s => s._id?.toString() === tt._id?.toString());
        tt.sold = stat ? stat.count : 0;
      });
    }

    await event.save();

    return {
      success: true,
      message: `Synced ${totalTickets} tickets and GHS ${totalRevenue.toFixed(2)} revenue for ${event.title}`,
      stats: {
        totalTickets,
        totalRevenue,
        ticketTypeBreakdown: ticketStats
      }
    };
  }

  /**
   * Syncs event statistics (revenue, votes, tickets) with the purchase ledger.
   */
  static async syncEventStats(eventId: string, userId: string) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError("Event not found", 404);

    // Verify ownership or Admin status
    const callingUser = await User.findById(userId);
    const isAdmin = callingUser && ["ADMIN", "SUPER_ADMIN"].includes(callingUser.role);
    if (event.organizerId.toString() !== userId && !isAdmin) {
      throw new AppError("Unauthorized", 403);
    }

    // 1. Aggregate revenue from PAID purchases
    const revenueStats = await Purchase.aggregate([
      { 
        $match: { 
          eventId: { $in: [event._id, event._id.toString()] }, 
          status: { $regex: /paid|successful|completed/i }
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } } 
        } 
      }
    ]);
    const totalRevenue = revenueStats[0]?.total || 0;

    // 2. Type-specific syncing
    if (event.type === "VOTING") {
      // Aggregate total paid votes if applicable
      const voteStats = await Purchase.aggregate([
        { 
          $match: { 
            eventId: { $in: [event._id, event._id.toString()] }, 
            type: "VOTE",
            status: { $regex: /paid|successful|completed/i }
          } 
        },
        { $group: { _id: "$candidateId", count: { $sum: "$voteCount" } } }
      ]);

      const totalPaidVotes = voteStats.reduce((sum, stat) => sum + stat.count, 0);
      event.totalPaidVotes = totalPaidVotes;

      // Update individual candidate votes
      if (event.categories) {
        event.categories.forEach(category => {
          category.candidates.forEach(candidate => {
            const stat = voteStats.find(s => s._id?.toString() === candidate._id?.toString());
            candidate.votes = stat ? stat.count : 0;
          });
        });
      }
      console.log(`[Sync] Voting Sync: Total Votes=${totalPaidVotes}`);
    } else if (event.type === "TICKETING") {
      // Sync ticket counts from Ticket collection
      const ticketStats = await Ticket.aggregate([
        { $match: { eventId: { $in: [event._id, event._id.toString()] } } },
        { $group: { _id: "$ticketTypeId", count: { $sum: 1 } } }
      ]);
      const totalTickets = ticketStats.reduce((sum, stat) => sum + stat.count, 0);
      event.totalTicketsSold = totalTickets;

      // Update individual ticket type sold counts
      if (event.ticketTypes) {
        event.ticketTypes.forEach(tt => {
          const stat = ticketStats.find(s => s._id?.toString() === tt._id?.toString());
          tt.sold = stat ? stat.count : 0;
        });
      }
    }

    event.totalRevenue = totalRevenue;
    await event.save();

    return {
      success: true,
      eventId: event._id,
      title: event.title,
      totalRevenue
    };
  }

  /**
   * Syncs all events for a specific organizer.
   */
  static async syncOrganizerStats(organizerId: string, adminId: string) {
    const events = await Event.find({ organizerId, isDeleted: false });
    
    console.log(`[ReconciliationService] Syncing stats for ${events.length} events belonging to Organizer: ${organizerId}`);
    
    const results = await Promise.all(
      events.map(event => this.syncEventStats(event._id.toString(), adminId))
    );

    const totalRevenue = results.reduce((sum, r) => sum + r.totalRevenue, 0);

    return {
      success: true,
      organizerId,
      eventCount: events.length,
      totalRevenue,
      results
    };
  }
}
