import { Nomination } from "../models/Nomination.model";
import { NominationForm } from "../models/NominationForm.model";
import { Event } from "../models/Event.model";
import { AppError } from "../middleware/error.middleware";
import { EventService } from "./event.service";
import { SMSService } from "./sms.service";
import { EmailService } from "./email.service";
import { NotificationService } from "./notification.service";
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

    // Organizers can configure the form regardless of whether public nominations are currently enabled or not

    const existingForm = await NominationForm.findOne({ eventId });
    if (existingForm) {
      existingForm.customFields = customFields || [];
      await existingForm.save();
      return existingForm;
    }

    const form = await NominationForm.create({ eventId, customFields: customFields || [] });
    return form;
  }

  static async getForm(eventId: string, userId?: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    const isOrganizer = userId && event.organizerId.toString() === userId;

    // 1. Check if public nominations are enabled for non-organizers
    if (!isOrganizer) {
      if (!event.allowPublicNominations) {
        return null; // Silently return null instead of 404
      }

      // 2. Enforce nomination dates for non-organizers
      const now = new Date();
      if (event.nominationStartDate && now < event.nominationStartDate) {
        return null;
      }
      if (event.nominationEndDate && now > event.nominationEndDate) {
        return null;
      }
    }

    // 3. Find the form configuration
    const form = await NominationForm.findOne({ eventId });
    if (!form) {
      // If no form exists and we're not the organizer, return null
      if (!isOrganizer) {
        return null;
      }
      // If organizer, we can return the event info with empty fields so they can see the "Add Question" UI
      return {
        eventId: event._id,
        eventTitle: event.title,
        categories: event.categories?.map(cat => ({ _id: cat._id, name: cat.name })) || [],
        customFields: []
      };
    }

    return {
      eventId: event._id,
      eventTitle: event.title,
      categories: event.categories?.map(cat => ({ _id: cat._id, name: cat.name })) || [],
      customFields: form.customFields || []
    };
  }

  static async submitNomination(eventId: string, nominationData: any) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Use unified validator to check event status and suspension
    const { PurchaseService } = require("./purchase.service");
    await PurchaseService.validateEventAvailability(event, "VOTING");

    if (!event.allowPublicNominations) {
      throw new AppError("Public nominations not enabled for this event", 400);
    }

    // Enforce nomination dates
    const now = new Date();
    if (event.nominationStartDate && now < event.nominationStartDate) {
      throw new AppError("Nominations have not started yet", 400);
    }
    if (event.nominationEndDate && now > event.nominationEndDate) {
      throw new AppError("Nominations have ended", 400);
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
      nominatorPhone: nominationData.nominatorPhone,
      email: nominationData.email
    });

    // Send immediate confirmation notifications
    try {
      const nomineePhone = nominationData.nomineePhone;
      const nomineeEmail = nominationData.email;
      
      let smsMessage = `Hi ${nominationData.nomineeName}! Your nomination for "${event.title}" in the "${category.name}" category has been received.`;
      
      if (event.whatsappGroupLink) {
        smsMessage += ` Joine the official candidates' WhatsApp group: ${event.whatsappGroupLink}`;
      }
      
      smsMessage += ` - EaseVote`;

      // Trigger SMS
      await SMSService.sendCustomMessage(nomineePhone, smsMessage);

      // Trigger Email
      if (nomineeEmail) {
        await EmailService.sendNominationEmail({
          to: nomineeEmail,
          nomineeName: nominationData.nomineeName,
          eventTitle: event.title,
          categoryName: category.name,
          whatsappLink: event.whatsappGroupLink
        });
      }
    } catch (error) {
      console.error('Failed to send nominee confirmation notifications:', error);
      // We don't throw here to avoid blocking a successful submission result
    }

    // Send in-app notification to organizer
    try {
      await NotificationService.create({
        userId: event.organizerId,
        title: `New Nomination: ${nominationData.nomineeName}`,
        message: `${nominationData.nomineeName} has been nominated for "${category.name}" in your event "${event.title}".`,
        type: "EVENT",
        metadata: {
          eventId: event._id,
          nominationId: nomination._id
        }
      });
    } catch (error) {
       console.error('Failed to send organizer in-app notification:', error);
    }

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

  static async getAllOrganizerNominations(organizerId: string, query?: any) {
    const events = await Event.find({ organizerId });
    const eventIds = events.map(e => e._id);

    const filter: any = { eventId: { $in: eventIds } };
    if (query?.status && query.status !== 'ALL') filter.status = query.status;

    const nominations = await Nomination.find(filter)
      .populate("eventId", "title eventCode nominationForm categories")
      .sort({ createdAt: -1 });

    return nominations.map((nom, idx) => {
        const n = nom.toObject();
        const eventData = n.eventId as any;
        
        // Resolve category name from the populated event categories
        let categoryName = "Unknown";
        if (eventData && eventData.categories) {
            const cat = eventData.categories.find((c: any) => c._id?.toString() === n.categoryId?.toString());
            if (cat) categoryName = cat.name;
        }

        return {
            ...n,
            id: n._id.toString() || `nom-${idx}`,
            event: eventData, // Standardize for frontend
            categoryName: categoryName,
        };
    });
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
    const nextNumber = EventService.getNextCandidateNumber(event);
    const candidateCode = EventService.generateCandidateCode(event.eventCode, nextNumber);
    const newCandidate = {
      name: nomination.nomineeName,
      email: nomination.email || "", // Match email from nomination
      phone: nomination.nomineePhone,
      imageUrl: nomination.photoUrl,
      description: nomination.bio,
      code: candidateCode,
      votes: 0
    };
    
    category.candidates.push(newCandidate);
    await event.save();
    
    nomination.status = "APPROVED";
    await nomination.save();
    
    // Send automated notifications
    try {
      // 1. Send welcome SMS
      let smsMessage = `Hello ${nomination.nomineeName}! You've been approved as a candidate for "${event.title}" in the "${category.name}" category. Good luck!`;
      if (event.whatsappGroupLink) {
        smsMessage += ` Join the candidates' WhatsApp group: ${event.whatsappGroupLink}`;
      }
      await SMSService.sendCustomMessage(nomination.nomineePhone, smsMessage);

      // 2. Send branded approval email
      if (nomination.email) {
        await EmailService.sendNominationOutcomeEmail({
          to: nomination.email,
          nomineeName: nomination.nomineeName,
          eventTitle: event.title,
          categoryName: category.name,
          status: "APPROVED",
          candidateCode: candidateCode,
          whatsappLink: event.whatsappGroupLink
        });
      }
    } catch (error) {
      console.error('Failed to send nomination approval notifications:', error);
    }

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

    // Send branded rejection email
    try {
      const category = event.categories?.find(cat => cat._id?.toString() === nomination.categoryId.toString());
      const categoryName = category ? category.name : "Unknown";

      if (nomination.email) {
        await EmailService.sendNominationOutcomeEmail({
            to: nomination.email,
            nomineeName: nomination.nomineeName,
            eventTitle: event.title,
            categoryName: categoryName,
            status: "REJECTED"
        });
      }
    } catch (error) {
      console.error('Failed to send nomination rejection email:', error);
    }

    return { message: "Nomination rejected", nomination };
  }
}
