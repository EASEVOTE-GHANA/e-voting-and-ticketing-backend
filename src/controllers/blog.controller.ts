import { Request, Response } from "express";
import { BlogService } from "../services/blog.service";
import { asyncHandler } from "../middleware/error.middleware";

// Admin Handlers
export const createBlog = asyncHandler(async (req: Request, res: Response) => {
  const blog = await BlogService.createBlog({
    ...req.body,
    author: (req as any).user.id,
  });
  res.status(201).json(blog);
});

export const updateBlog = asyncHandler(async (req: Request, res: Response) => {
  const blog = await BlogService.updateBlog(req.params.id as string, req.body);
  res.json(blog);
});

export const deleteBlog = asyncHandler(async (req: Request, res: Response) => {
  await BlogService.deleteBlog(req.params.id as string);
  res.status(204).send();
});

export const getAdminBlogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await BlogService.getBlogs(req.query);
  res.json(result);
});

export const getAdminBlog = asyncHandler(async (req: Request, res: Response) => {
  const blog = await BlogService.getAdminBlogById(req.params.id as string);
  res.json(blog);
});

// Public Handlers
export const getPublicBlogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await BlogService.getBlogs({ ...req.query, status: "PUBLISHED" });
  res.json(result);
});

export const getPublicBlog = asyncHandler(async (req: Request, res: Response) => {
  const blog = await BlogService.getBlogBySlug(req.params.slug as string);
  res.json(blog);
});
