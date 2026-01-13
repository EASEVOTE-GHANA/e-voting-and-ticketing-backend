import { Event } from "../models/Event.model";
import { AppError } from "../middleware/error.middleware";
import { EventService } from "./event.service";
import crypto from "crypto";

export class CandidateService {
  static generateCandidateCode(): string {
    return crypto.randomBytes(2).toString("hex").toUpperCase();
  }

  static async addCandidate(eventId: string, categoryId: string, candidateData: any, organizerId: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== organizerId) {
      throw new AppError("Unauthorized", 403);
    }

    const category = event.categories?.find(cat => cat._id?.toString() === categoryId);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    const candidateCode = this.generateCandidateCode();
    category.candidates.push({
      ...candidateData,
      code: candidateCode
    });

    await event.save();
    return EventService.filterEventResponse(event, organizerId, undefined);
  }

  static async getCandidate(eventId: string, candidateCode: string, userId?: string, userRole?: string) {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    const isPubliclyAccessible = ["PUBLISHED", "LIVE"].includes(event.status) && event.isPublic;
    
    if (!isPubliclyAccessible) {
      if (!userId || !userRole) {
        throw new AppError("Authentication required", 401);
      }
      
      const isOwner = event.organizerId.toString() === userId;
      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
      
      if (!isOwner && !isAdmin) {
        throw new AppError("Access denied", 403);
      }
    }
    
    // Apply vote display rules
    const filteredEvent = EventService.filterEventResponse(event);
    
    for (const category of filteredEvent.categories || []) {
      const candidate = category.candidates.find((cand: any) => cand.code === candidateCode);
      if (candidate) {
        return candidate;
      }
    }
    
    throw new AppError("Candidate not found", 404);
  }

  static async updateCandidate(eventId: string, categoryId: string, candidateId: string, updateData: any, userId: string, userRole: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    const isOwner = event.organizerId.toString() === userId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
    
    if (!isOwner && !isAdmin) {
      throw new AppError("Access denied", 403);
    }

    const category = event.categories?.find(cat => cat._id?.toString() === categoryId);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    const candidate = category.candidates.find(cand => cand._id?.toString() === candidateId);
    if (!candidate) {
      throw new AppError("Candidate not found", 404);
    }

    Object.assign(candidate, updateData);
    await event.save();
    return EventService.filterEventResponse(event, userId, userRole);
  }

  static async deleteCandidate(eventId: string, categoryId: string, candidateId: string, userId: string, userRole: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    const isOwner = event.organizerId.toString() === userId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
    
    if (!isOwner && !isAdmin) {
      throw new AppError("Access denied", 403);
    }

    const category = event.categories?.find(cat => cat._id?.toString() === categoryId);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    category.candidates = category.candidates.filter(cand => cand._id?.toString() !== candidateId);
    await event.save();
    return { message: "Candidate deleted successfully" };
  }
}