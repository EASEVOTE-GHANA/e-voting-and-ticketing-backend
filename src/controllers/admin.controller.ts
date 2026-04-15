import { Request, Response } from "express";
import { AdminService } from "../services/admin.service";
import { PurchaseService } from "../services/purchase.service";
import { asyncHandler } from "../middleware/error.middleware";

export const inviteAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await AdminService.inviteAdmin(req.body);
  res.status(201).json(result);
});

export const acceptInvitation = asyncHandler(async (req: Request, res: Response) => {
  const result = await AdminService.acceptInvitation(req.body.token, req.body.password);
  res.json(result);
});

export const approveOrganizer = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await AdminService.approveOrganizer(id);
  res.json(result);
});

export const getTransactionStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await PurchaseService.getTransactionStats();
  res.json({ data: stats });
});

export const getAllTransactions = asyncHandler(async (req: Request, res: Response) => {
  const result = await PurchaseService.getAllTransactions(req.query);
  res.json(result);
});
