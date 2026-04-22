import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { User } from "../models/User.model";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ message: "Unauthorized" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.sub);

    if (!user || user.tokenVersion !== decoded.tokenVersion)
      return res.status(401).json({ message: "Session expired" });

    (req as any).user = {
      id: decoded.sub,
      role: decoded.role,
      status: decoded.status,
      tokenVersion: decoded.tokenVersion
    };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();

  const token = authHeader.split(" ")[1];
  if (!token) return next();

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.sub);

    if (user && user.tokenVersion === decoded.tokenVersion) {
      (req as any).user = {
        id: decoded.sub,
        role: decoded.role,
        status: decoded.status,
        tokenVersion: decoded.tokenVersion
      };
    }
    next();
  } catch {
    next();
  }
};
