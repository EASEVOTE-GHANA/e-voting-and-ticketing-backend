import { Event } from "../models/Event.model";
import { Ticket } from "../models/Ticket.model";
import { Purchase } from "../models/Purchase.model";
import { AppError } from "../middleware/error.middleware";
import { EventService } from "./event.service";

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

  static async getEventTickets(eventId: string, userId: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== userId) {
      throw new AppError("Unauthorized", 403);
    }

    return await Ticket.find({ eventId }).populate('purchaseId', 'customerName customerEmail');
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