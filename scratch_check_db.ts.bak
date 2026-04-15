import mongoose from 'mongoose';
import { Purchase } from './src/models/Purchase.model';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    const total = await Purchase.countDocuments();
    const statuses = await Purchase.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const volumes = await Purchase.aggregate([
        { $group: { _id: "$status", totalVolume: { $sum: "$amount" } } }
    ]);
    console.log('Total Purchases:', total);
    console.log('Statuses:', JSON.stringify(statuses, null, 2));
    console.log('Volumes:', JSON.stringify(volumes, null, 2));
    await mongoose.disconnect();
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}
check();
