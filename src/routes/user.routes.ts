import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  getUser,
  getAllUsers,
  updateUser,
  updatePassword,
  deleteUser,
  restoreUser
} from "../controllers/user.controller";

const router = Router();

router.get("/", authenticate, getAllUsers);
router.get("/:id", authenticate, getUser);
router.put("/:id", authenticate, updateUser);
router.patch("/:id/password", authenticate, updatePassword);
router.delete("/:id", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"], { allowPending: true }), deleteUser);
router.patch("/:id/restore", authenticate, requireRole(["ADMIN", "SUPER_ADMIN"]), restoreUser);

export default router;