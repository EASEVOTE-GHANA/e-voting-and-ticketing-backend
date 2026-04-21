import { Request, Response } from "express";
import { TicketService } from "../services/ticket.service";
import { asyncHandler } from "../middleware/error.middleware";

export const getTicketsByPurchase = asyncHandler(async (req: Request, res: Response) => {
  const purchaseId = Array.isArray(req.params.purchaseId) ? req.params.purchaseId[0] : req.params.purchaseId;
  const tickets = await TicketService.getTicketsByPurchase(purchaseId);
  res.json(tickets);
});

export const scanTicket = asyncHandler(async (req: Request, res: Response) => {
  const { ticketNumber } = req.body;
  const ticket = await TicketService.scanTicket(ticketNumber, req.user!.id);
  res.json(ticket);
});

export const toggleTicketUsage = asyncHandler(async (req: Request, res: Response) => {
  const { ticketNumber } = req.body;
  const ticket = await TicketService.toggleTicketUsage(ticketNumber, req.user!.id);
  res.json(ticket);
});

export const getEventTickets = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const tickets = await TicketService.getEventTickets(eventId, req.user!.id);
  res.json(tickets);
});

export const getTicketStats = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const stats = await TicketService.getTicketStats(eventId, req.user!.id);
  res.json(stats);
});