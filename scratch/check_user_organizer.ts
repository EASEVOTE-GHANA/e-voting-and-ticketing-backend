
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User.model';

dotenv.config({ path: '.env' });

async function checkUser() {
  const uri = process.env.MONGO_URI || '';
  if (!uri) {
    console.error('MONGO_URI not found in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const email = 'john@example.com';
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found.`);
    } else {
      console.log(`User found:`);
      console.log(`ID: ${user._id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);
      console.log(`Status: ${user.status}`);
      console.log(`Business: ${user.businessName}`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
