import { Request, Response } from "express";
import { BannerService } from "../services/banner.service";
import { asyncHandler } from "../middleware/error.middleware";

export const getActiveBanners = asyncHandler(async (req: Request, res: Response) => {
  const banners = await BannerService.getActiveBanners();
  res.json(banners);
});

export const getAllBanners = asyncHandler(async (req: Request, res: Response) => {
  const banners = await BannerService.getAllBanners();
  res.json(banners);
});

export const createBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await BannerService.createBanner(req.body);
  res.status(201).json(banner);
});

export const updateBanner = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const bannerId = Array.isArray(id) ? id[0] : id;
  const banner = await BannerService.updateBanner(bannerId, req.body);
  res.json(banner);
});

export const deleteBanner = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const bannerId = Array.isArray(id) ? id[0] : id;
  await BannerService.deleteBanner(bannerId);
  res.json({ message: "Banner deleted successfully" });
});
