import mongoose from 'mongoose';
import { MigrationService } from '../services/migration.service';

async function runMigration() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/easevote');
    console.log('Connected to MongoDB');

    // Run migration
    await MigrationService.addVotingFieldsToExistingEvents();
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

runMigration();