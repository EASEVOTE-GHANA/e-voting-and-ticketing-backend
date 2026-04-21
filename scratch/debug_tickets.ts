import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Use real models if possible, otherwise any
const purchaseSchema = new mongoose.Schema({}, { strict: false });
const eventSchema = new mongoose.Schema({}, { strict: false });
const ticketSchema = new mongoose.Schema({}, { strict: false });

async function debugDiscrepancy() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("Connected to MongoDB");

    const Purchase = mongoose.model("Purchase", purchaseSchema);
    const Event = mongoose.model("Event", eventSchema);
    const Ticket = mongoose.model("Ticket", ticketSchema);

    // 1. Get events with sold tickets
    const events = await Event.find({ totalTicketsSold: { $gt: 0 } });
    console.log(`Events with recorded sales: ${events.length}`);

    for (const event of events) {
      const e = event as any;
      console.log(`Event: ${e.title} (ID: ${e._id})`);
      console.log(`  totalTicketsSold: ${e.totalTicketsSold}`);
      
      const ticketTypes = e.ticketTypes || [];
      ticketTypes.forEach((tt: any) => {
        console.log(`    Ticket Type: ${tt.name}, Sold: ${tt.sold}, Reserved: ${tt.reserved}`);
      });

      const actualTicketCount = await Ticket.countDocuments({ eventId: e._id });
      console.log(`  Actual Ticket documents in DB: ${actualTicketCount}`);

      const paidPurchases = await Purchase.find({ eventId: e._id, status: "PAID", type: "TICKET" });
      console.log(`  PAID Purchase documents: ${paidPurchases.length}`);

      for (const p of paidPurchases) {
        const purchase = p as any;
        const ticketsForPurchase = await Ticket.countDocuments({ purchaseId: purchase._id });
        console.log(`    Purchase ${purchase.paymentReference} (Ref: ${purchase._id}): ${purchase.ticketQuantity} expected, ${ticketsForPurchase} found`);
        if (ticketsForPurchase === 0 && purchase.ticketQuantity > 0) {
          console.log(`    ⚠️ DISCREPANCY DETECTED for purchase ${purchase.paymentReference}`);
        }
      }
    }

    // Also check if there are any tickets without event references or anything strange
    const totalTickets = await Ticket.countDocuments();
    console.log(`\nTotal Ticket documents in entire DB: ${totalTickets}`);

  } catch (err) {
    console.error("Debug script failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

debugDiscrepancy();
