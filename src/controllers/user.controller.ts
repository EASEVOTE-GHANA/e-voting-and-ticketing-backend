import { Request, Response } from "express";
import { UserService } from "../services/user.service";
import { asyncHandler } from "../middleware/error.middleware";

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = await UserService.getUser(id);
  res.json(user);
});

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const includeDeleted = req.query.includeDeleted === "true";
  const withStats = req.query.withStats === "true";
  const users = await UserService.getAllUsers(req.user!.role, includeDeleted, withStats);
  res.json(users);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = await UserService.updateUser(id, req.body, req.user!.id, req.user!.role);
  res.json(user);
});

export const updatePassword = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await UserService.updatePassword(id, req.body.password, req.user!.id, req.user!.role);
  res.json(result);
});

export const restoreUser = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await UserService.restoreUser(id, req.user!.role);
  res.json(result);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await UserService.deleteUser(id, req.user!.role);
  res.json(result);
});