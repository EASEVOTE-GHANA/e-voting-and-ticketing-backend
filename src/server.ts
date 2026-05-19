import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import util from "util";

// Intercept console.log and console.error to write to a file since cPanel swallows them
const logFile = path.join(process.cwd(), "app_errors.log");
const originalError = console.error;
console.error = (...args: any[]) => {
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ERROR: ${util.format(...args)}\n`);
  originalError(...args);
};
const originalLog = console.log;
console.log = (...args: any[]) => {
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] LOG: ${util.format(...args)}\n`);
  originalLog(...args);
};

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
