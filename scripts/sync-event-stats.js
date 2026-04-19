"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const Event_model_1 = require("../src/models/Event.model");
const Purchase_model_1 = require("../src/models/Purchase.model");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/easevote";
async function syncAllEvents() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose_1.default.connect(MONGO_URI);
        console.log("Connected.");
        const events = await Event_model_1.Event.find({ isDeleted: false });
        console.log(`Found ${events.length} events to sync.`);
        for (const event of events) {
            console.log(`Syncing event: ${event.title} (${event._id})`);
            const stats = await Purchase_model_1.Purchase.aggregate([
                {
                    $match: {
                        eventId: event._id,
                        status: "PAID"
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$amount" },
                        totalVotes: { $sum: { $ifNull: ["$voteCount", 0] } },
                        totalTickets: { $sum: { $ifNull: ["$ticketQuantity", 0] } }
                    }
                }
            ]);
            if (stats.length > 0) {
                const { totalRevenue, totalVotes, totalTickets } = stats[0];
                event.totalRevenue = totalRevenue;
                event.totalPaidVotes = totalVotes;
                event.totalTicketsSold = totalTickets;
                await event.save();
                console.log(`  -> Updated: Revenue: ${totalRevenue}, Votes: ${totalVotes}, Tickets: ${totalTickets}`);
            }
            else {
                event.totalRevenue = 0;
                event.totalPaidVotes = 0;
                event.totalTicketsSold = 0;
                await event.save();
                console.log(`  -> Reset: No paid purchases found.`);
            }
        }
        console.log("Sync complete.");
        process.exit(0);
    }
    catch (error) {
        console.error("Sync failed:", error);
        process.exit(1);
    }
}
syncAllEvents();
