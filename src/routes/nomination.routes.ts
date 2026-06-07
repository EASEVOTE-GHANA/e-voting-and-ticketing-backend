import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  createNominationForm,
  getNominationForm,
  submitNomination,
  getNominations,
  getAllOrganizerNominations,
  approveNomination,
  rejectNomination
} from "../controllers/nomination.controller";

const router = Router();

// Public routes (with optional auth for organizers)
router.get("/events/:eventId/form", optionalAuthenticate, getNominationForm);
router.post("/events/:eventId/submit", submitNomination);

// Organizer & Admin routes
router.post("/events/:eventId/form", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), createNominationForm);
router.get("/", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), getAllOrganizerNominations);
router.get("/events/:eventId", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), getNominations);
router.patch("/:nominationId/approve", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), approveNomination);
router.patch("/:nominationId/reject", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), rejectNomination);

export default router;
