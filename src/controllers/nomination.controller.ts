import { Request, Response } from "express";
import { NominationService } from "../services/nomination.service";
import { asyncHandler } from "../middleware/error.middleware";

export const createNominationForm = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const form = await NominationService.createForm(eventId, req.body.customFields, req.user!.id);
  res.status(201).json(form);
});

export const getNominationForm = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const form = await NominationService.getForm(eventId);
  res.json(form);
});

export const submitNomination = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const nomination = await NominationService.submitNomination(eventId, req.body);
  res.status(201).json(nomination);
});

export const getNominations = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const nominations = await NominationService.getNominations(eventId, req.user!.id, req.query);
  res.json(nominations);
});

export const approveNomination = asyncHandler(async (req: Request, res: Response) => {
  const nominationId = Array.isArray(req.params.nominationId) ? req.params.nominationId[0] : req.params.nominationId;
  const result = await NominationService.approveNomination(nominationId, req.user!.id);
  res.json(result);
});

export const rejectNomination = asyncHandler(async (req: Request, res: Response) => {
  const nominationId = Array.isArray(req.params.nominationId) ? req.params.nominationId[0] : req.params.nominationId;
  const result = await NominationService.rejectNomination(nominationId, req.user!.id);
  res.json(result);
});
