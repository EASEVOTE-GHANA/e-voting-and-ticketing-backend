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
      .sort({ createdAt: -1 })
      .lean();

    const headers = {
      "createdAt": "Date",
      "paymentReference": "Reference",
      "eventId.title": "Event",
      "customerName": "Customer Name",
      "customerEmail": "Customer Email",
      "customerPhone": "Customer Phone",
      "userId.fullName": "User FullName (If Registered)",
      "type": "Type",
      "paymentGateway": "Gateway",
      "source": "Channel (Web/USSD)",
      "currency": "Currency",
      "amount": "Amount",
      "status": "Status"
    };

    return this.toCsv(transactions, headers);
  }

  static async exportPayoutsCsv() {
    const payouts = await Payout.find()
      .populate("organizerId", "fullName businessName email")
      .sort({ createdAt: -1 })
      .lean();

    const headers = {
      "createdAt": "Date",
      "reference": "Reference",
      "organizerId.businessName": "Organizer",
      "organizerId.email": "Email",
      "amount": "Amount (GHS)",
      "status": "Status",
      "paymentDetails.method": "Payout Method",
      "paymentDetails.bankOrNetwork": "Bank / Network",
      "paymentDetails.accountNumber": "Account Number",
      "paymentDetails.accountName": "Account Name",
      "adminNotes": "Admin Notes"
    };

    return this.toCsv(payouts, headers);
  }

  static async exportOrganizersCsv() {
    const organizers = await User.find({ role: "ORGANIZER" })
      .sort({ createdAt: -1 })
      .lean();

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
      .sort({ createdAt: -1 })
      .lean();

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
      .sort({ createdAt: -1 })
      .lean();

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

  static async generatePlatformPdf(res: any) {
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const { AnalyticsService } = require('./analytics.service');

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=platform_summary_${Date.now()}.pdf`);
    doc.pipe(res);

    try {
      const stats = await AnalyticsService.getPlatformPulse();

      const logoPath = path.join(__dirname, '../../../../frontend/public/apple-touch-icon.png');
      const fs = require('fs');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 50 });
        doc.moveDown(1);
      } else {
        doc.fillColor("#5b0058").fontSize(28).text("EASEVOTE", { align: "left" });
      }

      doc.fontSize(10).fillColor("#94a3b8").text("OFFICIAL PLATFORM INTELLIGENCE REPORT", { align: "right" });
      doc.moveDown(3);

      doc.fillColor("#0f172a").fontSize(18).text("Executive Summary");
      doc.moveDown(0.5);

      doc.fontSize(12).fillColor("#334155");
      doc.text(`Total Platform Users: ${stats.overview.totalUsers}`);
      doc.text(`Registered Organizers: ${stats.overview.registeredOrganizers}`);
      doc.text(`Active Events: ${stats.overview.activeEvents}`);
      doc.text(`Total Tickets Sold: ${stats.overview.ticketsSold}`);
      doc.text(`Total Votes Cast: ${stats.overview.totalVotesCast}`);
      doc.text(`Platform Gross Revenue (GHS): ${stats.overview.totalRevenue.toFixed(2)}`);
      doc.text(`Platform Commission Earned (GHS): ${stats.overview.platformFeeEarned.toFixed(2)}`);
      
      doc.moveDown(2);

      doc.fillColor("#0f172a").fontSize(18).text("Top Performing Events");
      doc.moveDown(0.5);
      
      const topEvents = stats.overview.topEvents || [];
      if (topEvents.length === 0) {
          doc.fontSize(11).fillColor("#64748b").text("No events data available yet.");
      } else {
          topEvents.forEach((event: any, idx: number) => {
            doc.fontSize(12).fillColor("#0f172a").text(`${idx + 1}. ${event.title}`);
            doc.fontSize(10).fillColor("#64748b").text(`Organizer: ${event.organizer} | Revenue: GHS ${event.revenue.toFixed(2)} | Votes: ${event.votes} | Tickets: ${event.tickets}`);
            doc.moveDown(0.5);
          });
      }

      doc.moveDown(3);
      doc.fontSize(9).fillColor("#94a3b8").text(`Securely generated by Easevote Internal Systems on ${new Date().toUTCString()}`, { align: "center" });

    } catch (err) {
      console.error("PDF Generation error", err);
      doc.fontSize(12).fillColor("red").text("Failed to compile analytics data.");
    }

    doc.end();
  }
}
