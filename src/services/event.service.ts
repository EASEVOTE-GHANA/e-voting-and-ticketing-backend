import { Event, IEvent } from "../models/Event.model";
import { Purchase } from "../models/Purchase.model";
import { Ticket } from "../models/Ticket.model";
import { AppError } from "../middleware/error.middleware";
import { PaginationHelper } from "../utils/pagination.util";
import { CandidateService } from "./candidate.service";
import { CategoryService } from "./category.service";
import { TicketService } from "./ticket.service";
import { NotificationService } from "./notification.service";
import crypto from "crypto";
import mongoose from "mongoose";

export class EventService {
  static async generateEventCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excludes I and O because they could be confused with 0 and 1
    let code = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 1000) {
      code = '';
      for (let i = 0; i < 2; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existingEvent = await Event.findOne({ eventCode: code });
      if (!existingEvent) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new AppError("Could not generate a unique 2-character event code. The namespace might be full.", 500);
    }

    return code;
  }


  static generateCandidateCode(eventCode: string, nextNumber: number): string {
    return `${eventCode}${nextNumber}`;
  }

  static getNextCandidateNumber(event: any): number {
    let maxNumber = 0;
    event.categories?.forEach((cat: any) => {
      cat.candidates?.forEach((cand: any) => {
        if (cand.code && cand.code.startsWith(event.eventCode)) {
          const num = parseInt(cand.code.substring(event.eventCode.length), 10);
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      });
    });
    return maxNumber + 1;
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
    const eventCode = await this.generateEventCode();
    
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

    // Prevent certain updates based on status (whitelist nomination settings)
    if (event.status === "LIVE" && updateData.status !== "PAUSED") {
      const isOnlyUpdatingNominations = Object.keys(updateData).every(key => 
        ['allowPublicNominations', 'nominationStartDate', 'nominationEndDate'].includes(key)
      );
      
      if (!isOnlyUpdatingNominations) {
        throw new AppError("Cannot modify live event (except for nomination settings)", 400);
      }
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
      'imageUrl', 'imagePublicId', 'categories', 'ticketTypes', 'commissionRate'
    ];
    
    const filteredData: any = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        // Special restriction: commissionRate can only be set by admins
        if (field === 'commissionRate' && !isAdmin) {
          continue;
        }
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
    const isObjectId = /^[a-f\d]{24}$/i.test(eventId);
    const query = isObjectId
      ? { _id: eventId, isDeleted: false }
      : { eventCode: eventId.toUpperCase(), isDeleted: false };

    const event = await Event.findOne(query).populate("organizerId", "fullName email");
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
    const filteredEvent = this.filterEventResponse(event, userId, userRole);
    
    // Decorate with live ledger stats to eliminate cached/sync issues
    const eventsWithStats = await this.appendLedgerStats([filteredEvent]);
    return eventsWithStats[0];
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

    // Decorate with live ledger stats to eliminate cached/sync issues
    const decoratedEvents = await this.appendLedgerStats(filteredEvents);

    return PaginationHelper.formatResponse(decoratedEvents, total, page, limit);
  }

  static async getUpcomingEvents(query?: any) {
    let dbQuery: any = { 
      isDeleted: false,
      isPublic: true,
      status: { $in: ["PUBLISHED", "NOMINATING", "LIVE"] },
      endDate: { $gt: new Date() } // Hasn't ended yet
    };
    if (query?.type) dbQuery.type = query.type;

    const { page, limit, skip } = PaginationHelper.getParams(query || {});
    
    const [events, total] = await Promise.all([
      Event.find(dbQuery)
        .populate("organizerId", "fullName email")
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(dbQuery)
    ]);
    
    const filteredEvents = events.map(event => this.filterEventResponse(event));
    const decoratedEvents = await this.appendLedgerStats(filteredEvents);

    return PaginationHelper.formatResponse(decoratedEvents, total, page, limit);
  }

  static async getCompletedEvents(query?: any) {
    let dbQuery: any = { 
      isDeleted: false,
      isPublic: true,
      $or: [
        { status: "ENDED" },
        { endDate: { $lte: new Date() } }
      ]
    };
    if (query?.type) dbQuery.type = query.type;

    const { page, limit, skip } = PaginationHelper.getParams(query || {});
    
    const [events, total] = await Promise.all([
      Event.find(dbQuery)
        .populate("organizerId", "fullName email")
        .sort({ endDate: -1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(dbQuery)
    ]);
    
    const filteredEvents = events.map(event => this.filterEventResponse(event));
    const decoratedEvents = await this.appendLedgerStats(filteredEvents);

    return PaginationHelper.formatResponse(decoratedEvents, total, page, limit);
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

    // Decorate with live ledger stats to eliminate cached nonsense
    const eventsWithStats = await this.appendLedgerStats(filteredEvents);

    return PaginationHelper.formatResponse(eventsWithStats, total, page, limit);
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

    // Decorate with live ledger stats to eliminate cached nonsense
    const eventsWithStats = await this.appendLedgerStats(filteredEvents);

    return PaginationHelper.formatResponse(eventsWithStats, total, page, limit);
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

  static async permanentDeleteEvent(eventId: string, userId: string, userRole: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Permission check: Must be owner or admin/super_admin
    const isOwner = event.organizerId.toString() === userId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
    const isSuperAdmin = userRole === "SUPER_ADMIN";

    if (!isAdmin && !isOwner) {
      throw new AppError("Unauthorized to permanently delete this event", 403);
    }



    await Event.findByIdAndDelete(eventId);

    return { message: "Event permanently deleted" };
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

    const now = new Date();
    // Use votingStartDate if set, otherwise fall back to startDate
    const effectiveStartTime = event.votingStartDate
      ? new Date(event.votingStartDate)
      : new Date(event.startDate);

    // If the voting/start time has already passed, go live immediately
    if (effectiveStartTime <= now) {
      event.status = "LIVE";
    } else {
      event.status = "PUBLISHED";
    }

    await event.save();

    await NotificationService.create({
      userId: organizerId,
      title: event.status === "LIVE" ? "Event Is Live!" : "Event Published",
      message:
        event.status === "LIVE"
          ? `Your event "${event.title}" is now live!`
          : `Your event "${event.title}" has been published and will go live automatically at the scheduled voting start time.`,
      type: "EVENT",
      metadata: { eventId: event._id },
    });

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
      { returnDocument: 'after', runValidators: false } // Bypasses full validation for emergency status changes
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
      { returnDocument: 'after', runValidators: false }
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

  /**
   * Appends live ledger-derived statistics to a list of events.
   * Eliminates reliance on cached counters by aggregating the Purchase collection.
   */
  static async appendLedgerStats(filteredEvents: any[]) {
    if (!filteredEvents || filteredEvents.length === 0) return filteredEvents;

    const eventIds = filteredEvents.map(e => e._id || e.id);

    // 1. Aggregate revenue, votes, and tickets from Purchases
    const stats = await Purchase.aggregate([
      { 
        $match: { 
          eventId: { $in: eventIds }, 
          // Match any status that essentially means "Paid"
          status: { $regex: /paid|successful|completed/i }
        } 
      },
      { 
        $group: { 
          _id: { eventId: "$eventId", type: "$type" },
          revenue: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } },
          votes: { $sum: { $ifNull: ["$voteCount", 0] } },
          tickets: { $sum: { $ifNull: ["$ticketQuantity", 0] } }
        } 
      },
      {
        $group: {
          _id: "$_id.eventId",
          totalRevenue: { $sum: "$revenue" },
          totalVotes: { $sum: "$votes" },
          totalTickets: { $sum: "$tickets" }
        }
      }
    ]);

    // 1.5 Aggregate candidate-level votes for VOTING events
    const candidateAgg = await Purchase.aggregate([
      { 
        $match: { 
          eventId: { $in: eventIds }, 
          type: "VOTE",
          status: { $regex: /paid|successful|completed/i }
        } 
      },
      { 
        $group: { 
          _id: { eventId: "$eventId", candidateId: "$candidateId" },
          votes: { $sum: { $ifNull: ["$voteCount", 0] } }
        } 
      }
    ]);

    // 2. Map stats back to events
    return filteredEvents.map(event => {
      const eventIdStr = (event._id || event.id).toString();
      
      // Top-level ledger stats
      const ledger = stats.find(s => s._id?.toString() === eventIdStr) || {
        totalRevenue: 0,
        totalVotes: 0,
        totalTickets: 0
      };

      // Enrich categories and candidates if present
      let enrichedCategories = event.categories || [];
      if (event.type === "VOTING" || event.type === "HYBRID") {
        enrichedCategories = enrichedCategories.map((category: any) => {
          let categoryTotalVotes = 0;
          let maxVotes = 0;
          const candidates = (category.candidates || []).map((candidate: any) => {
            const candidateIdStr = (candidate._id || candidate.id)?.toString();
            const realVotes = candidateAgg.find(
              c => c._id?.eventId?.toString() === eventIdStr && 
                   c._id?.candidateId?.toString() === candidateIdStr
            )?.votes || 0;
            
            categoryTotalVotes += realVotes;
            if (realVotes > maxVotes) maxVotes = realVotes;
            
            return {
              ...candidate,
              votes: realVotes,
              voteCount: realVotes // For frontend compatibility
            };
          });

          return {
            ...category,
            candidates,
            votes: categoryTotalVotes,
            totalVotes: categoryTotalVotes,
            maxVotes: maxVotes
          };
        });
      }

      return {
        ...event,
        categories: enrichedCategories,
        ledgerStats: {
          revenue: ledger.totalRevenue,
          votes: ledger.totalVotes,
          ticketsSold: ledger.totalTickets
        }
      };
    });
  }

  static async setEventCommission(eventId: string, commissionRate: number, userRole: string) {
    if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
      throw new AppError("Unauthorized: Only admins can set custom commission rates", 403);
    }

    if (commissionRate < 0 || commissionRate > 100) {
      throw new AppError("Commission rate must be between 0 and 100", 400);
    }

    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    event.commissionRate = commissionRate;
    await event.save();

    return { 
      message: "Event commission rate updated successfully",
      eventId,
      commissionRate 
    };
  }
}
