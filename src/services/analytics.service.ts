import mongoose from "mongoose";
import { User } from "../models/User.model";
import { Event } from "../models/Event.model";
import { Purchase } from "../models/Purchase.model";
import { Payout } from "../models/Payout.model";
import { Settings } from "../models/Settings.model";
import { Log } from "../models/Log.model";
import { PaginationHelper } from "../utils/pagination.util";

export class AnalyticsService {
  /**
   * High-level overview stats for the platform pulse.
   * Derived entirely from the live transaction ledger.
   */
  static async getPlatformPulse() {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const [
        countsData,         // 0
        recentActivity,     // 1
        commissionSetting,  // 2
        pendingPayoutData,  // 3
        trendData,          // 4
        topEventsData       // 5
      ] = await Promise.all([
        // 0. Base counts
        Promise.all([
          User.countDocuments(),
          User.countDocuments({ role: "ORGANIZER" }),
          Event.countDocuments({ status: { $in: ["LIVE", "PUBLISHED", "APPROVED"] } }),
          Purchase.aggregate([
            { $match: { status: "PAID" } },
            { 
              $group: { 
                _id: null, 
                totalVolume: { $sum: "$amount" },
                totalVotes: { $sum: { $ifNull: ["$voteCount", 0] } },
                totalTickets: { $sum: { $ifNull: ["$ticketQuantity", 0] } },
                transactionCount: { $sum: 1 }
              } 
            }
          ])
        ]),
        // 1. Logs
        Log.find()
          .populate("user", "fullName email avatar role")
          .sort({ createdAt: -1 })
          .limit(10),
        // 2. Settings
        Settings.findOne({ key: "platform_commission" }),
        // 3. Pending Payouts
        Payout.aggregate([
          { $match: { status: "PENDING" } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        // 4. Revenue Trend
        Purchase.aggregate([
          { 
            $match: { 
              status: "PAID",
              createdAt: { $gte: sixMonthsAgo }
            } 
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" }
              },
              revenue: { $sum: "$amount" }
            }
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]),
        // 5. Top 5 Events by Ledger Volume
        Purchase.aggregate([
          { $match: { status: "PAID" } },
          { 
            $group: { 
              _id: "$eventId", 
              revenue: { $sum: "$amount" },
              votes: { $sum: { $ifNull: ["$voteCount", 0] } },
              tickets: { $sum: { $ifNull: ["$ticketQuantity", 0] } }
            } 
          },
          { $sort: { revenue: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: "events",
              localField: "_id",
              foreignField: "_id",
              as: "eventDetails"
            }
          },
          { $unwind: { path: "$eventDetails", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "users",
              localField: "eventDetails.organizerId",
              foreignField: "_id",
              as: "organizerDetails"
            }
          },
          { $unwind: { path: "$organizerDetails", preserveNullAndEmptyArrays: true } }
        ])
      ]);

      const [totalUsers, registeredOrganizers, activeEvents, ledgerData] = countsData;
      const ledger = ledgerData[0] || { totalVolume: 0, totalVotes: 0, totalTickets: 0, transactionCount: 0 };
      const pendingPayoutAmt = pendingPayoutData[0]?.total || 0;
      
      const commissionRate = commissionSetting ? parseFloat(commissionSetting.value) : 10;
      const platformFee = ledger.totalVolume * (commissionRate / 100);

      const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const revenueTrend = trendData.map((t: any) => ({
        name: t._id && t._id.month ? MONTH_NAMES[t._id.month - 1] : "N/A",
        revenue: t.revenue
      })).filter(t => t.name !== "N/A");

      const topEvents = topEventsData
        .filter((e: any) => e.eventDetails)
        .map((e: any) => ({
          id: e._id,
          title: e.eventDetails.title,
          type: e.eventDetails.type,
          revenue: e.revenue,
          votes: e.votes,
          tickets: e.tickets,
          organizer: e.organizerDetails ? e.organizerDetails.fullName : "Unknown"
        }));

      return {
        overview: {
          totalUsers,
          registeredOrganizers,
          activeEvents,
          totalRevenue: ledger.totalVolume,
          totalVotesCast: ledger.totalVotes,
          ticketsSold: ledger.totalTickets,
          platformFeeEarned: platformFee,
          pendingPayouts: pendingPayoutAmt,
          successfulSales: ledger.transactionCount,
          revenueTrend,
          topEvents
        },
        recentActivity
      };
    } catch (err) {
      console.error("[AnalyticsService] Error in getPlatformPulse:", err);
      throw err; // Re-throw for global handler on admin endpoints
    }
  }

  /**
   * High-level overview stats for a specific event.
   * Handles flexible commission rates.
   */
  static async getEventPulse(eventId: string) {
    try {
      const event = await Event.findById(eventId);
      if (!event) throw new Error("Event not found");

      const [ledgerData, commissionSetting] = await Promise.all([
        Purchase.aggregate([
          { 
            $match: { 
                eventId: new mongoose.Types.ObjectId(eventId), 
                status: { $regex: /^(paid|successful|completed)$/i } 
            } 
          },
          { 
            $group: { 
              _id: null, 
              totalVolume: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } },
              totalVotes: { $sum: { $ifNull: ["$voteCount", 0] } },
              totalTickets: { $sum: { $ifNull: ["$ticketQuantity", 0] } }
            } 
          }
        ]),
        Settings.findOne({ key: "platform_commission" })
      ]);

      const ledger = ledgerData[0] || { totalVolume: 0, totalVotes: 0, totalTickets: 0 };
      
      // Flexible Commission Logic
      const globalCommission = commissionSetting ? parseFloat(commissionSetting.value) : 10;
      const commissionRate = event.commissionRate !== undefined && event.commissionRate !== null 
        ? event.commissionRate 
        : globalCommission;

      const netRevenue = ledger.totalVolume * (1 - commissionRate / 100);

      return {
        eventId,
        title: event.title,
        grossRevenue: ledger.totalVolume,
        netRevenue: netRevenue,
        totalVotes: ledger.totalVotes,
        totalTickets: ledger.totalTickets,
        commissionRate,
        isCustomCommission: event.commissionRate !== undefined && event.commissionRate !== null
      };
    } catch (err) {
      console.error("[AnalyticsService] Error in getEventPulse:", err);
      throw err;
    }
  }

  /**
   * High-level overview stats for a specific organizer.
   * Aggregates stats across all events, respecting individual commission rates.
   */
  static async getOrganizerPulse(organizerId: string) {
    try {
      if (!organizerId) return { totalRevenue: 0, grossRevenue: 0, totalVotes: 0, totalTickets: 0, revenueTrend: [], topEvents: [] };

      const orgObjectId = new mongoose.Types.ObjectId(organizerId);

      // 1. Get all events owned by organizer
      const events = await Event.find({ organizerId: orgObjectId, isDeleted: false });
      if (events.length === 0) {
        return { totalRevenue: 0, grossRevenue: 0, totalVotes: 0, totalTickets: 0, revenueTrend: [], topEvents: [] };
      }

      const commissionSetting = await Settings.findOne({ key: "platform_commission" });
      const globalCommission = commissionSetting ? parseFloat(commissionSetting.value) : 10;

      const eventIds = events.map(e => e._id);
      
      const [ledgerData, trendData] = await Promise.all([
        // Aggregated stats per event to apply individual commission rates
        Purchase.aggregate([
          { 
            $match: { 
                eventId: { $in: eventIds }, 
                status: { $regex: /^(paid|successful|completed)$/i } 
            } 
          },
          { 
            $group: { 
              _id: "$eventId", 
              totalVolume: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } },
              totalVotes: { $sum: { $ifNull: ["$voteCount", 0] } },
              totalTickets: { $sum: { $ifNull: ["$ticketQuantity", 0] } }
            } 
          }
        ]),
        // Revenue Trend (Simplified to gross for trend, or we could map net if needed)
        Purchase.aggregate([
          { 
            $match: { 
              eventId: { $in: eventIds },
              status: { $regex: /^(paid|successful|completed)$/i },
              createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } // 6 months
            } 
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" }
              },
              revenue: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } }
            }
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } }
        ])
      ]);

      let totalNetRevenue = 0;
      let totalGrossRevenue = 0;
      let totalVotes = 0;
      let totalTickets = 0;

      const topEvents = ledgerData.map(item => {
        const event = events.find(e => e._id.toString() === item._id.toString());
        const rate = event?.commissionRate ?? globalCommission;
        const net = item.totalVolume * (1 - rate / 100);
        
        totalNetRevenue += net;
        totalGrossRevenue += item.totalVolume;
        totalVotes += item.totalVotes;
        totalTickets += item.totalTickets;

        return {
          id: item._id,
          title: event?.title || "Unknown",
          revenue: item.totalVolume,
          organizerNet: net,
          votes: item.totalVotes,
          tickets: item.totalTickets
        };
      }).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

      const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const revenueTrend = trendData.map((t: any) => ({
        name: t._id && t._id.month ? MONTH_NAMES[t._id.month - 1] : "N/A",
        revenue: t.revenue // Gross trend for simplicity
      })).filter(t => t.name !== "N/A");

      return {
        totalRevenue: totalNetRevenue,
        grossRevenue: totalGrossRevenue,
        totalVotes,
        totalTickets,
        revenueTrend,
        topEvents
      };
    } catch (err) {
      console.error("[AnalyticsService] Error in getOrganizerPulse:", err);
      return { totalRevenue: 0, grossRevenue: 0, totalVotes: 0, totalTickets: 0, revenueTrend: [], topEvents: [] };
    }
  }

  /**
   * Detailed user growth and funnel analytics.
   */
  static async getUserAnalytics() {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const [totalUsers, roleDistribution, growthTrend, funnelData, topActive] = await Promise.all([
      User.countDocuments(),
      User.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } },
        { $project: { name: "$_id", value: "$count", _id: 0 } }
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: last30Days } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { date: "$_id", count: 1, _id: 0 } }
      ]),
      User.aggregate([
        {
          $facet: {
            registered: [{ $count: "count" }],
            verified: [{ $match: { emailVerified: true } }, { $count: "count" }],
            approvedOrganizers: [{ $match: { role: "ORGANIZER", status: "ACTIVE" } }, { $count: "count" }]
          }
        }
      ]),
      User.find()
        .sort({ updatedAt: -1 })
        .limit(10)
        .select("fullName email avatar role status updatedAt")
    ]);

    const funnel = [
      { name: "Total Signups", value: funnelData[0].registered[0]?.count || 0 },
      { name: "Email Verified", value: funnelData[0].verified[0]?.count || 0 },
      { name: "Active Organizers", value: funnelData[0].approvedOrganizers[0]?.count || 0 }
    ];

    return {
      totalUsers,
      roleDistribution,
      growthTrend,
      funnelData: funnel,
      topActive: topActive.map(u => ({
          id: u._id,
          name: u.fullName,
          email: u.email,
          role: u.role,
          lastActivity: u.updatedAt
      }))
    };
  }

  /**
   * Paginated system logs.
   */
  static async getSystemLogs(query: any) {
    const { page, limit, skip } = PaginationHelper.getParams(query);
    
    const [logs, total] = await Promise.all([
      Log.find()
        .populate("user", "fullName email avatar role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Log.countDocuments()
    ]);

    return PaginationHelper.formatResponse(logs, total, page, limit);
  }

  /**
   * Global helper to record a log.
   */
  static async logAction(data: {
    userId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      await Log.create({
        user: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.userId, // Defaulting to userId for now if entityId is missing for logs
        metadata: data.metadata
      });
    } catch (err) {
      console.error("[AnalyticsService] Failed to record log:", err);
    }
  }
}
