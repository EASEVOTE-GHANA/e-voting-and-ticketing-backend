import mongoose, { Document, Schema } from "mongoose";

export interface ICandidate {
  _id?: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  imageUrl?: string;
  description?: string;
  code: string;
  votes?: number;
}

export interface ICategory {
  _id?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  candidates: ICandidate[];
}

export interface ITicketType {
  _id?: mongoose.Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  reserved?: number;
  sold?: number;
}

export interface IEvent extends Document {
  organizerId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  type: "VOTING" | "TICKETING";
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "PUBLISHED" | "LIVE" | "PAUSED" | "ENDED" | "CANCELLED" | "ARCHIVED";
  eventCode: string;
  imageUrl?: string;
  
  // Soft delete
  isDeleted: boolean;
  deletedAt?: Date;
  
  // Dates
  startDate: Date;
  endDate: Date;
  nominationStartDate?: Date;
  nominationEndDate?: Date;
  votingStartDate?: Date;
  votingEndDate?: Date;
  ticketSaleStartDate?: Date;
  ticketSaleEndDate?: Date;
  
  // Location
  venue?: string;
  location?: string;
  
  // Visibility
  isPublic: boolean;
  
  // Voting specific
  costPerVote?: number;
  minVotesPerPurchase?: number;
  maxVotesPerPurchase?: number;
  allowPublicNominations?: boolean;
  votingStartTime?: Date;
  votingEndTime?: Date;
  liveResults?: boolean;
  showVoteCount?: boolean;
  categories?: ICategory[];
  
  // Ticketing specific
  ticketTypes?: ITicketType[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const candidateSchema = new Schema<ICandidate>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  imageUrl: { type: String },
  description: { type: String },
  code: { type: String, required: true, unique: true },
  votes: { type: Number, default: 0 }
});

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true },
  description: { type: String },
  candidates: [candidateSchema]
});

const ticketTypeSchema = new Schema<ITicketType>({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  reserved: { type: Number, default: 0 },
  sold: { type: Number, default: 0 }
});

const eventSchema = new Schema<IEvent>({
  organizerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, enum: ["VOTING", "TICKETING"], required: true },
  status: { 
    type: String, 
    enum: ["DRAFT", "PENDING_REVIEW", "APPROVED", "PUBLISHED", "LIVE", "PAUSED", "ENDED", "CANCELLED", "ARCHIVED"],
    default: "DRAFT"
  },
  eventCode: { type: String, required: true, unique: true },
  imageUrl: { type: String },
  
  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  nominationStartDate: { type: Date },
  nominationEndDate: { type: Date },
  votingStartDate: { type: Date },
  votingEndDate: { type: Date },
  ticketSaleStartDate: { type: Date },
  ticketSaleEndDate: { type: Date },
  
  venue: { type: String },
  location: { type: String },
  isPublic: { type: Boolean, default: true },
  
  // Voting specific fields
  costPerVote: { 
    type: Number,
    required: function(this: IEvent) { return this.type === 'VOTING'; }
  },
  minVotesPerPurchase: { type: Number },
  maxVotesPerPurchase: { type: Number },
  allowPublicNominations: { 
    type: Boolean, 
    default: false,
    validate: {
      validator: function(this: IEvent) {
        return this.type === 'VOTING' || !this.allowPublicNominations;
      },
      message: 'allowPublicNominations is only valid for VOTING events'
    }
  },
  votingStartTime: { type: Date },
  votingEndTime: { type: Date },
  liveResults: { type: Boolean, default: true },
  showVoteCount: { type: Boolean, default: true },
  categories: {
    type: [categorySchema],
    validate: {
      validator: function(this: IEvent) {
        return this.type === 'VOTING' || !this.categories?.length;
      },
      message: 'categories are only valid for VOTING events'
    }
  },
  
  // Ticketing specific fields
  ticketTypes: {
    type: [ticketTypeSchema],
    validate: {
      validator: function(this: IEvent) {
        return this.type === 'TICKETING' || !this.ticketTypes?.length;
      },
      message: 'ticketTypes are only valid for TICKETING events'
    }
  }
}, {
  timestamps: true
});

export const Event = mongoose.model<IEvent>("Event", eventSchema);