import mongoose, { Schema, Document } from "mongoose";

export interface IBlog extends Document {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  author: mongoose.Types.ObjectId;
  coverImage?: string;
  status: "DRAFT" | "PUBLISHED";
  category?: string;
  tags: string[];
  publishedAt?: Date;
  readTime?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BlogSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    content: { type: String, required: true },
    excerpt: { type: String },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coverImage: { type: String },
    status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
    category: { type: String },
    tags: [{ type: String }],
    publishedAt: { type: Date },
    readTime: { type: Number },
  },
  { timestamps: true }
);

// Auto-generate excerpt if not provided
BlogSchema.pre("save", async function (this: any) {
  if (this.isModified("content") && !this.excerpt) {
    // Strip HTML/Markdown-ish tags if needed, otherwise take first 200 chars
    this.excerpt = (this.content as string).substring(0, 200).replace(/[#*`]/g, "") + "...";
  }
  
  // Calculate read time (avg 200 words per minute)
  const words = (this.content as string).split(/\s+/).length;
  this.readTime = Math.ceil(words / 200);

  if (this.status === "PUBLISHED" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

export const Blog = mongoose.model<IBlog>("Blog", BlogSchema);
