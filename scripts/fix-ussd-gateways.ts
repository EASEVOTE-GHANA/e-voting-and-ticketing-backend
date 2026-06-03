import mongoose from "mongoose";
import dotenv from "dotenv";
import { Purchase } from "../src/models/Purchase.model";
import { Gateway } from "../src/models/Gateway.model";
import { NaloPaymentService } from "../src/services/nalo-payment.service";
import { AppsMobileService } from "../src/services/appsmobile.service";
import { MoolreService } from "../src/services/moolre.service";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/easevote";

async function run() {
  console.log("Connecting to database...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected.");

  const ussdPurchases = await Purchase.find({ source: "ussd", paymentGateway: "PAYSTACK" });
  console.log(`Found ${ussdPurchases.length} USSD purchases currently marked as PAYSTACK.`);

  const nalo = new NaloPaymentService();
  const appsmobile = new AppsMobileService();
  const moolre = new MoolreService();

  let updatedCount = 0;

  for (const purchase of ussdPurchases) {
    console.log(`\nChecking purchase ${purchase.paymentReference}...`);
    
    let foundGateway: "PAYSTACK" | "NALO" | "APPSMOBILE" | "MOOLRE" | null = null;

    // Try Nalo
    try {
      if (nalo.verifyPayment) {
        const result = await nalo.verifyPayment(purchase.paymentReference);
        if (result.success || result.status !== 'failed') {
          foundGateway = "NALO";
        }
      }
    } catch (e) {
      // Ignored
    }

    // Try AppsMobile
    if (!foundGateway) {
      try {
        if (appsmobile.verifyPayment) {
          const result = await appsmobile.verifyPayment(purchase.paymentReference);
          if (result.success || result.status !== 'failed') {
            foundGateway = "APPSMOBILE";
          }
        }
      } catch (e) {
        // Ignored
      }
    }

    // Try Moolre
    if (!foundGateway) {
      try {
        if (moolre.verifyPayment) {
          const result = await moolre.verifyPayment(purchase.paymentReference);
          if (result.success || result.status !== 'failed') {
            foundGateway = "MOOLRE";
          }
        }
      } catch (e) {
        // Ignored
      }
    }

    if (foundGateway) {
      console.log(`-> Verified via ${foundGateway}. Updating database...`);
      purchase.paymentGateway = foundGateway;
      await purchase.save();
      updatedCount++;
    } else {
      console.log(`-> Could not verify via any USSD gateway. Leaving as is.`);
    }
  }

  console.log(`\nFinished! Updated ${updatedCount} records.`);
  process.exit(0);
}

run().catch(console.error);
