import { ISMSService, SMSData } from "../sms.interface";
import { TermiiSMSService } from "./termii-sms.service";
import { NaloSMSService } from "./nalo-sms.service";

type SMSProvider = "termii" | "nalo";

export class SMSService {
  private static getProvider(): SMSProvider {
    return (process.env.SMS_PROVIDER as SMSProvider) || "nalo";
  }

  private static getService(): ISMSService {
    const provider = this.getProvider();
    
    switch (provider) {
      case "termii":
        return new TermiiSMSService();
      case "nalo":
        return new NaloSMSService();
      default:
        return new NaloSMSService();
    }
  }

  static async sendVerificationCode(phone: string, code: string) {
    const service = this.getService();
    
    return service.sendSMS({
      to: phone,
      message: `Your EaseVote verification code is: ${code}. Valid for 10 minutes.`,
    });
  }

  static async sendVoteConfirmation(phone: string, amount: number, voteCount: number, candidateName: string, categoryName: string) {
    const service = this.getService();
    
    return service.sendSMS({
      to: phone,
      message: `Vote confirmed! You voted GHS ${amount} for ${voteCount} time(s) for ${candidateName} (${categoryName}). Thank you! For support, call 0559540992`,
    });
  }

  static async sendTicketConfirmation(phone: string, eventTitle: string, ticketCount: number, reference: string) {
    const service = this.getService();
    const link = `${process.env.FRONTEND_URL}/receipt/${reference}`;
    
    return service.sendSMS({
      to: phone,
      message: `Ticket confirmed! ${ticketCount} ticket(s) for "${eventTitle}". View your tickets here: ${link}`,
    });
  }

  static async sendCustomMessage(phone: string, message: string) {
    const service = this.getService();
    
    return service.sendSMS({
      to: phone,
      message,
    });
  }
}