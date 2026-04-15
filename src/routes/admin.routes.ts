import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { inviteAdmin, acceptInvitation, approveOrganizer, getTransactionStats, getAllTransactions } from "../controllers/admin.controller";
import { updateSetting, getSetting, getAllSettings } from "../controllers/settings.controller";

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
  "/stats/transactions",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  getTransactionStats
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

export default router;
