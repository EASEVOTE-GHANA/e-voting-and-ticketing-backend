import { Request, Response } from "express";
import { EventService } from "../services/event.service";
import { CandidateService } from "../services/candidate.service";
import { CategoryService } from "../services/category.service";
import { TicketService } from "../services/ticket.service";
import { asyncHandler } from "../middleware/error.middleware";

export const createEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await EventService.createEvent(req.body, req.user!.id, req.user!.role);
  res.status(201).json(event);
});

export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const event = await EventService.updateEvent(id, req.body, req.user!.id, req.user!.role);
  res.json(event);
});

export const getEvent = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const event = await EventService.getEvent(id, req.user?.id, req.user?.role);
  res.json(event);
});

export const getEvents = asyncHandler(async (req: Request, res: Response) => {
  const events = await EventService.getEvents(req.query);
  res.json(events);
});

export const getMyEvents = asyncHandler(async (req: Request, res: Response) => {
  const events = await EventService.getMyEvents(req.user!.id, req.query);
  res.json(events);
});

export const getAllEventsForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const events = await EventService.getAllEventsForAdmin(req.query);
  res.json(events);
});

export const submitForReview = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const event = await EventService.submitForReview(id, req.user!.id);
  res.json(event);
});

export const approveEvent = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const event = await EventService.approveEvent(id, req.user!.role);
  res.json(event);
});

export const publishEvent = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const event = await EventService.publishEvent(id, req.user!.id);
  res.json(event);
});

export const addCategory = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const event = await CategoryService.addCategory(id, req.body, req.user!.id);
  res.json(event);
});

export const addCandidate = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const categoryId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId;
  const event = await CandidateService.addCandidate(eventId, categoryId, req.body, req.user!.id);
  res.json(event);
});

export const addTicketType = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const event = await TicketService.addTicketType(id, req.body, req.user!.id);
  res.json(event);
});

export const deleteEvent = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await EventService.deleteEvent(id, req.user!.id, req.user!.role);
  res.json(result);
});

export const getEventCategories = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const categories = await CategoryService.getEventCategories(id, req.user?.id, req.user?.role);
  res.json(categories);
});

export const getCategoryWithCandidates = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const categoryId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId;
  const category = await CategoryService.getCategoryWithCandidates(eventId, categoryId, req.user?.id, req.user?.role);
  res.json(category);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const categoryId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId;
  const event = await CategoryService.updateCategory(eventId, categoryId, req.body, req.user!.id, req.user!.role);
  res.json(event);
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const categoryId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId;
  const result = await CategoryService.deleteCategory(eventId, categoryId, req.user!.id, req.user!.role);
  res.json(result);
});

export const updateCandidate = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const categoryId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId;
  const candidateId = Array.isArray(req.params.candidateId) ? req.params.candidateId[0] : req.params.candidateId;
  const event = await CandidateService.updateCandidate(eventId, categoryId, candidateId, req.body, req.user!.id, req.user!.role);
  res.json(event);
});

export const getDeletedEvents = asyncHandler(async (req: Request, res: Response) => {
  const events = await EventService.getDeletedEvents(req.user!.role);
  res.json(events);
});

export const deleteCandidate = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const categoryId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId;
  const candidateId = Array.isArray(req.params.candidateId) ? req.params.candidateId[0] : req.params.candidateId;
  const result = await CandidateService.deleteCandidate(eventId, categoryId, candidateId, req.user!.id, req.user!.role);
  res.json(result);
});

export const updateTicketType = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const ticketTypeId = Array.isArray(req.params.ticketTypeId) ? req.params.ticketTypeId[0] : req.params.ticketTypeId;
  const event = await TicketService.updateTicketType(eventId, ticketTypeId, req.body, req.user!.id, req.user!.role);
  res.json(event);
});

export const getCandidate = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const candidateCode = Array.isArray(req.params.candidateCode) ? req.params.candidateCode[0] : req.params.candidateCode;
  const candidate = await CandidateService.getCandidate(eventId, candidateCode, req.user?.id, req.user?.role);
  res.json(candidate);
});

export const deleteTicketType = asyncHandler(async (req: Request, res: Response) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const ticketTypeId = Array.isArray(req.params.ticketTypeId) ? req.params.ticketTypeId[0] : req.params.ticketTypeId;
  const result = await TicketService.deleteTicketType(eventId, ticketTypeId, req.user!.id, req.user!.role);
  res.json(result);
});

export const toggleLiveResults = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await EventService.toggleLiveResults(id, req.user!.id, req.user!.role);
  res.json(result);
});

export const toggleShowVoteCount = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await EventService.toggleShowVoteCount(id, req.user!.id, req.user!.role);
  res.json(result);
});