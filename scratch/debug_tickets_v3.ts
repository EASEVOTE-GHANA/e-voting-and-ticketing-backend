import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

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

    console.log("\n--- Searching for all Tickets in DB ---");
    const allTickets = await Ticket.find({});
    console.log(`Total Tickets found: ${allTickets.length}`);

    if (allTickets.length > 0) {
      const pids = new Set(allTickets.map((t: any) => t.purchaseId?.toString()));
      const eids = new Set(allTickets.map((t: any) => t.eventId?.toString()));

      console.log(`Unique purchaseIds in tickets: ${[...pids]}`);
      console.log(`Unique eventIds in tickets: ${[...eids]}`);

      for (const eid of eids) {
        if (!eid) continue;
        const e = await Event.findById(eid);
        console.log(`Event ${eid}: ${e ? (e as any).title : 'NOT FOUND'}`);
      }

      for (const pid of pids) {
        if (!pid) {
          console.log("Ticket(s) found with NO purchaseId");
          continue;
        }
        const p = await Purchase.findById(pid);
        if (p) {
          console.log(`Purchase ${pid} found. Status: ${(p as any).status}, Type: ${(p as any).type}, Reference: ${(p as any).paymentReference}`);
        } else {
          console.log(`Purchase ${pid} NOT FOUND in DB`);
        }
      }
    }

    console.log("\n--- Searching for all PAID Purchases in DB ---");
    const paidPurchases = await Purchase.find({ status: { $regex: /paid/i } });
    console.log(`Paid Purchases (case-insensitive search): ${paidPurchases.length}`);
    paidPurchases.forEach((p: any) => {
      console.log(`  ${p._id} - Status: ${p.status}, Type: ${p.type}`);
    });

  } catch (err) {
    console.error("Debug script failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

debugDiscrepancy();
