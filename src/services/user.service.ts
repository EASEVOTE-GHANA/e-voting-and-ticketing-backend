import { User } from "../models/User.model";
import { Event } from "../models/Event.model";
import { Payout } from "../models/Payout.model";
import { PayoutService } from "./payout.service";
import { EventService } from "./event.service";
import { hashPassword, validatePassword } from "../utils/password";
import { AppError } from "../middleware/error.middleware";
import { Purchase } from "../models/Purchase.model";

export class UserService {
  static async getUser(id: string) {
    const user = await User.findById(id).select("-passwordHash").lean();
    if (!user || (user as any).isDeleted) {
      throw new AppError("User not found or deleted", 404);
    }

    if (user.role === "ORGANIZER") {
      const [events, payouts, balanceData] = await Promise.all([
        Event.find({ organizerId: id, isDeleted: false }).sort({ createdAt: -1 }),
        Payout.find({ organizerId: id }).sort({ createdAt: -1 }).limit(10),
        PayoutService.getOrganizerBalance(id)
      ]);

      // Decorate with live ledger stats to eliminate cached nonsense
      const eventsWithStats = await EventService.appendLedgerStats(events.map(e => e.toObject ? e.toObject() : e));

      return {
        ...user,
        events: eventsWithStats,
        payouts,
        balanceData
      };
    }

    return user;
  }

  static async getAllUsers(
    currentUserRole: string, 
    includeDeleted: boolean = false, 
    withStats: boolean = false
  ) {
    let filter: any = {};
    
    if (!includeDeleted) {
      filter.isDeleted = { $ne: true };
    }

    if (currentUserRole === "ADMIN") {
      filter.role = "ORGANIZER";
    }
    
    const users = await User.find(filter).select("-passwordHash").lean();

    if (withStats && currentUserRole !== "ORGANIZER") {
      // Enrichment loop (Simplified for performance, ideally would be a single aggregation pipeline)
      return await Promise.all(users.map(async (user: any) => {
        const organizerEvents = await Event.find({ organizerId: user._id, isDeleted: false }).select("_id");
        const eventIds = organizerEvents.map(e => e._id);

        const [eventsCount, ledgerStats, balanceData] = await Promise.all([
          Promise.resolve(organizerEvents.length),
          Purchase.aggregate([
            { 
              $match: { 
                eventId: { $in: eventIds }, 
                status: { $regex: /paid|successful|completed/i } 
              } 
            },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ]),
          PayoutService.getOrganizerBalance(user._id.toString())
        ]);

        return {
          ...user,
          eventsCount,
          totalRevenue: ledgerStats[0]?.total || 0,
          balance: balanceData.availableBalance
        };
      }));
    }
    
    return users;
  }

  static async updateUser(
    id: string, 
    updateData: any, 
    currentUserId: string, 
    currentUserRole: string
  ) {
    const user = await User.findById(id);
    if (!user || user.isDeleted) {
      throw new AppError("User not found or already deleted", 404);
    }

    // Permission check
    if (currentUserRole === "ORGANIZER" && id !== currentUserId) {
      throw new AppError("Unauthorized", 403);
    }
    if (currentUserRole === "ADMIN" && id !== currentUserId && user.role !== "ORGANIZER") {
      throw new AppError("Unauthorized", 403);
    }

    // Remove password from update data
    const { password, passwordHash, ...cleanUpdateData } = updateData as any;

    Object.assign(user, cleanUpdateData);
    await user.save();

    const userObj = user.toObject() as any;
    const { passwordHash: _, ...userWithoutPassword } = userObj;
    return userWithoutPassword;
  }

  static async updatePassword(
    id: string,
    newPassword: string,
    currentUserId: string,
    currentUserRole: string
  ) {
    if (!validatePassword(newPassword)) {
      throw new AppError("Weak password", 400);
    }

    const user = await User.findById(id);
    if (!user || user.isDeleted) {
      throw new AppError("User not found or already deleted", 404);
    }

    // Permission check
    if (currentUserRole !== "SUPER_ADMIN" && id !== currentUserId) {
      throw new AppError("Unauthorized", 403);
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    return { message: "Password updated successfully" };
  }

  static async deleteUser(id: string, currentUserRole: string) {
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(currentUserRole);
    if (!isAdmin) {
      throw new AppError("Unauthorized", 403);
    }

    const user = await User.findById(id);
    if (!user || user.isDeleted) {
      throw new AppError("User not found or already deleted", 404);
    }

    if (user.role === "SUPER_ADMIN") {
      throw new AppError("Cannot delete super admin", 403);
    }

    // Admins can only delete organizers
    if (currentUserRole === "ADMIN" && user.role !== "ORGANIZER") {
      throw new AppError("Admins can only delete organizers", 403);
    }

    const hasEvents = await Event.exists({ organizerId: id, isDeleted: false });
    if (hasEvents && currentUserRole !== "SUPER_ADMIN") {
      throw new AppError("Only super admins can delete organizers with active events", 403);
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.status = "DISABLED";
    await user.save();
    
    try {
      const { EmailService } = await import("./email.service");
      await EmailService.sendAccountDeletedEmail(user.email, user.fullName);
    } catch (err) {
      console.error("[UserService] Failed to send account deletion email:", err);
    }
    
    return { message: "User soft-deleted successfully" };
  }

  static async restoreUser(id: string, currentUserRole: string) {
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(currentUserRole);
    if (!isAdmin) {
      throw new AppError("Unauthorized", 403);
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (!user.isDeleted) {
      return { message: "User is not deleted" };
    }

    // Admins can only restore organizers
    if (currentUserRole === "ADMIN" && user.role !== "ORGANIZER") {
      throw new AppError("Admins can only restore organizers", 403);
    }

    user.isDeleted = false;
    user.deletedAt = undefined;
    
    if (user.passwordHash === "INVITED_PENDING_PASSWORD" || (!user.emailVerified && user.role === "ORGANIZER")) {
      user.status = "PENDING";
    } else {
      user.status = "ACTIVE";
    }
    await user.save();

    try {
      const { EmailService } = await import("./email.service");
      await EmailService.sendAccountRestoredEmail(user.email, user.fullName);
    } catch (err) {
      console.error("[UserService] Failed to send account restoration email:", err);
    }

    return { message: "User restored successfully" };
  }

  static async permanentDeleteUser(id: string, currentUserRole: string) {
    if (currentUserRole !== "SUPER_ADMIN") {
      throw new AppError("Only super admins can permanently delete users", 403);
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.role === "SUPER_ADMIN") {
      throw new AppError("Cannot permanently delete a super admin", 403);
    }

    await User.findByIdAndDelete(id);

    return { message: "User permanently deleted" };
  }

  static async resendVerificationEmail(id: string, currentUserRole: string) {
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(currentUserRole);
    if (!isAdmin) {
      throw new AppError("Unauthorized", 403);
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.isDeleted) {
      throw new AppError("Cannot resend verification for deleted user", 400);
    }

    if (user.emailVerified) {
      throw new AppError("Email is already verified", 400);
    }

    const { TokenService } = await import("./token.service");
    const { EmailService } = await import("./email.service");

    const verificationToken = await TokenService.createEmailVerificationToken(user._id.toString());
    await EmailService.sendVerificationEmail(user.email, verificationToken);

    return { message: "Verification email resent successfully" };
  }
}