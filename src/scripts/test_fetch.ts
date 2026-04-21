import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { TicketService } from '../services/ticket.service';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const EVENT_ID = '696623a1b52a946e1dde6ec7'; 
const USER_ID = '67b3691d09e3e7f91751d7c4'; // Needs a valid user ID who owns the event

async function run() {
  try {
    console.log('Connecting...');
    await mongoose.connect(process.env.MONGO_URI!);
    
    // We need to find the organizer ID of this event to use a valid USER_ID
    const Event = mongoose.model('Event');
    const event = await Event.findById(EVENT_ID);
    if (!event) throw new Error('Event not found');
    const organizerId = event.organizerId.toString();
    console.log('Organizer ID:', organizerId);

    const result = await TicketService.getEventTickets(EVENT_ID, organizerId, { page: '1', limit: '10', status: 'ALL' });
    console.log('Tickets found:', result.data.length);
    console.log('Total items:', result.pagination.totalItems);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
