import { Event } from "../models/Event.model";
import { AppError } from "../middleware/error.middleware";
import { EventService } from "./event.service";
import { SMSService } from "./sms.service";
import crypto from "crypto";

export class CandidateService {

  static async sendCandidateWelcomeSMS(candidateName: string, candidatePhone: string, eventTitle: string, categoryName: string, whatsappGroupLink?: string) {
    try {
      let message = `Hello ${candidateName}! You've been added as a candidate for "${eventTitle}" in the "${categoryName}" category. Good luck!`;

      if (whatsappGroupLink) {
        message += ` Join the candidates' WhatsApp group: ${whatsappGroupLink}`;
      }

      await SMSService.sendCustomMessage(candidatePhone, message);
    } catch (error) {
      console.error('Failed to send candidate welcome SMS:', error);
    }
  }

  static async addCandidate(eventId: string, categoryId: string, candidateData: any, organizerId: string, userRole?: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    const isOwner = event.organizerId.toString() === organizerId;
    const isAdmin = userRole && ["ADMIN", "SUPER_ADMIN"].includes(userRole);

    if (!isOwner && !isAdmin) {
      throw new AppError("Unauthorized", 403);
    }

    const category = event.categories?.find(cat => cat._id?.toString() === categoryId);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    const totalCandidates = event.categories?.reduce((acc, cat) => acc + (cat.candidates?.length || 0), 0) || 0;
    const candidateCode = EventService.generateCandidateCode(event.eventCode, totalCandidates + 1);
    const { code: _ignored, ...safeData } = candidateData;
    const newCandidate = {
      ...safeData,
      code: candidateCode
    };

    category.candidates.push(newCandidate);
    await event.save();

    // Send welcome SMS to candidate
    if (candidateData.phone) {
      await this.sendCandidateWelcomeSMS(
        candidateData.name,
        candidateData.phone,
        event.title,
        category.name,
        event.whatsappGroupLink
      );
    }

    // Send welcome email to candidate
    if (candidateData.email) {
      try {
        const { EmailService } = await import("./email.service");
        await EmailService.sendNominationOutcomeEmail({
          to: candidateData.email,
          nomineeName: candidateData.name,
          eventTitle: event.title,
          categoryName: category.name,
          status: "APPROVED",
          candidateCode: candidateCode,
          whatsappLink: event.whatsappGroupLink
        });
      } catch (error) {
        console.error('Failed to send candidate welcome email:', error);
      }
    }

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