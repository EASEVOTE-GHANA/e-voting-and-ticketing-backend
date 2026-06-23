import sharp from "sharp";
import { AppError } from "../middleware/error.middleware";

export class ImageService {
  static async processImage(buffer: Buffer, originalSize: number): Promise<Buffer> {
    try {
      const EIGHT_MB = 8 * 1024 * 1024;
      const SEVEN_MB = 7 * 1024 * 1024;

      // If file is less than or equal to 8MB, return as is
      if (originalSize <= EIGHT_MB) {
        return buffer;
      }

      // Compress image if larger than 8MB
      let quality = 80;
      let processedBuffer = buffer;

      const metadata = await sharp(buffer).metadata();
      const format = metadata.format; // 'jpeg', 'png', 'webp' etc.

      // Reduce quality until file is roughly 7MB or quality hits the threshold (don't super compress)
      while (processedBuffer.length > SEVEN_MB && quality >= 60) {
        let s = sharp(buffer);
        if (format === 'jpeg' || format === 'jpg') {
          s = s.jpeg({ quality, progressive: true });
        } else if (format === 'png') {
          s = s.png({ quality, progressive: true });
        } else if (format === 'webp') {
          s = s.webp({ quality });
        }
        
        processedBuffer = await s.toBuffer();
        quality -= 10;
      }

      // Resize if still too large (over 7MB) even after mild compression
      if (processedBuffer.length > SEVEN_MB) {
        let s = sharp(buffer).resize(1600, 1600, { 
          fit: 'inside',
          withoutEnlargement: true 
        });

        if (format === 'jpeg' || format === 'jpg') {
          s = s.jpeg({ quality: 80, progressive: true });
        } else if (format === 'png') {
          s = s.png({ quality: 80, progressive: true });
        } else if (format === 'webp') {
          s = s.webp({ quality: 80 });
        }
        
        processedBuffer = await s.toBuffer();
      }

      return processedBuffer;
    } catch (error) {
      throw new AppError("Image processing failed", 500);
    }
  }

  static validateImage(file: Express.Multer.File) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB limit

    if (!allowedTypes.includes(file.mimetype)) {
      throw new AppError("Only JPEG, PNG, and WebP images are allowed", 400);
    }

    if (file.size > maxSize) {
      throw new AppError("File size must be less than 10MB", 400);
    }
  }
}