import { Event, IEvent } from "../models/Event.model";
import { AppError } from "../middleware/error.middleware";
import { PaginationHelper } from "../utils/pagination.util";
import { CandidateService } from "./candidate.service";
import { CategoryService } from "./category.service";
import { TicketService } from "./ticket.service";
import { NotificationService } from "./notification.service";
import crypto from "crypto";
import mongoose from "mongoose";

export class EventService {
  static generateEventCode(): string {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
  }

  static generateCandidateCode(): string {
    return crypto.randomBytes(2).toString("hex").toUpperCase();
  }

  static filterEventResponse(event: any, userId?: string, userRole?: string) {
    const eventObj = event.toObject ? event.toObject() : event;
    
    if (eventObj.type === "VOTING") {
      delete eventObj.ticketTypes;
      
      // Check if user is organizer or admin - they always see full data
      const isOwner = userId && eventObj.organizerId?._id?.toString() === userId;
      const isAdmin = userRole && ["ADMIN", "SUPER_ADMIN"].includes(userRole);
      
      if (!isOwner && !isAdmin && eventObj.categories) {
        // Apply live results and vote count settings for public users
        eventObj.categories = eventObj.categories.map((category: any) => {
          // Sort candidates by votes for ranking
          let candidates = [...category.candidates].sort((a: any, b: any) => 
            (b.votes || 0) - (a.votes || 0)
          );
          
          // Apply display rules based on settings
          candidates = candidates.map((candidate: any, index: number) => {
            const candidateObj = { ...candidate, id: candidate._id?.toString() };
            
            if (eventObj.liveResults === false) {
              // Hide both votes and rank
              delete candidateObj.votes;
              delete candidateObj.rank;
            } else if (eventObj.showVoteCount === false) {
              // Show only rank, hide votes
              candidateObj.rank = index + 1;
              delete candidateObj.votes;
            } else {
              // Show both rank and votes
              candidateObj.rank = index + 1;
            }
            
            return candidateObj;
          });
          
          return {
            ...category,
            id: category._id?.toString(),
            candidates
          };
        });
      } else if (eventObj.categories) {
        // For organizers and admins, always show rank and votes
        eventObj.categories = eventObj.categories.map((category: any) => {
          let candidates = [...category.candidates].sort((a: any, b: any) => 
            (b.votes || 0) - (a.votes || 0)
          );
          
          candidates = candidates.map((candidate: any, index: number) => ({
            ...candidate,
            id: candidate._id?.toString(),
            rank: index + 1
          }));
          
          return {
            ...category,
            id: category._id?.toString(),
            candidates
          };
        });
      }
    } else if (eventObj.type === "TICKETING" || eventObj.type === "HYBRID") {
      delete eventObj.categories;
      if (eventObj.ticketTypes) {
        eventObj.ticketTypes = eventObj.ticketTypes.map((tt: any) => ({
          ...tt,
          id: tt._id?.toString() || tt.id
        }));
      }
    }
    
    return eventObj;
  }

  static async createEvent(eventData: any, currentUserId: string, currentUserRole: string) {
    const eventCode = this.generateEventCode();
    
    // Determine organizerId based on user role
    let organizerId = currentUserId;
    if (currentUserRole !== "ORGANIZER") {
      if (!eventData.organizerId) {
        throw new AppError("organizerId is required for non-organizer users", 400);
      }
      organizerId = eventData.organizerId;
    }
    
    // Date validations
    const startDate = new Date(eventData.startDate);
    const endDate = new Date(eventData.endDate);
    const now = new Date();

    if (startDate < now) {
      throw new AppError("Start date cannot be in the past", 400);
    }

    if (endDate < now) {
      throw new AppError("End date cannot be in the past", 400);
    }

    if (endDate <= startDate) {
      throw new AppError("End date must be later than start date", 400);
    }
    
    console.log("Creating event with organizerId:", organizerId, "role:", currentUserRole);
    
    // Remove organizerId from eventData to avoid conflicts
    const { organizerId: _, ...cleanEventData } = eventData;
    
    const event = await Event.create({
      ...cleanEventData,
      organizerId: new mongoose.Types.ObjectId(organizerId),
      eventCode,
      status: "DRAFT"
    });

    // Create notification for organizer
    await NotificationService.create({
      userId: organizerId,
      title: "Event Created",
      message: `Your event "${event.title}" has been created as a draft. You can now add categories and candidates.`,
      type: "EVENT",
      metadata: { eventId: event._id }
    });

    // Populate organizer and return with id field
    const populatedEvent = await Event.findById(event._id).populate("organizerId", "fullName email");
    
    console.log("Populated event:", populatedEvent);
    console.log("OrganizerId in event:", event.organizerId);
    
    // Transform response to rename organizerId to organizer
    const raw = populatedEvent?.toObject();

    const eventObj = raw
      ? {
          ...raw,
          organizer: raw.organizerId,
        }
      : null;

    if (eventObj) {
      delete (eventObj as any).organizerId;
    }

    
    return eventObj;
  }

  static async updateEvent(eventId: string, updateData: any, organizerId: string, userRole: string) {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Permission check
    const isOwner = event.organizerId.toString() === organizerId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
    
    if (!isOwner && !isAdmin) {
      throw new AppError("Unauthorized", 403);
    }

    // Prevent certain updates based on status
    if (event.status === "LIVE" && updateData.status !== "PAUSED") {
      throw new AppError("Cannot modify live event", 400);
    }

    // Explicitly reject type modification
    if (updateData.type && updateData.type !== event.type) {
      throw new AppError("Event type cannot be changed after creation", 400);
    }

    // Only allow specific fields to be updated
    const allowedFields = [
      'title', 'description', 'startDate', 'endDate', 'venue', 'isPublic',
      'costPerVote', 'minVotesPerPurchase', 'maxVotesPerPurchase', 'allowPublicNominations',
      'whatsappGroupLink', 'votingStartTime', 'votingEndTime', 'votingStartDate', 'votingEndDate',
      'imageUrl', 'imagePublicId'
    ];
    
    const filteredData: any = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    // Date validations — only validate if dates are being changed
    if (filteredData.startDate || filteredData.endDate) {
      const startDate = new Date(filteredData.startDate || event.startDate);
      const endDate = new Date(filteredData.endDate || event.endDate);
      const now = new Date();

      if (filteredData.startDate && startDate < now) {
        throw new AppError("Start date cannot be in the past", 400);
      }

      if (filteredData.endDate && endDate < now) {
        throw new AppError("End date cannot be in the past", 400);
      }

      if (endDate <= startDate) {
        throw new AppError("End date must be later than start date", 400);
      }
    }

    Object.assign(event, filteredData);
    await event.save();
    return event;
  }

  static async getEvent(eventId: string, userId?: string, userRole?: string) {
    const event = await Event.findOne({ _id: eventId, isDeleted: false }).populate("organizerId", "fullName email");
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Check if event is publicly accessible
    const isPubliclyAccessible = ["NOMINATING", "LIVE", "ENDED"].includes(event.status);
    
    if (!isPubliclyAccessible) {
      // Require authentication for non-public events
      if (!userId || !userRole) {
        throw new AppError("Authentication required", 401);
      }
      
      // Check if user has permission to view this event
      const isOwner = event.organizerId._id?.toString() === userId;
      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
      
      if (!isOwner && !isAdmin) {
        throw new AppError("Access denied", 403);
      }
    }
    
    // Filter response based on event type and settings
    return this.filterEventResponse(event, userId, userRole);
  }

  static async getEvents(filters: any = {}, userRole?: string, userId?: string, query?: any) {
    let dbQuery: any = { isDeleted: false };

    // Role-based filtering
    if (userRole === "ORGANIZER") {
      dbQuery.organizerId = userId;
    } else if (!userRole || userRole === "PUBLIC") {
      dbQuery.status = { $in: ["NOMINATING", "LIVE", "ENDED"] };
      dbQuery.isPublic = true;
      dbQuery.endDate = { $gt: new Date() }; // Only show events that haven't reached their end date
    }
    // Admin and Super Admin can see all events (no additional filters)

    // Apply additional filters
    if (filters.type) dbQuery.type = filters.type;
    if (filters.status) dbQuery.status = filters.status;
    if (
        filters.organizerId &&
        userRole &&
        ["ADMIN", "SUPER_ADMIN"].includes(userRole)
      ) {
        dbQuery.organizerId = filters.organizerId;
      }


    const { page, limit, skip } = PaginationHelper.getParams(query || {});
    
    const [events, total] = await Promise.all([
      Event.find(dbQuery)
        .populate("organizerId", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(dbQuery)
    ]);
    
    // Filter response based on event type and apply vote display rules
    const filteredEvents = events.map(event => this.filterEventResponse(event, userId, userRole));

    return PaginationHelper.formatResponse(filteredEvents, total, page, limit);
  }

  static async getMyEvents(userId: string, filters: any = {}, query?: any) {
    let dbQuery: any = { organizerId: userId, isDeleted: false };
    
    if (filters.type) dbQuery.type = filters.type;
    if (filters.status) dbQuery.status = filters.status;

    const { page, limit, skip } = PaginationHelper.getParams(query || {});
    
    const [events, total] = await Promise.all([
      Event.find(dbQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(dbQuery)
    ]);
    
    const filteredEvents = events.map(event => this.filterEventResponse(event, userId, "ORGANIZER"));

    return PaginationHelper.formatResponse(filteredEvents, total, page, limit);
  }

  static async getAllEventsForAdmin(filters: any = {}, query?: any) {
    let dbQuery: any = { isDeleted: false };
    
    // Explicitly extract only valid filter fields from the filters object
    // This prevents fields like 'limit' or 'page' from being used as MongoDB filters
    if (filters.type && filters.type !== "all") dbQuery.type = filters.type;
    if (filters.status && filters.status !== "all") dbQuery.status = filters.status;
    if (filters.organizerId) dbQuery.organizerId = filters.organizerId;

    const { page, limit, skip } = PaginationHelper.getParams(query || {});
    
    const [events, total] = await Promise.all([
      Event.find(dbQuery)
        .populate("organizerId", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(dbQuery)
    ]);
    
    const filteredEvents = events.map(event => this.filterEventResponse(event, undefined, "ADMIN"));

    return PaginationHelper.formatResponse(filteredEvents, total, page, limit);
  }

  static async restoreEvent(eventId: string, userId: string, userRole: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (!event.isDeleted) {
      throw new AppError("Event is not deleted", 400);
    }

    // Permission check: Must be owner or admin
    const isOwner = event.organizerId.toString() === userId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);

    if (!isOwner && !isAdmin) {
      throw new AppError("Unauthorized to restore this event", 403);
    }

    event.isDeleted = false;
    event.deletedAt = undefined;
    await event.save();

    return event;
  }

  static async getDeletedEvents(userRole: string, userId: string) {
    let query: any = { isDeleted: true };
    
    // Role-based filtering
    if (userRole === "ORGANIZER") {
      query.organizerId = userId;
    } else if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
      throw new AppError("Access denied", 403);
    }

    const events = await Event.find(query)
      .populate("organizerId", "fullName email")
      .sort({ deletedAt: -1 });

    return events.map(event => {
      const eventObj = event.toObject();
      if (eventObj.type === "VOTING") {
        delete eventObj.ticketTypes;
      } else if (eventObj.type === "TICKETING") {
        delete eventObj.categories;
      }
      return eventObj;
    });
  }

  static async submitForReview(eventId: string, organizerId: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== organizerId) {
      throw new AppError("Unauthorized", 403);
    }

    if (event.status !== "DRAFT") {
      throw new AppError("Only draft events can be submitted for review", 400);
    }

    event.status = "PENDING_REVIEW";
    await event.save();

    await NotificationService.create({
      userId: organizerId,
      title: "Event Submitted for Review",
      message: `Your event "${event.title}" has been submitted for review. An admin will check it shortly.`,
      type: "EVENT",
      metadata: { eventId: event._id }
    });

    return event;
  }

  static async approveEvent(eventId: string, userRole: string) {
    if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
      throw new AppError("Unauthorized", 403);
    }

    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.status !== "PENDING_REVIEW") {
      throw new AppError("Only pending events can be approved", 400);
    }

    event.status = "APPROVED";
    await event.save();

    await NotificationService.create({
      userId: event.organizerId,
      title: "Event Approved",
      message: `Great news! Your event "${event.title}" has been approved. You can now publish it to make it live.`,
      type: "EVENT",
      metadata: { eventId: event._id }
    });

    return event;
  }

  static async publishEvent(eventId: string, organizerId: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== organizerId) {
      throw new AppError("Unauthorized", 403);
    }

    if (event.status !== "APPROVED") {
      throw new AppError("Only approved events can be published", 400);
    }

    event.status = "PUBLISHED";
    await event.save();
    return event;
  }

  // Delegate to other services
  static async addCategory(eventId: string, categoryData: any, organizerId: string, userRole?: string) {
    return CategoryService.addCategory(eventId, categoryData, organizerId, userRole);
  }

  static async getEventCategories(eventId: string, userId?: string, userRole?: string) {
    return CategoryService.getEventCategories(eventId, userId, userRole);
  }

  static async getCategoryWithCandidates(eventId: string, categoryId: string, userId?: string, userRole?: string) {
    return CategoryService.getCategoryWithCandidates(eventId, categoryId, userId, userRole);
  }

  static async updateCategory(eventId: string, categoryId: string, updateData: any, userId: string, userRole: string) {
    return CategoryService.updateCategory(eventId, categoryId, updateData, userId, userRole);
  }

  static async deleteCategory(eventId: string, categoryId: string, userId: string, userRole: string) {
    return CategoryService.deleteCategory(eventId, categoryId, userId, userRole);
  }

  static async addCandidate(eventId: string, categoryId: string, candidateData: any, organizerId: string, userRole?: string) {
    return CandidateService.addCandidate(eventId, categoryId, candidateData, organizerId, userRole);
  }

  static async getCandidate(eventId: string, candidateCode: string, userId?: string, userRole?: string) {
    return CandidateService.getCandidate(eventId, candidateCode, userId, userRole);
  }

  static async updateCandidate(eventId: string, categoryId: string, candidateId: string, updateData: any, userId: string, userRole: string) {
    return CandidateService.updateCandidate(eventId, categoryId, candidateId, updateData, userId, userRole);
  }

  static async deleteCandidate(eventId: string, categoryId: string, candidateId: string, userId: string, userRole: string) {
    return CandidateService.deleteCandidate(eventId, categoryId, candidateId, userId, userRole);
  }

  static async addTicketType(eventId: string, ticketData: any, organizerId: string) {
    return TicketService.addTicketType(eventId, ticketData, organizerId);
  }

  static async updateTicketType(eventId: string, ticketTypeId: string, updateData: any, userId: string, userRole: string) {
    return TicketService.updateTicketType(eventId, ticketTypeId, updateData, userId, userRole);
  }

  static async deleteTicketType(eventId: string, ticketTypeId: string, userId: string, userRole: string) {
    return TicketService.deleteTicketType(eventId, ticketTypeId, userId, userRole);
  }

  static async deleteEvent(eventId: string, organizerId: string, userRole: string) {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Permission check
    if (userRole === "ORGANIZER" && event.organizerId.toString() !== organizerId) {
      throw new AppError("Unauthorized", 403);
    }

    if (["LIVE", "ENDED"].includes(event.status)) {
      throw new AppError("Cannot delete live or ended events", 400);
    }

    // Soft delete
    event.isDeleted = true;
    event.deletedAt = new Date();
    await event.save();
    
    return { message: "Event deleted successfully" };
  }

  static async toggleLiveResults(eventId: string, organizerId: string, userRole: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Permission check
    const isOwner = event.organizerId.toString() === organizerId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
    
    if (!isOwner && !isAdmin) {
      throw new AppError("Unauthorized", 403);
    }

    if (event.type !== "VOTING") {
      throw new AppError("Only voting events support live results", 400);
    }

    event.liveResults = !event.liveResults;
    await event.save();
    
    return {
      eventId,
      liveResults: event.liveResults,
      message: `Live results ${event.liveResults ? 'enabled' : 'disabled'}`
    };
  }

  static async suspendEvent(eventId: string, userRole: string, userId: string) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError("Event not found", 404);

    // Permission check
    const isOwner = event.organizerId.toString() === userId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
    const isOrganizer = userRole === "ORGANIZER";

    if (!isAdmin && !(isOrganizer && isOwner)) {
      throw new AppError("Forbidden: insufficient permissions", 403);
    }

    if (!["LIVE", "APPROVED", "PUBLISHED"].includes(event.status)) {
      throw new AppError("Only live or approved events can be suspended", 400);
    }

    return await Event.findByIdAndUpdate(
      eventId, 
      { status: "PAUSED" }, 
      { new: true, runValidators: false } // Bypasses full validation for emergency status changes
    );
  }

  static async resumeEvent(eventId: string, userRole: string, userId: string) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError("Event not found", 404);

    // Permission check
    const isOwner = event.organizerId.toString() === userId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
    const isOrganizer = userRole === "ORGANIZER";

    if (!isAdmin && !(isOrganizer && isOwner)) {
      throw new AppError("Forbidden: insufficient permissions", 403);
    }

    if (event.status !== "PAUSED") {
      throw new AppError("Only paused events can be resumed", 400);
    }

    const targetStatus = new Date() > new Date(event.endDate) ? "ENDED" : "LIVE";
    
    return await Event.findByIdAndUpdate(
      eventId, 
      { status: targetStatus }, 
      { new: true, runValidators: false }
    );
  }

  static async toggleShowVoteCount(eventId: string, organizerId: string, userRole: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Permission check
    const isOwner = event.organizerId.toString() === organizerId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
    
    if (!isOwner && !isAdmin) {
      throw new AppError("Unauthorized", 403);
    }

    if (event.type !== "VOTING") {
      throw new AppError("Only voting events support vote count display", 400);
    }

    event.showVoteCount = !event.showVoteCount;
    await event.save();
    
    return {
      eventId,
      showVoteCount: event.showVoteCount,
      message: `Vote count display ${event.showVoteCount ? 'enabled' : 'disabled'}`
    };
  }
}