import { User } from "../models/User.model";
import { Event } from "../models/Event.model";
import { Purchase } from "../models/Purchase.model";
import { Log } from "../models/Log.model";
import { PaginationHelper } from "../utils/pagination.util";

export class AnalyticsService {
  /**
   * High-level overview stats for the platform pulse.
   */
  static async getPlatformPulse() {
    const [counts, recentActivity] = await Promise.all([
      // Aggregating counts from multiple collections
      Promise.all([
        User.countDocuments(),
        Event.countDocuments({ status: { $in: ["LIVE", "PUBLISHED"] } }),
        Purchase.countDocuments({ status: "PAID" }),
        Purchase.aggregate([
            { $match: { status: "PAID" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ])
      ]),
      // Recent Audit Logs
      Log.find()
        .populate("user", "fullName email avatar role")
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    const [totalUsers, activeEvents, successfulSales, totalVolumeData] = counts;
    const totalVolume = totalVolumeData[0]?.total || 0;

    return {
      overview: {
        totalUsers,
        activeEvents,
        successfulSales,
        totalVolume
      },
      recentActivity
    };
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
        entityId: data.entityId,
        metadata: data.metadata
      });
    } catch (err) {
      console.error("[AnalyticsService] Failed to record log:", err);
    }
  }
}
