import { Request, Response } from "express";
import { asyncHandler } from "../middleware/async.middleware";
import { ReconciliationService } from "../services/reconciliation.service";
import { AppError } from "../middleware/error.middleware";

/**
 * Get all revenue gaps for the concurrent organizer
 */
export const getOrganizerGaps = asyncHandler(async (req: Request, res: Response) => {
  const gaps = await ReconciliationService.getOrganizerGaps(req.user!.id);
  res.json({
    success: true,
    data: gaps
  });
});

/**
 * Reconcile a specific event's revenue gaps
 */
export const reconcileEvent = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  if (!eventId) {
    throw new AppError("Event ID is required", 400);
  }

  const result = await ReconciliationService.reconcileEvent(eventId, req.user!.id);
  res.json(result);
});
