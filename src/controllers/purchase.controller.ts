import { Request, Response } from "express";
import { PurchaseService } from "../services/purchase.service";
import { PaystackService } from "../services/paystack.service";
import { asyncHandler } from "../middleware/error.middleware";
import crypto from "crypto";

export const initializeTicketPurchase = asyncHandler(async (req: Request, res: Response) => {
  const result = await PurchaseService.initializeTicketPurchase(req.body);
  res.status(201).json(result);
});

export const initializeVotePurchase = asyncHandler(async (req: Request, res: Response) => {
  const result = await PurchaseService.initializeVotePurchase(req.body);
  res.status(201).json(result);
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const reference = Array.isArray(req.params.reference) ? req.params.reference[0] : req.params.reference;
  const result = await PurchaseService.verifyPayment(reference);
  res.json(result);
});

export const paymentWebhook = asyncHandler(async (req: Request, res: Response) => {
  console.log('Payment webhook received');
  
  // PurchaseService determines which gateway and handles the webhook
  const result = await PurchaseService.handleWebhook(req);
  
  if (!result.success) {
    return res.status(400).send('Invalid webhook');
  }

  res.status(200).send('OK');
});

export const getPurchaseHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await PurchaseService.getPurchaseHistory(req.user!.id, req.query);
  res.json(result);
});

export const getEventPurchases = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const result = await PurchaseService.getEventPurchases(eventId, req.user!.id, req.query);
  res.json(result);
});

export const getOrganizerTransactions = asyncHandler(async (req: Request, res: Response) => {
  const result = await PurchaseService.getOrganizerTransactions(req.user!.id, req.query);
  res.json(result);
});