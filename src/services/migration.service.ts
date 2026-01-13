import { Event } from '../models/Event.model';

export class MigrationService {
  static async addVotingFieldsToExistingEvents() {
    try {
      const votingStartTime = new Date('2026-01-13T23:15:00');
      const votingEndTime = new Date('2026-04-26T12:00:00');

      const result = await Event.updateMany(
        {
          type: 'VOTING',
          $or: [
            { votingStartTime: { $exists: false } },
            { votingEndTime: { $exists: false } },
            { liveResults: { $exists: false } },
            { showVoteCount: { $exists: false } }
          ]
        },
        {
          $set: {
            votingStartTime,
            votingEndTime,
            liveResults: true,
            showVoteCount: true
          }
        }
      );

      console.log(`Migration completed: ${result.modifiedCount} voting events updated`);
      return result;
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
}
