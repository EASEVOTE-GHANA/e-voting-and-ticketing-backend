
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { User } from '../src/models/User.model';

dotenv.config({ path: '.env' });

async function resetPassword() {
  const uri = process.env.MONGO_URI || '';
  if (!uri) {
    console.error('MONGO_URI not found in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const email = 'brightamoako2026@gmail.com';
    const newPassword = 'ResetPass-Admin2026!';
    
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found.`);
      await mongoose.disconnect();
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    user.passwordHash = passwordHash;
    await user.save();

    console.log(`Password reset successful for ${email}`);
    process.exit(0);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetPassword();
