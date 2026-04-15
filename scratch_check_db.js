"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const Purchase_model_1 = require("./src/models/Purchase.model");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function check() {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI);
        const total = await Purchase_model_1.Purchase.countDocuments();
        const statuses = await Purchase_model_1.Purchase.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);
        const volumes = await Purchase_model_1.Purchase.aggregate([
            { $group: { _id: "$status", totalVolume: { $sum: "$amount" } } }
        ]);
        console.log('Total Purchases:', total);
        console.log('Statuses:', JSON.stringify(statuses, null, 2));
        console.log('Volumes:', JSON.stringify(volumes, null, 2));
        await mongoose_1.default.disconnect();
    }
    catch (err) {
        console.error('Error:', err.message);
    }
}
check();
