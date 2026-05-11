const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGO_URI || "mongodb://localhost:27017/easevote";

async function checkHG() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const event = await mongoose.connection.db.collection("events").findOne({ eventCode: "HG" });
    if (!event) {
        console.log("Event HG not found");
        return;
    }
    console.log(`Found Event HG: ${event._id}`);

    const form = await mongoose.connection.db.collection("nominationforms").findOne({ eventId: event._id });
    if (!form) {
        console.log("Nomination form for HG not found");
        return;
    }

    console.log("Form for HG:");
    console.log(JSON.stringify(form, null, 2));

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

checkHG();
