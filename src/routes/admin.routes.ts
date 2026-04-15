import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { inviteAdmin, acceptInvitation, approveOrganizer, getRevenueStats, getAllTransactions, getGateways, setPrimaryGateway, resetGatewayHealth, getPlatformStats, getUsersStats, getSystemLogs, exportTransactions, exportPayouts, exportOrganizers, exportEvents, exportNominations } from "../controllers/admin.controller";
import { updateSetting, getSetting, getAllSettings } from "../controllers/settings.controller";
import { sendManualNotification, getNotificationLogs } from "../controllers/notification.controller";

const router = Router();

router.post(
  "/invite",
  authenticate,
  requireRole("SUPER_ADMIN"),
  inviteAdmin
);

router.post(
  "/accept-invitation",
  acceptInvitation
);

router.patch(
  "/approve-organizer/:id",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  approveOrganizer
);

router.get(
  "/stats/revenue",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  getRevenueStats
);

router.get(
  "/stats/platform",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  getPlatformStats
);

router.get(
  "/stats/users",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  getUsersStats
);

router.get(
  "/logs",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  getSystemLogs
);

// Reports & Exports
router.get(
  "/reports/export/transactions",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  exportTransactions
);

router.get(
  "/reports/export/payouts",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  exportPayouts
);

router.get(
  "/reports/export/organizers",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  exportOrganizers
);

router.get(
  "/reports/export/events",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  exportEvents
);

router.get(
  "/reports/export/nominations",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  exportNominations
);

router.get(
  "/transactions",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  getAllTransactions
);

// Settings routes - Super Admin only
router.put(
  "/settings",
  authenticate,
  requireRole("SUPER_ADMIN"),
  updateSetting
);

router.get(
  "/settings/:key",
  authenticate,
  requireRole("SUPER_ADMIN"),
  getSetting
);

router.get(
  "/settings",
  authenticate,
  requireRole("SUPER_ADMIN"),
  getAllSettings
);

// Gateway Management routes
router.get(
  "/gateways",
  authenticate,
  requireRole("SUPER_ADMIN"),
  getGateways
);

router.post(
  "/gateways/primary",
  authenticate,
  requireRole("SUPER_ADMIN"),
  setPrimaryGateway
);

router.post(
  "/gateways/reset",
  authenticate,
  requireRole("SUPER_ADMIN"),
  resetGatewayHealth
);

// Notifications
router.post(
  "/notifications/send",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  sendManualNotification
);

router.get(
  "/notifications/logs",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  getNotificationLogs
);

export default router;
