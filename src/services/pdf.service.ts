import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import axios from "axios";

export interface IPDFTicket {
  ticketNumber: string;
  ticketTypeName: string;
  qrData: string;
}

export interface IPDFTicketData {
  eventTitle: string;
  eventDate: string;
  venue: string;
  customerName: string;
  tickets: IPDFTicket[];
  eventImage?: string;
  imageBuffer?: Buffer;
}

export class PDFService {
  static async generateTicketPDF(data: IPDFTicketData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [600, 250],
          margin: 0,
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err) => reject(err));

        // -- Event Image Pre-fetch --
        let currentImageBuffer = data.imageBuffer;
        if (!currentImageBuffer && data.eventImage && data.eventImage.startsWith('http')) {
          try {
            const response = await axios.get(data.eventImage, { 
              responseType: "arraybuffer",
              timeout: 3000 
            });
            currentImageBuffer = Buffer.from(response.data);
          } catch (e) {
            console.error("[PDFService] Failed to load event image for PDF:", data.eventImage);
          }
        }

        // Generate a page for each ticket
        for (let i = 0; i < data.tickets.length; i++) {
          if (i > 0) doc.addPage({ size: [600, 250], margin: 0 });
          
          const ticket = data.tickets[i];
          
          // -- Left Section (420px Background) --
          doc.rect(0, 0, 420, 250).fill("#5b0058"); // Fallback color

          if (currentImageBuffer) {
            try {
              doc.save();
              doc.image(currentImageBuffer, 0, 0, { width: 420, height: 250, cover: [420, 250] });
              // Strong dark overlay for high contrast
              doc.rect(0, 0, 420, 250).fillOpacity(0.75).fill("#000000");
              doc.restore();
              doc.fillOpacity(1.0);
            } catch (e) {
              console.error("[PDFService] Error drawing background:", e);
            }
          }

          // -- White Text Content (on left section) --
          doc.fillColor("#ffffff");
          
          // Badge
          doc.fontSize(7).font("Helvetica-Bold").text("OFFICIAL ACCESS TICKET", 30, 30, { characterSpacing: 1 });
          
          // Event Title
          doc.fontSize(22).font("Helvetica-Bold").text(data.eventTitle.toUpperCase(), 30, 60, { width: 360, lineGap: 5 });
          
          // Event Details
          doc.fontSize(10).font("Helvetica").text(`DATE: ${data.eventDate}`, 30, 140);
          doc.fontSize(10).font("Helvetica").text(`VENUE: ${data.venue || "TBA"}`, 30, 155, { width: 360 });
          
          // Ticket Category
          doc.rect(30, 185, 120, 25).fill("#d3067d");
          doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold").text(ticket.ticketTypeName.toUpperCase(), 40, 193);

          // Holder
          doc.fillColor("#ffffff").fontSize(9).font("Helvetica").text(`HOLDER: ${data.customerName.toUpperCase()}`, 30, 225);

          // -- Right Verification Section (180px White/Light) --
          doc.rect(420, 0, 180, 250).fill("#ffffff");
          doc.moveTo(420, 0).lineTo(420, 250).dash(5, { space: 5 }).stroke("#dddddd");

          // QR Code
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticket.qrData)}`;
          try {
            const qrResponse = await axios.get(qrUrl, { 
              responseType: "arraybuffer",
              timeout: 2000 
            });
            const qrBuffer = Buffer.from(qrResponse.data);
            doc.image(qrBuffer, 440, 40, { width: 140 });
          } catch (e) {
            doc.rect(440, 40, 140, 140).stroke("#eeeeee");
            doc.fillColor("#cccccc").fontSize(8).text("QR UNAVAILABLE", 470, 100);
          }

          // Ticket ID
          doc.fillColor("#171717").fontSize(9).font("Helvetica-Bold").text("TICKET ID", 440, 190);
          doc.fontSize(11).font("Courier-Bold").text(ticket.ticketNumber, 440, 205);
          
          // Branding
          doc.fontSize(8).fillColor("#999999").text("VERIFY AT ENTRANCE", 440, 230);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
