import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getMyNotifications, markAsRead, markAllAsRead } from "../controllers/notification.controller";

const router = Router();

router.get(
  "/",
  authenticate,
  getMyNotifications
);

router.patch(
  "/:id/read",
  authenticate,
  markAsRead
);

router.post(
  "/read-all",
  authenticate,
  markAllAsRead
);

export default router;
