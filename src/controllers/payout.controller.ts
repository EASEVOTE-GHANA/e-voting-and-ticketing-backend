import { Request, Response } from "express";
import { PayoutService } from "../services/payout.service";
import { asyncHandler } from "../middleware/error.middleware";

export const getOrganizerBalance = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const balance = await PayoutService.getOrganizerBalance(userId);
  res.json({ data: balance });
});

export const requestPayout = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const payout = await PayoutService.requestPayout(userId, req.body);
  res.status(201).json({ data: payout });
});

export const getMyPayouts = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const result = await PayoutService.getOrganizerPayouts(userId, req.query);
  res.json(result);
});

export const adminGetAllPayouts = asyncHandler(async (req: Request, res: Response) => {
  const result = await PayoutService.getAllPayouts(req.query);
  res.json(result);
});

export const adminUpdatePayoutStatus = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const payoutId = req.params.id;
  const { status, adminNotes } = req.body;
  
  const payout = await PayoutService.updatePayoutStatus(payoutId, status, adminNotes, adminId);
  res.json({ data: payout });
});
