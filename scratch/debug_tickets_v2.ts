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

    const eventId = "696623a1b52a946e1dde6ec7"; // From previous run
    
    console.log(`\n--- Detailed check for Event ${eventId} ---`);

    const allPurchases = await Purchase.find({ eventId });
    console.log(`Total Purchases: ${allPurchases.length}`);

    const statusCounts: Record<string, number> = {};
    allPurchases.forEach((p: any) => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });
    console.log("Purchase status breakdown:", statusCounts);

    const tickets = await Ticket.find({ eventId });
    console.log(`Total Tickets: ${tickets.length}`);

    if (tickets.length > 0) {
      console.log("\nSample Ticket structure:");
      console.log(JSON.stringify(tickets[0], null, 2));
      
      const purchaseIdsInTickets = new Set(tickets.map((t: any) => t.purchaseId?.toString()));
      console.log(`Unique purchaseIds present in Ticket documents: ${purchaseIdsInTickets.size}`);
      
      for (const pid of purchaseIdsInTickets) {
        const p = await Purchase.findById(pid);
        console.log(`  Purchase ID ${pid} status: ${p ? (p as any).status : 'NOT FOUND'}`);
      }
    }

  } catch (err) {
    console.error("Debug script failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

debugDiscrepancy();
