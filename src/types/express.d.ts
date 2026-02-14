import "multer";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        status: string;
        tokenVersion: number;
      };
      
    }
  }
}

export {};