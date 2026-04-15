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
import {
    getActiveBanners,
    getAllBanners,
    createBanner,
    updateBanner,
    deleteBanner
} from "../controllers/banner.controller";

const router = Router();

// Public Routes
router.get("/faqs", getFaqs);
router.get("/banners", getActiveBanners);

// Admin Routes
router.get(
  "/faqs/admin", 
  authenticate, 
  requireRole(["ADMIN", "SUPER_ADMIN"]), 
  getAllFaqs
);

router.get(
    "/banners/admin",
    authenticate,
    requireRole(["ADMIN", "SUPER_ADMIN"]),
    getAllBanners
);

router.post(
    "/banners",
    authenticate,
    requireRole(["ADMIN", "SUPER_ADMIN"]),
    createBanner
);

router.put(
    "/banners/:id",
    authenticate,
    requireRole(["ADMIN", "SUPER_ADMIN"]),
    updateBanner
);

router.delete(
    "/banners/:id",
    authenticate,
    requireRole(["ADMIN", "SUPER_ADMIN"]),
    deleteBanner
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
