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
router.post("/events/:eventId/form", authenticate, requireRole("ORGANIZER", { allowPending: true }), createNominationForm);
router.get("/events/:eventId", authenticate, requireRole("ORGANIZER", { allowPending: true }), getNominations);
router.patch("/:nominationId/approve", authenticate, requireRole("ORGANIZER", { allowPending: true }), approveNomination);
router.patch("/:nominationId/reject", authenticate, requireRole("ORGANIZER", { allowPending: true }), rejectNomination);

export default router;
