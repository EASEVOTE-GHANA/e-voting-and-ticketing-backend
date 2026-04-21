import { Event } from "../models/Event.model";
import { Ticket } from "../models/Ticket.model";
import { Purchase } from "../models/Purchase.model";
import { User } from "../models/User.model";
import { AppError } from "../middleware/error.middleware";
import { EventService } from "./event.service";
import { PaginationHelper } from "../utils/pagination.util";
import mongoose from "mongoose";

export class TicketService {
  static async addTicketType(eventId: string, ticketData: any, organizerId: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== organizerId) {
      throw new AppError("Unauthorized", 403);
    }

    if (event.type !== "TICKETING") {
      throw new AppError("Ticket types can only be added to ticketing events", 400);
    }

    event.ticketTypes = event.ticketTypes || [];
    event.ticketTypes.push(ticketData);
    await event.save();
    return EventService.filterEventResponse(event);
  }

  static async updateTicketType(eventId: string, ticketTypeId: string, updateData: any, userId: string, userRole: string) {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    const isOwner = event.organizerId.toString() === userId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
    
    if (!isOwner && !isAdmin) {
      throw new AppError("Access denied", 403);
    }

    const ticketType = event.ticketTypes?.find(tt => tt._id?.toString() === ticketTypeId);
    if (!ticketType) {
      throw new AppError("Ticket type not found", 404);
    }

    Object.assign(ticketType, updateData);
    await event.save();
    return EventService.filterEventResponse(event);
  }

  static async deleteTicketType(eventId: string, ticketTypeId: string, userId: string, userRole: string) {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    const isOwner = event.organizerId.toString() === userId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
    
    if (!isOwner && !isAdmin) {
      throw new AppError("Access denied", 403);
    }

    event.ticketTypes = event.ticketTypes?.filter(tt => tt._id?.toString() !== ticketTypeId) || [];
    await event.save();
    return { message: "Ticket type deleted successfully" };
  }

  static async getTicketsByPurchase(purchaseId: string) {
    return await Ticket.find({ purchaseId });
  }
  static async scanTicket(ticketNumber: string, userId: string) {
    const ticket = await Ticket.findOne({ ticketNumber }).populate('eventId', 'title organizerId');
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const event = ticket.eventId as any;
    if (event.organizerId.toString() !== userId) {
      throw new AppError("Unauthorized", 403);
    }

    if (ticket.isUsed) {
      throw new AppError("Ticket already used", 400);
    }

    ticket.isUsed = true;
    ticket.usedAt = new Date();
    await ticket.save();
    
    return ticket;
  }

  static async toggleTicketUsage(ticketNumber: string, userId: string) {
    const ticket = await Ticket.findOne({ ticketNumber }).populate('eventId', 'title organizerId');
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const event = ticket.eventId as any;
    if (event.organizerId.toString() !== userId) {
      throw new AppError("Unauthorized", 403);
    }

    // Toggle the status
    ticket.isUsed = !ticket.isUsed;
    ticket.usedAt = ticket.isUsed ? new Date() : undefined;
    
    await ticket.save();
    
    return ticket;
  }

  static async getEventTickets(eventId: string, userId: string, query: any) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== userId) {
      const user = await User.findById(userId);
      const isAdmin = user && ["ADMIN", "SUPER_ADMIN"].includes(user.role);
      if (!isAdmin) {
        throw new AppError("Unauthorized", 403);
      }
    }

    const { page, limit, skip } = PaginationHelper.getParams(query);
    const search = query.query || query.search || "";
    const status = query.status || "ALL";

    const filter: any = { eventId };

    // Status filter
    if (status === "USED") filter.isUsed = true;
    if (status === "UNUSED") filter.isUsed = false;

    // Search filter (Customer Name, Email, Ticket Number)
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { ticketNumber: searchRegex },
        { customerName: searchRegex },
        { customerEmail: searchRegex },
      ];
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate("purchaseId", "customerName customerEmail")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Ticket.countDocuments(filter),
    ]);

    return PaginationHelper.formatResponse(tickets, total, page, limit);
  }

  static async getTicketStats(eventId: string, userId: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== userId) {
      throw new AppError("Unauthorized", 403);
    }

    const totalTickets = await Ticket.countDocuments({ eventId });
    const usedTickets = await Ticket.countDocuments({ eventId, isUsed: true });
    const totalRevenue = await Purchase.aggregate([
      { $match: { eventId, type: "TICKET", status: "PAID" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    return {
      totalTickets,
      usedTickets,
      unusedTickets: totalTickets - usedTickets,
      totalRevenue: totalRevenue[0]?.total || 0
    };
  }
}