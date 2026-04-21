import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { 
  getOrganizerGaps, 
  reconcileEvent,
  syncTicketStats,
  syncOrganizerStats
} from "../controllers/reconciliation.controller";

const router = Router();

router.use(authenticate);
router.use(requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]));

router.get("/gaps", getOrganizerGaps);
router.post("/reconcile/:eventId", reconcileEvent);
router.post("/sync-tickets/:eventId", syncTicketStats);

// Admin only: Global sync for any organizer
router.post("/sync-organizer/:id", requireRole(["ADMIN", "SUPER_ADMIN"]), syncOrganizerStats);

export default router;
