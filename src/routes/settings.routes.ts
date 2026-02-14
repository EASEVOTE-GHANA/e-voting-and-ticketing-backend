import { Router } from "express";
import {
  updateSetting,
  getSetting,
  getAllSettings,
} from "../controllers/settings.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { asyncHandler } from "../middleware/async.middleware";

const router = Router();

router.get(
  "/payment-gateway",
  authenticate,
  requireRole("SUPER_ADMIN"),
  asyncHandler(getSetting)
);

router.put(
  "/payment-gateway",
  authenticate,
  requireRole("SUPER_ADMIN"),
  asyncHandler(updateSetting)
);

export { router as settingsRoutes };