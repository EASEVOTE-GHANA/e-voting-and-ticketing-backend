import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";

  if (err.name === "ValidationError") {
    err.statusCode = 400;
    const errors = Object.values(err.errors || {}).map((el: any) => el.message);
    err.message = errors.length > 0 ? `Validation failed: ${errors.join(', ')}` : err.message;
  } else if (err.code === 11000) {
    err.statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    err.message = field ? `Duplicate field value entered for ${field}. Please use another value.` : "Duplicate field value entered.";
  } else if (err.name === "CastError") {
    err.statusCode = 400;
    err.message = `Invalid ${err.path}: ${err.value}.`;
  }

  console.error(`[GlobalErrorHandler] Error ${err.statusCode}: ${err.message}`, {
    path: req.path,
    method: req.method,
    body: req.body,
    stack: err.stack
  });

  res.status(err.statusCode).json({
    message: err.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};