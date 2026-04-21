import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import blogRoutes from "./routes/blog.routes";
import userRoutes from "./routes/user.routes";
import eventRoutes from "./routes/event.routes";
import purchaseRoutes from "./routes/purchase.routes";
import ticketRoutes from "./routes/ticket.routes";
import uploadRoutes from "./routes/upload.routes";
import voteRoutes from "./routes/vote.routes";
import nominationRoutes from "./routes/nomination.routes";
import ussdRoutes from "./routes/ussd.routes";
import payoutRoutes from "./routes/payout.routes";
import cmsRoutes from "./routes/cms.routes";
import notificationRoutes from "./routes/notification.routes";
import reconciliationRoutes from "./routes/reconciliation.routes";
import { globalErrorHandler } from "./middleware/error.middleware";
import { CronService } from "./services/cron.service";

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get("/api/health", (req, res) => {
  const healthStatus = {
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    },
    service: "easevote-backend",
    version: process.env.npm_package_version || "1.0.0",
  };

  res.status(200).json(healthStatus);
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/votes", voteRoutes);
app.use("/api/nominations", nominationRoutes);
app.use("/api/ussd", ussdRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/cms", cmsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reconciliation", reconciliationRoutes);

// Start cron jobs
CronService.start();

app.use(globalErrorHandler);

export default app;
