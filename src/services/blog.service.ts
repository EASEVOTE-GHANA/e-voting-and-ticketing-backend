import { Blog } from "../models/Blog.model";
import { AppError } from "../middleware/error.middleware";

const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

export class BlogService {
  static async createBlog(data: any) {
    const slug = slugify(data.title, { lower: true, strict: true });
    
    // Check for slug uniqueness
    const existing = await Blog.findOne({ slug });
    if (existing) {
        data.slug = `${slug}-${Date.now().toString().slice(-4)}`;
    } else {
        data.slug = slug;
    }

    return await Blog.create(data);
  }

  static async updateBlog(id: string, data: any) {
    if (data.title) {
        data.slug = slugify(data.title, { lower: true, strict: true });
    }
    
    const blog = await Blog.findByIdAndUpdate(id, data, { new: true });
    if (!blog) throw new AppError("Blog post not found", 404);
    return blog;
  }

  static async getBlogs(query: any = {}) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;

    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .populate("author", "fullName email")
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Blog.countDocuments(filter)
    ]);

    return {
      blogs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    };
  }

  static async getBlogBySlug(slug: string) {
    const blog = await Blog.findOne({ slug, status: "PUBLISHED" })
      .populate("author", "fullName email avatar");
    if (!blog) throw new AppError("Blog post not found", 404);
    return blog;
  }

  static async getAdminBlogById(id: string) {
    const blog = await Blog.findById(id).populate("author", "fullName email");
    if (!blog) throw new AppError("Blog post not found", 404);
    return blog;
  }

  static async deleteBlog(id: string) {
    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) throw new AppError("Blog post not found", 404);
    return blog;
  }
}
