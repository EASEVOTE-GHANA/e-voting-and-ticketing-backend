import { Router } from "express";
import { submitInquiry } from "../controllers/inquiry.controller";

const router = Router();

// Public route to submit an inquiry from the contact form
router.post("/", submitInquiry);

export default router;
