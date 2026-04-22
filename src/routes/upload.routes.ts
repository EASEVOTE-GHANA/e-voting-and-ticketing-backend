import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";
import { uploadImage, deleteImage, uploadPublicImage } from "../controllers/upload.controller";

const router = Router();

router.post("/image", authenticate, upload.single("image"), uploadImage);
router.post("/public", upload.single("image"), uploadPublicImage);
router.delete("/image", authenticate, deleteImage);

export default router;