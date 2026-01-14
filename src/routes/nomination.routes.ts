import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  createNominationForm,
  getNominationForm,
  submitNomination,
  getNominations,
  approveNomination,
  rejectNomination
} from "../controllers/nomination.controller";

const router = Router();

// Public routes
router.get("/events/:eventId/form", getNominationForm);
router.post("/events/:eventId/submit", submitNomination);

// Organizer routes
router.post("/events/:eventId/form", authenticate, requireRole("ORGANIZER"), createNominationForm);
router.get("/events/:eventId", authenticate, requireRole("ORGANIZER"), getNominations);
router.patch("/:nominationId/approve", authenticate, requireRole("ORGANIZER"), approveNomination);
router.patch("/:nominationId/reject", authenticate, requireRole("ORGANIZER"), rejectNomination);

export default router;
