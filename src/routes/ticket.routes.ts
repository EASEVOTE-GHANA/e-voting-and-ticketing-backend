import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  getTicketsByPurchase,
  scanTicket,
  toggleTicketUsage,
  getEventTickets,
  getTicketStats
} from "../controllers/ticket.controller";

const router = Router();

// Public routes
router.get("/purchase/:purchaseId", getTicketsByPurchase);

// Organizer routes
router.post("/scan", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]), scanTicket);
router.patch("/toggle-usage", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"]), toggleTicketUsage);
router.get("/events/:eventId", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), getEventTickets);
router.get("/events/:eventId/stats", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), getTicketStats);

export default router;