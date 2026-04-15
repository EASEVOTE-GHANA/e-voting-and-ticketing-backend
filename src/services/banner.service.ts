import { Banner } from "../models/Banner.model";
import { AppError } from "../middleware/error.middleware";

export class BannerService {
  static async getActiveBanners() {
    return await Banner.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
  }

  static async getAllBanners() {
    return await Banner.find().sort({ order: 1, createdAt: -1 });
  }

  static async createBanner(data: any) {
    return await Banner.create(data);
  }

  static async updateBanner(id: string, data: any) {
    const banner = await Banner.findByIdAndUpdate(id, data, { new: true });
    if (!banner) throw new AppError("Banner not found", 404);
    return banner;
  }

  static async deleteBanner(id: string) {
    const banner = await Banner.findByIdAndDelete(id);
    if (!banner) throw new AppError("Banner not found", 404);
    return banner;
  }
}
