import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { 
  getOrganizerGaps, 
  reconcileEvent 
} from "../controllers/reconciliation.controller";

const router = Router();

router.use(authenticate);
router.use(requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]));

router.get("/gaps", getOrganizerGaps);
router.post("/reconcile/:eventId", reconcileEvent);

export default router;
