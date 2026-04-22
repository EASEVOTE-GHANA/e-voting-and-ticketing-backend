import { Request, Response } from "express";
import { UploadService } from "../services/upload.service";
import { asyncHandler } from "../middleware/error.middleware";

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const result = await UploadService.uploadImage(req.file, {
    folder: req.body.folder,
    userId: req.user?.id
  });

  res.json(result);
});

export const uploadPublicImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const result = await UploadService.uploadImage(req.file, {
    folder: req.body.folder || "public",
    userId: "guest"
  });

  res.json(result);
});

export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const { publicId } = req.body;
  
  if (!publicId) {
    return res.status(400).json({ message: "Public ID is required" });
  }

  const result = await UploadService.deleteImage(publicId);
  res.json({ message: "Image deleted successfully", result });
});