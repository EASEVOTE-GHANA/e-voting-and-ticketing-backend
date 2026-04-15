import { Request, Response } from "express";
import { FaqService } from "../services/faq.service";
import { asyncHandler } from "../middleware/error.middleware";

export const getFaqs = asyncHandler(async (req: Request, res: Response) => {
  const faqs = await FaqService.getFaqs();
  res.json(faqs);
});

export const getAllFaqs = asyncHandler(async (req: Request, res: Response) => {
  const faqs = await FaqService.getAllFaqs();
  res.json(faqs);
});

export const upsertFaq = asyncHandler(async (req: Request, res: Response) => {
  const faq = await FaqService.upsertFaq(req.body);
  res.status(req.body.id ? 200 : 201).json(faq);
});

export const deleteFaq = asyncHandler(async (req: Request, res: Response) => {
  await FaqService.deleteFaq(req.params.id);
  res.json({ message: "FAQ deleted successfully" });
});

export const seedFaqs = asyncHandler(async (req: Request, res: Response) => {
  const result = await FaqService.seedDefaults();
  res.json(result);
});
