import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { optionalAuthenticate } from "../middleware/optional-auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  createEvent,
  updateEvent,
  getEvent,
  getEvents,
  getMyEvents,
  getAllEventsForAdmin,
  getDeletedEvents,
  submitForReview,
  approveEvent,
  publishEvent,
  addCategory,
  addCandidate,
  addTicketType,
  deleteEvent,
  getEventCategories,
  getCategoryWithCandidates,
  getCandidate,
  updateCategory,
  deleteCategory,
  updateCandidate,
  deleteCandidate,
  updateTicketType,
  deleteTicketType,
  toggleLiveResults,
  toggleShowVoteCount,
  restoreEvent,
  suspendEvent,
  resumeEvent,
  getOrganizerStats,
  permanentDeleteEvent,
  setEventCommission,
} from "../controllers/event.controller";

const router = Router();

// Public routes (with optional authentication for access control)
router.get("/", optionalAuthenticate, getEvents);
router.get("/:id", optionalAuthenticate, getEvent);
router.get("/:id/categories", optionalAuthenticate, getEventCategories);
router.get("/:eventId/categories/:categoryId", optionalAuthenticate, getCategoryWithCandidates);
router.get("/:eventId/candidates/:candidateCode", optionalAuthenticate, getCandidate);

// Organizer routes
router.get("/my/events", authenticate, requireRole("ORGANIZER", { allowPending: true }), getMyEvents);
router.get("/my/stats", authenticate, requireRole("ORGANIZER", { allowPending: true }), getOrganizerStats);
router.post("/", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), createEvent);
router.put("/:id", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), updateEvent);
router.patch("/:id/submit", authenticate, requireRole("ORGANIZER"), submitForReview);
router.patch("/:id/publish", authenticate, requireRole("ORGANIZER"), publishEvent);
router.post("/:id/categories", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), addCategory);
router.put("/:eventId/categories/:categoryId", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), updateCategory);
router.delete("/:eventId/categories/:categoryId", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), deleteCategory);
router.post("/:eventId/categories/:categoryId/candidates", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), addCandidate);
router.put("/:eventId/categories/:categoryId/candidates/:candidateId", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), updateCandidate);
router.delete("/:eventId/categories/:categoryId/candidates/:candidateId", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), deleteCandidate);
router.post("/:id/ticket-types", authenticate, requireRole("ORGANIZER", { allowPending: true }), addTicketType);
router.put("/:eventId/ticket-types/:ticketTypeId", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), updateTicketType);
router.delete("/:eventId/ticket-types/:ticketTypeId", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), deleteTicketType);
router.delete("/:id", authenticate, deleteEvent);
router.patch("/:id/toggle-live-results", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]), toggleLiveResults);
router.patch("/:id/toggle-vote-count", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]), toggleShowVoteCount);

// Admin routes
router.get("/admin/all", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), getAllEventsForAdmin);
router.get("/admin/deleted", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]), getDeletedEvents);
router.post("/:id/restore", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]), restoreEvent);
router.delete("/:id/permanent", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]), permanentDeleteEvent);
router.patch("/:id/approve", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), approveEvent);
router.patch("/:id/commission", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), setEventCommission);
router.patch("/:id/suspend", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]), suspendEvent);
router.patch("/:id/resume", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]), resumeEvent);

export default router;