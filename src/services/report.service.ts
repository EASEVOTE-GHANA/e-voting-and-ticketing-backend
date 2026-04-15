import { Purchase } from "../models/Purchase.model";
import { Payout } from "../models/Payout.model";
import { User } from "../models/User.model";
import { Event } from "../models/Event.model";
import { Nomination } from "../models/Nomination.model";

export class ReportService {
  /**
   * Universal CSV formatter for arrays of objects.
   */
  private static toCsv(data: any[], headers: Record<string, string>): string {
    const headerRow = Object.values(headers).join(",");
    const keys = Object.keys(headers);
    
    const rows = data.map(item => {
      return keys.map(key => {
        const val = key.split('.').reduce((obj, k) => obj?.[k], item);
        const cell = val === undefined || val === null ? "" : String(val);
        // Escape quotes and wrap in quotes if contains commas
        return `"${cell.replace(/"/g, '""')}"`;
      }).join(",");
    });

    return [headerRow, ...rows].join("\n");
  }

  static async exportTransactionsCsv(filters: any = {}) {
    const query: any = { status: "PAID" };
    if (filters.startDate && filters.endDate) {
        query.createdAt = { $gte: new Date(filters.startDate), $lte: new Date(filters.endDate) };
    }

    const transactions = await Purchase.find(query)
      .populate("eventId", "title")
      .populate("userId", "fullName email")
      .sort({ createdAt: -1 });

    const headers = {
      "createdAt": "Date",
      "paymentReference": "Reference",
      "userId.fullName": "Customer",
      "userId.email": "Email",
      "eventId.title": "Event",
      "type": "Type",
      "amount": "Amount (GHS)",
      "status": "Status"
    };

    return this.toCsv(transactions, headers);
  }

  static async exportPayoutsCsv() {
    const payouts = await Payout.find()
      .populate("organizerId", "fullName businessName email")
      .sort({ createdAt: -1 });

    const headers = {
      "createdAt": "Date",
      "organizerId.businessName": "Organizer",
      "organizerId.email": "Email",
      "amount": "Amount (GHS)",
      "status": "Status",
      "bankDetails.bankName": "Bank",
      "bankDetails.accountNumber": "Account",
      "bankDetails.accountName": "Name"
    };

    return this.toCsv(payouts, headers);
  }

  static async exportOrganizersCsv() {
    const organizers = await User.find({ role: "ORGANIZER" })
      .sort({ createdAt: -1 });

    const headers = {
      "createdAt": "Joined",
      "fullName": "Name",
      "businessName": "Business",
      "email": "Email",
      "status": "Status",
      "emailVerified": "Verified"
    };

    return this.toCsv(organizers, headers);
  }

  static async exportEventsCsv() {
    const events = await Event.find()
      .populate("organizerId", "businessName")
      .sort({ createdAt: -1 });

    const headers = {
      "createdAt": "Created",
      "title": "Event Title",
      "organizerId.businessName": "Organizer",
      "eventType": "Type",
      "status": "Status",
      "stats.totalVotes": "Total Votes",
      "stats.ticketsSold": "Tickets Sold",
      "stats.totalRevenue": "Revenue (GHS)"
    };

    return this.toCsv(events, headers);
  }

  static async exportNominationsCsv() {
    const nominations = await Nomination.find()
      .populate("candidateId", "fullName email")
      .populate("categoryId", "name")
      .sort({ createdAt: -1 });

    const headers = {
      "createdAt": "Nominated On",
      "candidateId.fullName": "Candidate Name",
      "candidateId.email": "Candidate Email",
      "categoryId.name": "Category",
      "status": "Final Status",
      "nominationOrder": "Order ID"
    };

    return this.toCsv(nominations, headers);
  }
}
