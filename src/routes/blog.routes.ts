import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { 
  createBlog, 
  updateBlog, 
  deleteBlog, 
  getAdminBlogs, 
  getAdminBlog,
  getPublicBlogs,
  getPublicBlog 
} from "../controllers/blog.controller";

const router = Router();

// Admin Routes (Management)
router.post(
  "/admin", 
  authenticate, 
  requireRole(["ADMIN", "SUPER_ADMIN"]), 
  createBlog
);

router.get(
  "/admin", 
  authenticate, 
  requireRole(["ADMIN", "SUPER_ADMIN"]), 
  getAdminBlogs
);

router.get(
  "/admin/:id", 
  authenticate, 
  requireRole(["ADMIN", "SUPER_ADMIN"]), 
  getAdminBlog
);

router.put(
  "/admin/:id", 
  authenticate, 
  requireRole(["ADMIN", "SUPER_ADMIN"]), 
  updateBlog
);

router.delete(
  "/admin/:id", 
  authenticate, 
  requireRole(["ADMIN", "SUPER_ADMIN"]), 
  deleteBlog
);

// Public Routes
router.get("/", getPublicBlogs);
router.get("/:slug", getPublicBlog);

export default router;
