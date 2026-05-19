import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";
import { GatewayService } from "./services/gateway.service";

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  await GatewayService.seedGateways();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
