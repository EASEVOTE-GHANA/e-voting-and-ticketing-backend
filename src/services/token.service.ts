import crypto from "crypto";
import { Token } from "../models/Token.model";
import { AppError } from "../middleware/error.middleware";

export class TokenService {
  static generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  static async createEmailVerificationToken(userId: string) {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await Token.create({
      userId,
      token,
      type: "EMAIL_VERIFICATION",
      expiresAt
    });

    return token;
  }

  static async createPasswordResetToken(userId: string) {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await Token.create({
      userId,
      token,
      type: "PASSWORD_RESET",
      expiresAt
    });
    return token;
  }

  static async createAdminInvitationToken(userId: string) {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    await Token.create({
      userId,
      token,
      type: "ADMIN_INVITATION",
      expiresAt
    });

    return token;
  }

  static async validateToken(token: string, type: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "ADMIN_INVITATION") {
    const tokenDoc = await Token.findOne({
      token,
      type,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!tokenDoc) {
      throw new AppError("Invalid or expired token", 400);
    }

    return tokenDoc;
  }

  static async markTokenAsUsed(tokenId: string) {
    await Token.findByIdAndUpdate(tokenId, { used: true });
  }
}