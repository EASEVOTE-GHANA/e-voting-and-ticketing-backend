import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { 
  getFaqs, 
  getAllFaqs, 
  upsertFaq, 
  deleteFaq, 
  seedFaqs 
} from "../controllers/faq.controller";

const router = Router();

// Public Routes
router.get("/faqs", getFaqs);

// Admin Routes
router.get(
  "/faqs/admin", 
  authenticate, 
  requireRole(["ADMIN", "SUPER_ADMIN"]), 
  getAllFaqs
);

router.put(
  "/faqs", 
  authenticate, 
  requireRole(["ADMIN", "SUPER_ADMIN"]), 
  upsertFaq
);

router.delete(
  "/faqs/:id", 
  authenticate, 
  requireRole(["ADMIN", "SUPER_ADMIN"]), 
  deleteFaq
);

router.post(
  "/faqs/seed", 
  authenticate, 
  requireRole(["ADMIN", "SUPER_ADMIN"]), 
  seedFaqs
);

export default router;
