import { Event } from "../models/Event.model";
import { AppError } from "../middleware/error.middleware";
import { EventService } from "./event.service";

export class CategoryService {
  static async addCategory(eventId: string, categoryData: any, organizerId: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (event.organizerId.toString() !== organizerId) {
      throw new AppError("Unauthorized", 403);
    }

    if (event.type !== "VOTING") {
      throw new AppError("Categories can only be added to voting events", 400);
    }

    event.categories = event.categories || [];
    event.categories.push(categoryData);
    await event.save();
    return EventService.filterEventResponse(event, organizerId, undefined);
  }

  static async getEventCategories(eventId: string, userId?: string, userRole?: string) {
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
    return filteredEvent.categories || [];
  }

  static async getCategoryWithCandidates(eventId: string, categoryId: string, userId?: string, userRole?: string) {
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
    const category = filteredEvent.categories?.find((cat: any) => cat._id?.toString() === categoryId);
    if (!category) {
      throw new AppError("Category not found", 404);
    }
    
    return category;
  }

  static async updateCategory(eventId: string, categoryId: string, updateData: any, userId: string, userRole: string) {
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

    Object.assign(category, updateData);
    await event.save();
    return EventService.filterEventResponse(event, userId, userRole);
  }

  static async deleteCategory(eventId: string, categoryId: string, userId: string, userRole: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    const isOwner = event.organizerId.toString() === userId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
    
    if (!isOwner && !isAdmin) {
      throw new AppError("Access denied", 403);
    }

    event.categories = event.categories?.filter(cat => cat._id?.toString() !== categoryId) || [];
    await event.save();
    return { message: "Category deleted successfully" };
  }
}