import { User } from "../models/User.model";
import { hashPassword, validatePassword } from "../utils/password";
import { AppError } from "../middleware/error.middleware";
import { EmailService } from "./email.service";
import { TokenService } from "./token.service";
import { NotificationService } from "./notification.service";

export class AdminService {
  static async inviteAdmin(adminData: {
    fullName: string;
    email: string;
  }) {
    const { fullName, email } = adminData;

    const exists = await User.findOne({ email });
    if (exists) {
      throw new AppError("Email already exists", 409);
    }

    // Create user with PENDING status and placeholder password
    const user = await User.create({
      fullName,
      email,
      passwordHash: "INVITED_PENDING_PASSWORD", // Placeholder
      role: "ADMIN",
      status: "PENDING",
      emailVerified: true
    });

    const token = await TokenService.createAdminInvitationToken(user._id.toString());
    await EmailService.sendAdminInvitationEmail(email, token);

    return { message: "Invitation email sent successfully" };
  }

  static async acceptInvitation(token: string, password: string) {
    if (!validatePassword(password)) {
      throw new AppError("Weak password", 400);
    }

    const tokenDoc = await TokenService.validateToken(token, "ADMIN_INVITATION");

    const user = await User.findById(tokenDoc.userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.status !== "PENDING") {
      throw new AppError("Invitation already accepted or account active", 400);
    }

    user.passwordHash = await hashPassword(password);
    user.status = "ACTIVE";
    await user.save();

    await TokenService.markTokenAsUsed(tokenDoc._id.toString());

    return { message: "Invitation accepted successfully. You can now login." };
  }

  static async approveOrganizer(id: string) {
    const user = await User.findById(id);
    if (!user || user.role !== "ORGANIZER") {
      throw new AppError("Organizer not found", 404);
    }

    user.status = "ACTIVE";
    await user.save();

    await NotificationService.create({
      userId: user._id,
      title: "Account Approved",
      message: "Congratulations! Your organizer account has been approved. You can now start creating and publishing events.",
      type: "SYSTEM"
    });

    return { message: "Organizer approved" };
  }
}