import { Purchase } from "../models/Purchase.model";
import { Event } from "../models/Event.model";
import { AppError } from "../middleware/error.middleware";
import { PurchaseService } from "./purchase.service";
import mongoose from "mongoose";

export class VoteService {
  static async initiateVote(eventId: string, candidateCode: string, voteCount: number, customerEmail: string, customerName?: string, customerPhone?: string) {
    const event = await Event.findById(eventId);
    if (!event || event.status !== "LIVE") {
      throw new AppError("Event not available for voting", 400);
    }

    let candidate: any = null;
    let categoryId: string = "";
    let candidateId: string = "";

    // Find candidate by code across all categories
    for (const category of event.categories || []) {
      const foundCandidate = category.candidates.find(cand => cand.code === candidateCode);
      if (foundCandidate) {
        candidate = foundCandidate;
        categoryId = category._id?.toString() || "";
        candidateId = foundCandidate._id?.toString() || "";
        break;
      }
    }

    if (!candidate) {
      throw new AppError("Candidate not found", 404);
    }

    // Use PurchaseService for business logic
    const result = await PurchaseService.initializeVotePurchase({
      eventId,
      candidateId: candidateId,
      categoryId: categoryId,
      voteCount,
      customerEmail,
      customerName,
      customerPhone
    });

    return {
      voting: result.purchase,
      paymentUrl: result.paymentUrl,
      reference: result.reference
    };
  }

  static async confirmVote(reference: string) {
    // Use PurchaseService for verification
    return await PurchaseService.verifyPayment(reference);
  }

  static async getVoteResults(eventId: string) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Aggregate real-time votes from PAID purchases
    const voteAgg = await Purchase.aggregate([
      { 
        $match: { 
          eventId: new mongoose.Types.ObjectId(eventId),
          status: "PAID",
          type: "VOTE"
        } 
      },
      { 
        $group: { 
          _id: "$candidateId", 
          totalVotes: { $sum: "$voteCount" } 
        } 
      }
    ]);

    const voteMap = new Map(voteAgg.map(v => [v._id.toString(), v.totalVotes]));

    const categories = event.categories?.map(category => {
      let candidates = category.candidates.map(candidate => {
        const candidateIdStr = candidate._id?.toString() || "";
        const realVotes = voteMap.get(candidateIdStr) || 0;
        
        return {
          id: candidate._id,
          name: candidate.name,
          code: candidate.code,
          imageUrl: candidate.imageUrl,
          voteCount: event.liveResults ? realVotes : undefined
        };
      });

      // Sort by votes for ranking
      candidates.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));

      // Add ranking and conditionally show vote counts
      candidates = candidates.map((candidate, index) => ({
        ...candidate,
        rank: index + 1,
        voteCount: event.showVoteCount ? candidate.voteCount : undefined
      }));

      const categoryTotalVotes = candidates.reduce((sum, c) => sum + (c.voteCount || 0), 0);

      return {
        id: category._id,
        name: category.name,
        totalVotes: event.showVoteCount ? categoryTotalVotes : undefined,
        candidates
      };
    }) || [];

    return { categories };
  }
}