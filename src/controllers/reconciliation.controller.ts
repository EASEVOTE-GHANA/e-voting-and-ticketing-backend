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

/**
 * Sync ticket stats for an event
 */
export const syncTicketStats = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  if (!eventId) {
    throw new AppError("Event ID is required", 400);
  }

  const result = await ReconciliationService.syncEventTicketStats(eventId, req.user!.id);
  res.json(result);
});

/**
 * Admin: Sync all stats for an organizer
 */
export const syncOrganizerStats = asyncHandler(async (req: Request, res: Response) => {
  const organizerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!organizerId) {
    throw new AppError("Organizer ID is required", 400);
  }

  const result = await ReconciliationService.syncOrganizerStats(organizerId, req.user!.id);
  res.json(result);
});
