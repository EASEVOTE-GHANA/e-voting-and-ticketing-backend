import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  initializeTicketPurchase,
  initializeVotePurchase,
  verifyPayment,
  getPurchaseHistory,
  getEventPurchases,
  getOrganizerTransactions,
  paymentWebhook
} from "../controllers/purchase.controller";

const router = Router();

// Public routes
router.post("/tickets/initialize", initializeTicketPurchase);
router.post("/votes/initialize", initializeVotePurchase);
router.get("/verify/:reference", verifyPayment);
router.post("/webhook/payment", paymentWebhook);

// Authenticated routes
router.get("/history", authenticate, getPurchaseHistory);
router.get("/organizer", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), getOrganizerTransactions);
router.get("/events/:eventId", authenticate, requireRole(["ORGANIZER", "ADMIN", "SUPER_ADMIN"], { allowPending: true }), getEventPurchases);

export default router;