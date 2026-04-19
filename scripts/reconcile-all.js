const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function reconcileAll() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.\n");

  const EventSchema = new mongoose.Schema({}, { strict: false });
  const PurchaseSchema = new mongoose.Schema({}, { strict: false });
  const Event = mongoose.models.Event || mongoose.model("Event", EventSchema);
  const Purchase = mongoose.models.Purchase || mongoose.model("Purchase", PurchaseSchema);

  const events = await Event.find({ isDeleted: { $ne: true } });
  let totalFixed = 0;

  for (const event of events) {
    let eventChanged = false;

    // ─── 1. VOTES: Reconcile candidate.votes with PAID purchases ───
    if (event.type === "VOTING" || event.type === "HYBRID") {
      // Get all PAID vote purchases grouped by candidateId
      const paidVotes = await Purchase.aggregate([
        { $match: { eventId: event._id, type: "VOTE", status: "PAID" } },
        { $group: { _id: "$candidateId", total: { $sum: "$voteCount" }, totalAmount: { $sum: "$amount" } } }
      ]);

      const votesMap = {};
      let verifiedVoteTotal = 0;
      let verifiedVoteRevenue = 0;

      paidVotes.forEach(v => {
        votesMap[v._id?.toString()] = v.total;
        verifiedVoteTotal += v.total;
        verifiedVoteRevenue += v.totalAmount;
      });

      // Reset each candidate's votes to the verified amount
      event.categories?.forEach(cat => {
        cat.candidates.forEach(cand => {
          const cid = cand._id?.toString();
          const paidCount = votesMap[cid] || 0;
          const currentCount = cand.votes || 0;

          if (currentCount !== paidCount) {
            console.log(`  [VOTE FIX] ${event.title} > ${cand.name}: ${currentCount} → ${paidCount}`);
            cand.votes = paidCount;
            eventChanged = true;
          }
        });
      });

      // Reset verified aggregate fields for votes
      const oldPaidVotes = event.totalPaidVotes || 0;
      if (oldPaidVotes !== verifiedVoteTotal) {
        console.log(`  [AGGREGATE FIX] ${event.title}: totalPaidVotes ${oldPaidVotes} → ${verifiedVoteTotal}`);
        event.totalPaidVotes = verifiedVoteTotal;
        eventChanged = true;
      }
    }

    // ─── 2. TICKETS: Reconcile sold counts with PAID purchases ───
    if (event.type === "TICKETING" || event.type === "HYBRID") {
      const paidTickets = await Purchase.aggregate([
        { $match: { eventId: event._id, type: "TICKET", status: "PAID" } },
        { $group: { _id: "$ticketTypeId", total: { $sum: "$ticketQuantity" }, totalAmount: { $sum: "$amount" } } }
      ]);

      const ticketMap = {};
      let verifiedTicketTotal = 0;
      let verifiedTicketRevenue = 0;

      paidTickets.forEach(t => {
        ticketMap[t._id?.toString()] = t.total;
        verifiedTicketTotal += t.total;
        verifiedTicketRevenue += t.totalAmount;
      });

      // Reset each ticketType's sold count
      event.ticketTypes?.forEach(tt => {
        const ttId = tt._id?.toString();
        const paidSold = ticketMap[ttId] || 0;
        const currentSold = tt.sold || 0;

        if (currentSold !== paidSold) {
          console.log(`  [TICKET FIX] ${event.title} > ${tt.name}: sold ${currentSold} → ${paidSold}`);
          tt.sold = paidSold;
          eventChanged = true;
        }
      });

      const oldTicketsSold = event.totalTicketsSold || 0;
      if (oldTicketsSold !== verifiedTicketTotal) {
        console.log(`  [AGGREGATE FIX] ${event.title}: totalTicketsSold ${oldTicketsSold} → ${verifiedTicketTotal}`);
        event.totalTicketsSold = verifiedTicketTotal;
        eventChanged = true;
      }
    }

    // ─── 3. REVENUE: Reconcile totalRevenue with ALL paid purchases ───
    const allPaidRevenue = await Purchase.aggregate([
      { $match: { eventId: event._id, status: "PAID" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const verifiedRevenue = allPaidRevenue[0]?.total || 0;
    const oldRevenue = event.totalRevenue || 0;

    if (Math.abs(oldRevenue - verifiedRevenue) > 0.01) {
      console.log(`  [REVENUE FIX] ${event.title}: totalRevenue GHS ${oldRevenue} → GHS ${verifiedRevenue}`);
      event.totalRevenue = verifiedRevenue;
      eventChanged = true;
    }

    // ─── 4. Save if anything changed ───
    if (eventChanged) {
      await event.save();
      totalFixed++;
    }
  }

  console.log(`\n✅ Reconciliation complete. ${totalFixed} event(s) updated.`);
  process.exit(0);
}

reconcileAll().catch(err => { console.error(err); process.exit(1); });
