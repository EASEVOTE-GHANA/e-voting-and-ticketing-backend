import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { 
  getOrganizerBalance, 
  requestPayout, 
  getMyPayouts, 
  adminGetAllPayouts, 
  adminUpdatePayoutStatus 
} from "../controllers/payout.controller";

const router = Router();

// --- Organizer Routes ---
router.get(
  "/balance",
  authenticate,
  requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]), // Admins can also have events
  getOrganizerBalance
);

router.post(
  "/request",
  authenticate,
  requireRole("ORGANIZER"), // Usually only organizers request.
  requestPayout
);

router.get(
  "/me",
  authenticate,
  requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]),
  getMyPayouts
);

// --- Admin Management Routes ---
router.get(
  "/admin/all",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  adminGetAllPayouts
);

router.patch(
  "/admin/:id",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  adminUpdatePayoutStatus
);

export default router;
