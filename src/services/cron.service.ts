import cron from 'node-cron';
import { Event } from '../models/Event.model';
import { Purchase } from '../models/Purchase.model';
import { PurchaseService } from './purchase.service';

export class CronService {
  static start() {
    // Run every minute to check event dates
    cron.schedule('* * * * *', async () => {
      try {
        await this.updateEventStatuses();
      } catch (error) {
        console.error('Cron job error:', error);
      }
    });

    // Clean up expired reservations every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        await this.cleanupExpiredReservations();
      } catch (error) {
        console.error('Reservation cleanup error:', error);
      }
    });
    
    console.log('Cron jobs started - checking event statuses and cleaning reservations');
  }

  static async updateEventStatuses() {
    const now = new Date();

    // 1. Move to NOMINATING if within nomination period (only if current status is PUBLISHED)
    await Event.updateMany(
      {
        status: 'PUBLISHED',
        nominationStartDate: { $lte: now },
        nominationEndDate: { $gt: now },
        startDate: { $gt: now } // Haven't started voting yet
      },
      { status: 'NOMINATING' }
    );

    // 2. Revert to PUBLISHED if nomination ended but voting hasn't started yet
    await Event.updateMany(
      {
        status: 'NOMINATING',
        nominationEndDate: { $lte: now },
        startDate: { $gt: now }
      },
      { status: 'PUBLISHED' }
    );

    // 3. Start events that have reached their start date (from PUBLISHED or NOMINATING)
    await Event.updateMany(
      {
        status: { $in: ['PUBLISHED', 'NOMINATING'] },
        startDate: { $lte: now },
        endDate: { $gt: now }
      },
      { status: 'LIVE' }
    );

    // 4. End live events that have passed their end date
    await Event.updateMany(
      {
        status: 'LIVE',
        endDate: { $lte: now }
      },
      { status: 'ENDED' }
    );
  }

  static async cleanupExpiredReservations() {
    const now = new Date();
    
    // Find expired purchases that are still pending
    const expiredPurchases = await Purchase.find({
      status: 'PENDING',
      type: 'TICKET',
      expiresAt: { $lte: now }
    });

    // Unreserve tickets for each expired purchase
    for (const purchase of expiredPurchases) {
      await PurchaseService.unreserveTickets(purchase);
      purchase.status = 'EXPIRED';
      await purchase.save();
    }

    if (expiredPurchases.length > 0) {
      console.log(`Cleaned up ${expiredPurchases.length} expired ticket reservations`);
    }
  }
}