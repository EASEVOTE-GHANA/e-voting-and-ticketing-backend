import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Define minimal schemas for reconstruction
const purchaseSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  type: String,
  status: String,
  source: String,
  paymentReference: String,
  amount: Number,
  ticketTypeId: mongoose.Schema.Types.ObjectId,
  ticketQuantity: Number,
  paidAt: Date,
  customerEmail: String,
  customerName: String,
  customerPhone: String,
  ticketNumbers: [String]
}, { timestamps: true });

const ticketSchema = new mongoose.Schema({
  eventId: mongoose.Schema.Types.ObjectId,
  purchaseId: mongoose.Schema.Types.ObjectId,
  ticketTypeId: mongoose.Schema.Types.ObjectId,
  ticketNumber: String,
  customerEmail: String,
  customerName: String,
  customerPhone: String,
  qrData: String
}, { timestamps: true });

const eventSchema = new mongoose.Schema({
  ticketTypes: [{
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    price: Number
  }]
}, { strict: false });

async function recoverTickets() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("Connected to MongoDB");

    const Purchase = mongoose.model("Purchase", purchaseSchema);
    const Ticket = mongoose.model("Ticket", ticketSchema);
    const Event = mongoose.model("Event", eventSchema);

    // 1. Find all tickets
    const allTickets = await Ticket.find({});
    console.log(`Analyzing ${allTickets.length} tickets...`);

    // 2. Identify orphaned tickets
    const orphanedTickets: any[] = [];
    for (const ticket of allTickets) {
      const purchase = await Purchase.findById(ticket.purchaseId);
      if (!purchase) {
        orphanedTickets.push(ticket);
      }
    }

    console.log(`Found ${orphanedTickets.length} orphaned tickets.`);

    if (orphanedTickets.length === 0) {
      console.log("No recovery needed.");
      return;
    }

    // 3. Group by old purchaseId
    const groups: Map<string, any[]> = new Map();
    for (const ticket of orphanedTickets) {
      const pid = ticket.purchaseId.toString();
      if (!groups.has(pid)) groups.set(pid, []);
      groups.get(pid)!.push(ticket);
    }

    console.log(`Grouping orphans into ${groups.size} missing purchases.`);

    // 4. Reconstruct each purchase
    for (const [oldPid, tickets] of groups.entries()) {
      const firstTicket = tickets[0];
      console.log(`\nReconstructing purchase for old ID: ${oldPid}`);

      // Try to find price
      let amount = 0;
      const event = await Event.findById(firstTicket.eventId);
      if (event) {
        const tt = (event as any).ticketTypes.find((t: any) => t._id.toString() === firstTicket.ticketTypeId.toString());
        if (tt) {
          amount = tt.price * tickets.length;
          console.log(`  Calculated amount: GHS ${amount} (${tickets.length} x ${tt.price})`);
        }
      }

      const newPurchase = await Purchase.create({
        eventId: firstTicket.eventId,
        type: "TICKET",
        status: "PAID",
        source: "web", // Best guess
        paymentReference: `RECOVERED_${oldPid.substring(0, 8)}_${Date.now()}`,
        amount,
        ticketTypeId: firstTicket.ticketTypeId,
        ticketQuantity: tickets.length,
        paidAt: firstTicket.createdAt,
        customerEmail: firstTicket.customerEmail,
        customerName: firstTicket.customerName,
        customerPhone: firstTicket.customerPhone,
        ticketNumbers: tickets.map((t: any) => t.ticketNumber)
      });

      console.log(`  Created NEW Purchase: ${newPurchase._id}`);

      // 5. Update tickets to point to new purchase
      for (const ticket of tickets) {
        const oldQrData = JSON.parse(ticket.qrData);
        oldQrData.purchaseId = newPurchase._id.toString();
        
        await Ticket.findByIdAndUpdate(ticket._id, {
          purchaseId: newPurchase._id,
          qrData: JSON.stringify(oldQrData)
        });
      }
      console.log(`  Updated ${tickets.length} tickets to refer to new Purchase ID.`);
    }

    console.log("\nRecovery complete!");

  } catch (error) {
    console.error("Recovery failed:", error);
  } finally {
    await mongoose.disconnect();
  }
}

recoverTickets();
