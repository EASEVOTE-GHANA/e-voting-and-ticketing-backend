import { User } from "../models/User.model";
import { hashPassword, comparePassword, validatePassword } from "../utils/password";
import { signTokens } from "../utils/jwt";
import { AppError } from "../middleware/error.middleware";
import { EmailService } from "./email.service";
import { TokenService } from "./token.service";

export class AuthService {
  static async register(userData: {
    fullName: string;
    businessName: string;
    email: string;
    phone: string;
    password: string;
  }) {
    const { fullName, businessName, email, phone, password } = userData;

    if (!validatePassword(password)) {
      throw new AppError("Weak password", 400);
    }

    const exists = await User.findOne({ email });
    if (exists) {
      throw new AppError("Email already in use", 409);
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      fullName,
      businessName,
      email,
      phone,
      passwordHash
    });

    console.log("User created, generating verification token...");
    const verificationToken = await TokenService.createEmailVerificationToken(user._id.toString());
    console.log("Verification token created:", verificationToken);

    console.log("Sending verification email to:", email);
    await EmailService.sendVerificationEmail(email, verificationToken);
    console.log("Verification email process completed");

    return { message: "Registration successful. Please check your email to verify your account." };
  }

  static async verifyEmail(token: string) {
    const tokenDoc = await TokenService.validateToken(token, "EMAIL_VERIFICATION");

    const user = await User.findById(tokenDoc.userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    user.emailVerified = true;
    await user.save();

    await TokenService.markTokenAsUsed(tokenDoc._id.toString());

    return { message: "Email verified successfully" };
  }

  static async login(credentials: { email: string; password: string }) {
    const { email, password } = credentials;

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    if (!user.emailVerified) {
      const verificationToken = await TokenService.createEmailVerificationToken(user._id.toString());
      await EmailService.sendVerificationEmail(user.email, verificationToken);
      throw new AppError("Please verify your email to login. A new verification link has been sent to your email.", 401);
    }

    if (user.status === "DISABLED") {
      throw new AppError("Your account has been disabled. Please contact support.", 403);
    }

    const match = await comparePassword(password, user.passwordHash);
    if (!match) {
      throw new AppError("Invalid credentials", 401);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = signTokens(user);
    const userObj = user.toObject() as any;
    const { passwordHash, ...userWithoutPassword } = userObj;

    let message = "Login successful";
    if (user.status === "PENDING") {
      message = "Your organizer account is pending admin approval.";
    }

    return { ...tokens, user: userWithoutPassword, message };
  }

  static async forgotPassword(email: string) {
    const user = await User.findOne({ email });
    if (!user) {
      return { message: "If the email exists, a reset link has been sent." };
    }

    const resetToken = await TokenService.createPasswordResetToken(user._id.toString());
    await EmailService.sendPasswordResetEmail(email, resetToken);

    return { message: "If the email exists, a reset link has been sent." };
  }

  static async resetPassword(token: string, newPassword: string) {
    if (!validatePassword(newPassword)) {
      throw new AppError("Weak password", 400);
    }

    const tokenDoc = await TokenService.validateToken(token, "PASSWORD_RESET");

    const user = await User.findById(tokenDoc.userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    await TokenService.markTokenAsUsed(tokenDoc._id.toString());

    return { message: "Password reset successfully" };
  }
}