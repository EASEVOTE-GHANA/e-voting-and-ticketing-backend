import { Request, Response } from "express";
import { AdminService } from "../services/admin.service";
import { AnalyticsService } from "../services/analytics.service";
import { GatewayService } from "../services/gateway.service";
import { ReportService } from "../services/report.service";
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

export const getRevenueStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await PurchaseService.getRevenueStats();
  res.json({ data: stats });
});

export const getAllTransactions = asyncHandler(async (req: Request, res: Response) => {
  const result = await PurchaseService.getAllTransactions(req.query);
  res.json(result);
});

export const getGateways = asyncHandler(async (req: Request, res: Response) => {
  const gateways = await GatewayService.getGateways();
  res.json(gateways);
});

export const setPrimaryGateway = asyncHandler(async (req: Request, res: Response) => {
  const { provider, type } = req.body;
  const result = await GatewayService.setPrimaryGateway(provider, type);
  res.json(result);
});

export const resetGatewayHealth = asyncHandler(async (req: Request, res: Response) => {
  const { provider, type } = req.body;
  await GatewayService.resetHealth(provider, type);
  res.json({ message: "Health stats reset" });
});

export const getPlatformStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await AnalyticsService.getPlatformPulse();
  res.json({ data: stats });
});

export const getUsersStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await AnalyticsService.getUserAnalytics();
  res.json({ data: stats });
});

export const getSystemLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await AnalyticsService.getSystemLogs(req.query);
  res.json(result);
});

// Reporting & Exports
export const exportTransactions = asyncHandler(async (req: Request, res: Response) => {
  const csv = await ReportService.exportTransactionsCsv(req.query);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=transactions_${Date.now()}.csv`);
  res.send(csv);
});

export const exportPayouts = asyncHandler(async (req: Request, res: Response) => {
  const csv = await ReportService.exportPayoutsCsv();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=payouts_${Date.now()}.csv`);
  res.send(csv);
});

export const exportOrganizers = asyncHandler(async (req: Request, res: Response) => {
  const csv = await ReportService.exportOrganizersCsv();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=organizers_${Date.now()}.csv`);
  res.send(csv);
});

export const exportEvents = asyncHandler(async (req: Request, res: Response) => {
  const csv = await ReportService.exportEventsCsv();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=events_${Date.now()}.csv`);
  res.send(csv);
});

export const exportNominations = asyncHandler(async (req: Request, res: Response) => {
  const csv = await ReportService.exportNominationsCsv();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=nominations_${Date.now()}.csv`);
  res.send(csv);
});

export const exportPlatformPdf = asyncHandler(async (req: Request, res: Response) => {
  await ReportService.generatePlatformPdf(res);
});
