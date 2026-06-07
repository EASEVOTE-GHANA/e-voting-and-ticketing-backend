import { Faq } from "../models/Faq.model";
import { AppError } from "../middleware/error.middleware";

export class FaqService {
  static async getFaqs() {
    return await Faq.find({ status: "PUBLISHED" }).sort({ order: 1, createdAt: -1 });
  }

  static async getAllFaqs() {
    return await Faq.find().sort({ order: 1, createdAt: -1 });
  }

  static async upsertFaq(data: any) {
    const { id, ...updateData } = data;
    if (id) {
      const faq = await Faq.findByIdAndUpdate(id, updateData, { returnDocument: 'after' });
      if (!faq) throw new AppError("FAQ not found", 404);
      return faq;
    }
    return await Faq.create(updateData);
  }

  static async deleteFaq(id: string) {
    const faq = await Faq.findByIdAndDelete(id);
    if (!faq) throw new AppError("FAQ not found", 404);
    return faq;
  }

  static async seedDefaults() {
    const defaultFaqs = [
      {
        question: "How do I create an event?",
        answer: "To create an event, log in to your dashboard and click on 'Create Event'. Follow the steps to set up voting and ticketing.",
        category: "Organizing"
      },
      {
        question: "How can I vote for a nominee?",
        answer: "Find the event on our homepage or via a direct link, select your nominee, choose the number of votes, and proceed to payment.",
        category: "Voting"
      },
      {
        question: "What payment methods are supported?",
        answer: "We support Mobile Money (MTN, Telecel, AT), Debit/Credit cards, and Bank transfers.",
        category: "Payments"
      }
    ];

    // Only seed if empty
    const count = await Faq.countDocuments();
    if (count > 0) return { success: false, message: "FAQs already exist" };

    await Faq.insertMany(defaultFaqs);
    return { success: true, message: "Default FAQs seeded successfully" };
  }
}
