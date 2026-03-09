import { Request, Response, NextFunction } from "express";
import { UserRole } from "../models/User.model";

export const requireRole = (allowedRoles: UserRole[] | UserRole, options: { allowPending?: boolean } = {}) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const { allowPending = false } = options;

  return (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const user = req.user;

    // Should never happen if authenticate middleware ran
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Account must not be disabled
    if (user.status === "DISABLED") {
      return res.status(403).json({
        message: "Your account has been disabled. Please contact support."
      });
    }

    // Status check: if not active and allowPending is false, block
    if (user.status !== "ACTIVE" && !allowPending) {
      return res.status(403).json({
        message: "Your organizer account is pending admin approval."
      });
    }

    // Role check
    if (!roles.includes(user.role as UserRole)) {
      return res.status(403).json({
        message: "Forbidden: insufficient permissions"
      });
    }

    next();
  };
};
