import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../src/models/User.model";
import { hashPassword } from "../src/utils/password";

dotenv.config();

const createSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("MongoDB connected");

    const email = "info@easevotegh.com";
    const plainPassword = "Easevote@2026";
    
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      console.log("User already exists, updating role and password...");
      user.role = "SUPER_ADMIN";
      user.passwordHash = await hashPassword(plainPassword);
      user.status = "ACTIVE";
      user.emailVerified = true;
      if (!user.fullName) user.fullName = "Super Admin";
      await user.save();
      console.log("User updated to SUPER_ADMIN successfully.");
    } else {
      console.log("Creating new SUPER_ADMIN user...");
      const passwordHash = await hashPassword(plainPassword);
      user = new User({
        fullName: "Super Admin",
        email,
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerified: true
      });
      await user.save();
      console.log("Super Admin created successfully.");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error creating superadmin", error);
    process.exit(1);
  }
};

createSuperAdmin();
