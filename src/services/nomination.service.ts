import { Nomination } from "../models/Nomination.model";
import { NominationForm } from "../models/NominationForm.model";
import { Event } from "../models/Event.model";
import { AppError } from "../middleware/error.middleware";
import { EventService } from "./event.service";
import { PaginationHelper } from "../utils/pagination.util";

export class NominationService {
  static async createForm(eventId: string, customFields: any[], organizerId: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== organizerId) {
      throw new AppError("Unauthorized", 403);
    }

    if (event.type !== "VOTING") {
      throw new AppError("Only voting events support nominations", 400);
    }

    if (!event.allowPublicNominations) {
      throw new AppError("Public nominations not enabled for this event", 400);
    }

    const existingForm = await NominationForm.findOne({ eventId });
    if (existingForm) {
      existingForm.customFields = customFields || [];
      await existingForm.save();
      return existingForm;
    }

    const form = await NominationForm.create({ eventId, customFields: customFields || [] });
    return form;
  }

  static async getForm(eventId: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (!event.allowPublicNominations) {
      throw new AppError("Public nominations not enabled for this event", 400);
    }

    const form = await NominationForm.findOne({ eventId });
    if (!form) {
      throw new AppError("Nomination form not found", 404);
    }

    return {
      eventId: event._id,
      eventTitle: event.title,
      categories: event.categories?.map(cat => ({ _id: cat._id, name: cat.name })) || [],
      customFields: form.customFields
    };
  }

  static async submitNomination(eventId: string, nominationData: any) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (!event.allowPublicNominations) {
      throw new AppError("Public nominations not enabled for this event", 400);
    }

    const category = event.categories?.find(cat => cat._id?.toString() === nominationData.categoryId);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    const nomination = await Nomination.create({
      eventId,
      categoryId: nominationData.categoryId,
      nomineeName: nominationData.nomineeName,
      nomineePhone: nominationData.nomineePhone,
      bio: nominationData.bio,
      photoUrl: nominationData.photoUrl,
      customFields: nominationData.customFields,
      nominatorName: nominationData.nominatorName,
      nominatorPhone: nominationData.nominatorPhone
    });

    return nomination;
  }

  static async getNominations(eventId: string, organizerId: string, query?: any) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== organizerId) {
      throw new AppError("Unauthorized", 403);
    }

    const { page, limit, skip } = PaginationHelper.getParams(query || {});
    
    const filter: any = { eventId };
    if (query?.status) filter.status = query.status;
    if (query?.categoryId) filter.categoryId = query.categoryId;

    const [nominations, total] = await Promise.all([
      Nomination.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Nomination.countDocuments(filter)
    ]);

    return PaginationHelper.formatResponse(nominations, total, page, limit);
  }

  static async approveNomination(nominationId: string, organizerId: string) {
    const nomination = await Nomination.findById(nominationId);
    if (!nomination) {
      throw new AppError("Nomination not found", 404);
    }

    const event = await Event.findById(nomination.eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== organizerId) {
      throw new AppError("Unauthorized", 403);
    }

    if (nomination.status !== "PENDING") {
      throw new AppError("Only pending nominations can be approved", 400);
    }

    const category = event.categories?.find(cat => cat._id?.toString() === nomination.categoryId.toString());
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    // Check if candidate already exists in this category
    const existingCandidate = category.candidates.find(c => c.phone === nomination.nomineePhone);
    if (existingCandidate) {
      nomination.status = "APPROVED";
      await nomination.save();
      return { message: "Nomination approved (candidate already exists)", nomination };
    }

    // Create new candidate
    const candidateCode = EventService.generateCandidateCode();
    category.candidates.push({
      name: nomination.nomineeName,
      email: "",
      phone: nomination.nomineePhone,
      imageUrl: nomination.photoUrl,
      description: nomination.bio,
      code: candidateCode,
      votes: 0
    });

    await event.save();
    nomination.status = "APPROVED";
    await nomination.save();

    return { message: "Nomination approved and candidate created", nomination };
  }

  static async rejectNomination(nominationId: string, organizerId: string) {
    const nomination = await Nomination.findById(nominationId);
    if (!nomination) {
      throw new AppError("Nomination not found", 404);
    }

    const event = await Event.findById(nomination.eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== organizerId) {
      throw new AppError("Unauthorized", 403);
    }

    if (nomination.status !== "PENDING") {
      throw new AppError("Only pending nominations can be rejected", 400);
    }

    nomination.status = "REJECTED";
    await nomination.save();

    return { message: "Nomination rejected", nomination };
  }
}
