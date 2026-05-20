import { IUSSDService, USSDRequest, USSDResponse } from "../ussd.interface";
import { Event } from "../models/Event.model";
import { PurchaseService } from "./purchase.service";
import crypto from "crypto";

interface USSDSession {
  step: string;
  data: any;
}

// Use a global Map to persist sessions across requests
const globalSessions = new Map<string, USSDSession>();

export class NaloUSSDService implements IUSSDService {
  private getSessionId(msisdn: string): string {
    return crypto.createHash('md5').update(msisdn).digest('hex');
  }

  async handleRequest(request: USSDRequest): Promise<USSDResponse> {
    try {
      const sessionId = this.getSessionId(request.MSISDN);
      
      if (request.MSGTYPE) {
        globalSessions.delete(sessionId);
        return this.showWelcomeScreen(request);
      }

      const session = globalSessions.get(sessionId);
      
      if (!session) {
        return this.showWelcomeScreen(request);
      }

      return await this.handleUserInput(request, session);
    } catch (error: any) {
      console.error(`[USSD] Unhandled error for ${request.MSISDN}:`, error);
      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: "Something went wrong. Please try again later.",
        MSGTYPE: false
      };
    }
  }

  private showWelcomeScreen(request: USSDRequest): USSDResponse {
    const sessionId = this.getSessionId(request.MSISDN);
    globalSessions.set(sessionId, { 
      step: 'welcome', 
      data: { network: request.NETWORK || 'MTN' } // Default to MTN for testing
    });

    return {
      USERID: request.USERID,
      MSISDN: request.MSISDN,
      USERDATA: request.USERDATA,
      MSG: "Welcome to EaseVote\n1. Vote\n2. Ticket",
      MSGTYPE: true
    };
  }

  private async handleUserInput(request: USSDRequest, session: USSDSession): Promise<USSDResponse> {
    const sessionId = this.getSessionId(request.MSISDN);

    switch (session.step) {
      case 'welcome':
        return this.handleWelcomeChoice(request, session);
      
      case 'vote_enter_code':
        return this.handleCandidateCode(request, session);
      
      case 'vote_confirm':
        return this.handleVoteQuantity(request, session);
      
      case 'vote_final_confirm':
        return this.handleVoteFinalConfirm(request, session);
      
      case 'ticket_enter_code':
        return this.handleEventCode(request, session);
      
      case 'ticket_select_type':
        return this.handleTicketTypeSelection(request, session);
      
      case 'ticket_enter_quantity':
        return this.handleTicketQuantity(request, session);
      
      case 'ticket_confirm':
        return this.handleTicketConfirm(request, session);
      
      default:
        globalSessions.delete(sessionId);
        return this.showWelcomeScreen(request);
    }
  }

  private handleWelcomeChoice(request: USSDRequest, session: USSDSession): USSDResponse {
    const choice = request.USERDATA.trim();
    const sessionId = this.getSessionId(request.MSISDN);

    if (choice === '1') {
      globalSessions.set(sessionId, { 
        step: 'vote_enter_code', 
        data: { network: session.data.network } 
      });
      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: "Enter candidate code:",
        MSGTYPE: true
      };
    } else if (choice === '2') {
      globalSessions.set(sessionId, { 
        step: 'ticket_enter_code', 
        data: { network: session.data.network } 
      });
      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: "Enter event code:",
        MSGTYPE: true
      };
    } else {
      globalSessions.delete(sessionId);
      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: "Invalid choice. Please select 1 or 2.",
        MSGTYPE: false
      };
    }
  }

  private async handleCandidateCode(request: USSDRequest, session: USSDSession): Promise<USSDResponse> {
    const candidateCode = request.USERDATA.trim().toUpperCase();
    const sessionId = this.getSessionId(request.MSISDN);

    try {
      // Find candidate across all events
      const event = await Event.findOne({
        'categories.candidates.code': candidateCode,
        status: { $in: ['PUBLISHED', 'LIVE'] }
      });

      if (!event) {
        globalSessions.delete(sessionId);
        return {
          USERID: request.USERID,
          MSISDN: request.MSISDN,
          USERDATA: request.USERDATA,
          MSG: "Candidate not found or event not active.",
          MSGTYPE: false
        };
      }

      let candidate: any = null;
      let categoryId = '';
      
      for (const category of event.categories || []) {
        const found = category.candidates.find(c => c.code === candidateCode);
        if (found) {
          candidate = found;
          categoryId = category._id?.toString() || '';
          break;
        }
      }

      globalSessions.set(sessionId, {
        step: 'vote_confirm',
        data: { event, candidate, categoryId, candidateCode, network: session.data.network }
      });

      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: `Candidate: ${candidate.name}\nEvent: ${event.title}\nCost: ${event.costPerVote} per vote\n\nEnter number of votes:`,
        MSGTYPE: true
      };
    } catch (error) {
      globalSessions.delete(sessionId);
      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: "Error processing request. Please try again.",
        MSGTYPE: false
      };
    }
  }

  private async handleVoteQuantity(request: USSDRequest, session: USSDSession): Promise<USSDResponse> {
    const voteCount = parseInt(request.USERDATA.trim());
    const sessionId = this.getSessionId(request.MSISDN);

    if (isNaN(voteCount) || voteCount <= 0) {
      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: "Invalid vote count. Please enter a valid number:",
        MSGTYPE: true
      };
    }

    const { event, candidate } = session.data;
    const totalAmount = event.costPerVote * voteCount;

    globalSessions.set(sessionId, {
      step: 'vote_final_confirm',
      data: { ...session.data, voteCount, totalAmount }
    });

    return {
      USERID: request.USERID,
      MSISDN: request.MSISDN,
      USERDATA: request.USERDATA,
      MSG: `${voteCount} vote(s) for ${candidate.name}\nTotal: ${totalAmount}\n\n1. Confirm\n2. Cancel`,
      MSGTYPE: true
    };
  }

  private async handleVoteFinalConfirm(request: USSDRequest, session: USSDSession): Promise<USSDResponse> {
    const choice = request.USERDATA.trim();
    const sessionId = this.getSessionId(request.MSISDN);

    if (choice !== '1') {
      globalSessions.delete(sessionId);
      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: "Vote cancelled.",
        MSGTYPE: false
      };
    }

    const { event, candidate, categoryId, voteCount, network } = session.data;

    // Fire payment initiation in background — don't await so USSD session
    // closes immediately and the MoMo prompt can appear without interference
    PurchaseService.initializeVotePurchaseUSSD({
      eventId: event._id.toString(),
      candidateId: candidate._id.toString(),
      categoryId,
      voteCount,
      customerPhone: request.MSISDN,
      network,
      source: 'ussd'
    }).catch((error: any) => {
      console.error(`[USSD] Background vote payment failed for ${request.MSISDN}:`, error);
    });

    globalSessions.delete(sessionId);

    // Return a brief thank you message and close the USSD session
    // so the MoMo payment prompt can take over the screen
    return {
      USERID: request.USERID,
      MSISDN: request.MSISDN,
      USERDATA: request.USERDATA,
      MSG: "Thank you. Please complete the payment prompt.",
      MSGTYPE: false
    };
  }

  private async handleEventCode(request: USSDRequest, session: USSDSession): Promise<USSDResponse> {
    const eventCode = request.USERDATA.trim().toUpperCase();
    const sessionId = this.getSessionId(request.MSISDN);

    try {
      const event = await Event.findOne({
        eventCode,
        type: 'TICKETING',
        status: { $in: ['PUBLISHED', 'LIVE'] }
      });

      if (!event || !event.ticketTypes?.length) {
        globalSessions.delete(sessionId);
        return {
          USERID: request.USERID,
          MSISDN: request.MSISDN,
          USERDATA: request.USERDATA,
          MSG: "Event not found or no tickets available.",
          MSGTYPE: false
        };
      }

      let msg = `${event.title}\nSelect ticket type:\n`;
      event.ticketTypes.forEach((ticket, index) => {
        const available = ticket.quantity - (ticket.sold || 0) - (ticket.reserved || 0);
        msg += `${index + 1}. ${ticket.name} - ${ticket.price} (${available} left)\n`;
      });

      globalSessions.set(sessionId, {
        step: 'ticket_select_type',
        data: { event, network: session.data.network }
      });

      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: msg,
        MSGTYPE: true
      };
    } catch (error) {
      globalSessions.delete(sessionId);
      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: "Error processing request. Please try again.",
        MSGTYPE: false
      };
    }
  }

  private handleTicketTypeSelection(request: USSDRequest, session: USSDSession): USSDResponse {
    const choice = parseInt(request.USERDATA.trim());
    const sessionId = this.getSessionId(request.MSISDN);
    const { event } = session.data;

    if (isNaN(choice) || choice < 1 || choice > event.ticketTypes.length) {
      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: "Invalid selection. Please choose a valid ticket type:",
        MSGTYPE: true
      };
    }

    const selectedTicket = event.ticketTypes[choice - 1];
    const available = selectedTicket.quantity - (selectedTicket.sold || 0) - (selectedTicket.reserved || 0);

    globalSessions.set(sessionId, {
      step: 'ticket_enter_quantity',
      data: { event, selectedTicket, ticketTypeId: selectedTicket._id, network: session.data.network }
    });

    return {
      USERID: request.USERID,
      MSISDN: request.MSISDN,
      USERDATA: request.USERDATA,
      MSG: `${selectedTicket.name} - ${selectedTicket.price} each\nAvailable: ${available}\n\nEnter quantity:`,
      MSGTYPE: true
    };
  }

  private handleTicketQuantity(request: USSDRequest, session: USSDSession): USSDResponse {
    const quantity = parseInt(request.USERDATA.trim());
    const sessionId = this.getSessionId(request.MSISDN);
    const { selectedTicket } = session.data;

    if (isNaN(quantity) || quantity <= 0) {
      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: "Invalid quantity. Please enter a valid number:",
        MSGTYPE: true
      };
    }

    const available = selectedTicket.quantity - (selectedTicket.sold || 0) - (selectedTicket.reserved || 0);
    if (quantity > available) {
      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: `Only ${available} tickets available. Enter quantity:`,
        MSGTYPE: true
      };
    }

    const totalAmount = selectedTicket.price * quantity;

    globalSessions.set(sessionId, {
      step: 'ticket_confirm',
      data: { ...session.data, quantity, totalAmount }
    });

    return {
      USERID: request.USERID,
      MSISDN: request.MSISDN,
      USERDATA: request.USERDATA,
      MSG: `${quantity}x ${selectedTicket.name}\nTotal: ${totalAmount}\n\n1. Confirm\n2. Cancel`,
      MSGTYPE: true
    };
  }

  private async handleTicketConfirm(request: USSDRequest, session: USSDSession): Promise<USSDResponse> {
    const choice = request.USERDATA.trim();
    const sessionId = this.getSessionId(request.MSISDN);

    if (choice !== '1') {
      globalSessions.delete(sessionId);
      return {
        USERID: request.USERID,
        MSISDN: request.MSISDN,
        USERDATA: request.USERDATA,
        MSG: "Transaction cancelled.",
        MSGTYPE: false
      };
    }

    const { event, ticketTypeId, quantity, network } = session.data;

    // Fire payment initiation in background — don't await so USSD session
    // closes immediately and the MoMo prompt can appear without interference
    PurchaseService.initializeTicketPurchaseUSSD({
      eventId: event._id.toString(),
      ticketTypeId: ticketTypeId.toString(),
      quantity,
      customerPhone: request.MSISDN,
      network,
      source: 'ussd'
    }).catch((error: any) => {
      console.error(`[USSD] Background ticket payment failed for ${request.MSISDN}:`, error);
    });

    globalSessions.delete(sessionId);

    // Return a brief thank you message and close the USSD session
    // so the MoMo payment prompt can take over the screen
    return {
      USERID: request.USERID,
      MSISDN: request.MSISDN,
      USERDATA: request.USERDATA,
      MSG: "Thank you. Please complete the payment prompt.",
      MSGTYPE: false
    };
  }
}